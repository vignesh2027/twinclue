import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { LlmQuotaError, type LlmClient } from '../llm/client.js';
import type { AttributePredicate, FactEntity, FactTable, FactValue, ForgeCandidate } from './forge.js';

/**
 * Attribute-level fact check by a panel of models. A fact is rejected only when every model says false; a split
 * keeps the fact and flags it for review. Values the table can derive from a raw value (a decade from a year) are
 * computed in code, and the models are asked about the raw value instead, so no model ever judges whether 2011 is
 * in the 2010s.
 */
export const FACT_RULE = 'panel-v1';
export const DEFAULT_FACT_MODELS = ['gemini:gemini-2.5-flash', 'groq:openai/gpt-oss-20b'];

export const DERIVED_ATTRIBUTES: Record<string, { source: string; derive: (raw: number) => string }> = {
  debutDecade: { source: 'debutYear', derive: year => `${Math.floor(year / 10) * 10}s` },
  discoveryCentury: { source: 'discoveryYear', derive: year => `${Math.floor(year / 100) * 100}s` },
};

const VerdictSchema = z.object({ checks: z.array(z.object({ key: z.string(), verdict: z.enum(['true', 'false', 'unsure']), reason: z.string() })) });
export interface ModelVerdict { verdict: 'true' | 'false' | 'unsure'; reason: string }
export interface FactVerdict { key: string; entity: string; attribute: string; value: unknown; match: string; rule: string; verdicts: Record<string, ModelVerdict> }
export type FactOutcome = 'accepted' | 'rejected' | 'flagged' | 'pending';
export interface FactCheckSummary {
  valid: ForgeCandidate[]; removed: Array<{ id: string; reasons: string[] }>; flagged: Array<{ id: string; notes: string[] }>; pending: ForgeCandidate[]; checked: number;
}
export interface FactCheckOptions { batchSize?: number; quotaWaitMs?: number; quotaRetries?: number; sleep?: (ms: number) => Promise<void>; log?: (message: string) => void }

export function factKey(entity: string, attribute: string, value: unknown): string { return JSON.stringify([entity, attribute, value]); }

/** The panel's combined outcome for one fact. A missing model verdict leaves the fact pending. */
export function combineVerdicts(verdicts: Record<string, ModelVerdict>, models: string[]): { outcome: FactOutcome; note: string } {
  const rows = models.map(model => [model, verdicts[model]] as const);
  if (rows.some(([, verdict]) => !verdict)) return { outcome: 'pending', note: `waiting for ${rows.filter(([, v]) => !v).map(([m]) => m).join(', ')}` };
  const note = rows.map(([model, verdict]) => `${model} ${verdict!.verdict} (${verdict!.reason})`).join('; ');
  if (rows.every(([, verdict]) => verdict!.verdict === 'false')) return { outcome: 'rejected', note };
  if (rows.every(([, verdict]) => verdict!.verdict === 'true')) return { outcome: 'accepted', note };
  return { outcome: 'flagged', note };
}

/** What the models are asked to check for one predicate, or a deterministic verdict when code can decide alone. */
export function factToCheck(entity: FactEntity, predicate: AttributePredicate): { ask?: { attribute: string; value: FactValue; match: string }; codeError?: string } {
  const derived = DERIVED_ATTRIBUTES[predicate.attribute];
  const raw = derived ? entity.attributes[derived.source] : undefined;
  if (derived && typeof raw === 'number') {
    const computed = derived.derive(raw);
    if (computed !== String(predicate.value)) return { codeError: `${derived.source} ${raw} gives ${computed}, but the table says ${String(predicate.value)}` };
    return { ask: { attribute: derived.source, value: raw, match: 'equals' } };
  }
  const match = predicate.operator === 'only' ? 'is exactly this complete list' : predicate.operator === 'has' ? 'includes this value' : 'equals';
  return { ask: { attribute: predicate.attribute, value: predicate.value, match } };
}

const system = [
  'You check facts about well-known things. For each item decide whether the attribute of the named entity matches the stated value, using established, checkable facts.',
  'Answer true, false or unsure, with a reason of at most 12 words.',
  'Judge only the stated attribute and value. Do not reinterpret the attribute name.',
  'Return JSON {"checks":[{"key":"the exact key","verdict":"true|false|unsure","reason":"short reason"}]} with one item per key.',
].join(' ');

export async function factCheckCandidates(candidates: ForgeCandidate[], tables: FactTable[], clients: Record<string, LlmClient>, models: string[] = DEFAULT_FACT_MODELS,
  path = 'facts/verdicts.json', options: FactCheckOptions = {}): Promise<FactCheckSummary> {
  const tableByName = new Map(tables.map(table => [table.category, table]));
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const log = options.log ?? (message => console.log(message));
  let cache: FactVerdict[] = [];
  try { cache = JSON.parse(await readFile(path, 'utf8')) as FactVerdict[]; } catch { /* no cache yet */ }
  // Verdicts made under the old single-model rule are discarded.
  const byKey = new Map(cache.filter(item => item?.rule === FACT_RULE).map(item => [item.key, item]));

  type Plan = { candidate: ForgeCandidate; codeErrors: string[]; keys: string[] };
  const plans: Plan[] = [];
  for (const candidate of candidates) {
    const entity = tableByName.get(candidate.sourceTable)?.entities.find(row => row.name === candidate.answer);
    const plan: Plan = { candidate, codeErrors: [], keys: [] };
    if (!entity) { plan.codeErrors.push('Answer is missing from its fact table.'); plans.push(plan); continue; }
    for (const predicate of [...candidate.predicates.halfA, ...candidate.predicates.halfB]) {
      const check = factToCheck(entity, predicate);
      if (check.codeError) { plan.codeErrors.push(check.codeError); continue; }
      const key = factKey(entity.name, check.ask!.attribute, check.ask!.value);
      plan.keys.push(key);
      if (!byKey.has(key)) byKey.set(key, { key, entity: entity.name, attribute: check.ask!.attribute, value: check.ask!.value, match: check.ask!.match, rule: FACT_RULE, verdicts: {} });
    }
    plans.push(plan);
  }

  const needed = new Set(plans.flatMap(plan => plan.keys));
  let checked = 0;
  const unavailable = new Set<string>();
  const save = async () => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify([...byKey.values()], null, 2) + '\n'); };
  await Promise.all(models.map(async model => {
    const client = clients[model];
    if (!client) { unavailable.add(model); return; }
    const todo = [...needed].map(key => byKey.get(key)!).filter(item => !item.verdicts[model]);
    const size = options.batchSize ?? 24;
    for (let offset = 0; offset < todo.length && !unavailable.has(model); offset += size) {
      const batch = todo.slice(offset, offset + size);
      const prompt = batch.map(item => ({ key: item.key, entity: item.entity, attribute: item.attribute, value: item.value, match: item.match }));
      for (let attempt = 0; ; attempt++) {
        try {
          const reply = await client.chatJsonWithUsage([{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(prompt) }], VerdictSchema);
          const rows = new Map(reply.value.checks.map(row => [row.key, row]));
          for (const item of batch) { const row = rows.get(item.key); if (row) { item.verdicts[model] = { verdict: row.verdict, reason: row.reason.slice(0, 160) }; checked++; } }
          break;
        } catch (error) {
          if (error instanceof LlmQuotaError && error.daily) { unavailable.add(model); log(`Fact model ${model} reached its daily quota; its facts stay pending.`); break; }
          if (attempt >= (options.quotaRetries ?? 3)) { log(`Fact model ${model} failed a batch: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`); break; }
          await sleep(error instanceof LlmQuotaError ? options.quotaWaitMs ?? 60_000 : 2_000);
        }
      }
      await save();
    }
  }));
  await save();

  const summary: FactCheckSummary = { valid: [], removed: [], flagged: [], pending: [], checked };
  for (const plan of plans) {
    const reasons = [...plan.codeErrors];
    const notes: string[] = [];
    let pending = false;
    for (const key of plan.keys) {
      const item = byKey.get(key)!;
      const { outcome, note } = combineVerdicts(item.verdicts, models);
      const label = `${item.attribute} ${JSON.stringify(item.value)}`;
      if (outcome === 'rejected') reasons.push(`${label}: every fact model says false (${note})`);
      else if (outcome === 'flagged') notes.push(`${label}: ${note}`);
      else if (outcome === 'pending') pending = true;
    }
    if (reasons.length) summary.removed.push({ id: plan.candidate.id, reasons });
    else if (pending) summary.pending.push(plan.candidate);
    else { summary.valid.push(plan.candidate); if (notes.length) summary.flagged.push({ id: plan.candidate.id, notes }); }
  }
  return summary;
}
