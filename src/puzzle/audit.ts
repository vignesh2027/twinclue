import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Puzzle } from './types.js';
import { judgeGuess, normaliseGuess } from '../game/referee.js';
import { LlmQuotaError, type LlmClient, type TokenUsage } from '../llm/client.js';

/**
 * Version 3: clue prompts no longer carry "Half A" or "Half B" labels (a solver answered the label "B" for every
 * half B), ids are random opaque labels, invalid answers are retried one clue at a time, a result needs at least two
 * valid solver answers per prompt or it stays pending, and fact checking moved to the attribute-level panel in
 * fact-check.ts. Every result made under an older version is re-audited.
 */
export const AUDIT_VERSION = 3;
export const MIN_VALID_SOLVERS = 2;

export type PromptKind = 'halfA' | 'halfB' | 'both';
export type AuditStatus = 'passed' | 'failed' | 'pending';
const KINDS: PromptKind[] = ['halfA', 'halfB', 'both'];

const AnswerSchema = z.object({ clue_id: z.string(), best_answer: z.string(), alternatives: z.array(z.string()).length(2) });
const BlindBatchSchema = z.object({ answers: z.array(AnswerSchema) });
const blindFormat = { type: 'json_schema', json_schema: { name: 'blind_batch', strict: true, schema: { type: 'object', properties: { answers: { type: 'array', items: { type: 'object',
  properties: { clue_id: { type: 'string' }, best_answer: { type: 'string' }, alternatives: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 } },
  required: ['clue_id', 'best_answer', 'alternatives'], additionalProperties: false } } }, required: ['answers'], additionalProperties: false } } };

export interface BlindAnswer { best_answer: string; alternatives: [string, string] }
export interface AuditPromptResult extends BlindAnswer { referee: 'accepted' | 'rejected' | 'unclear' }
export interface SolverResult { model: string; best_answer: string; alternatives: [string, string]; referee: 'accepted' | 'rejected' | 'unclear' }
/** Kept for the archived v2 reports, which carried a clue-level fact check. */
export interface FactCheckResult { halfA: 'true' | 'false' | 'unsure'; halfAReason: string; halfB: 'true' | 'false' | 'unsure'; halfBReason: string }
export interface PuzzleAuditResult {
  id: string; fingerprint: string; auditVersion: number; answer: string; status?: AuditStatus; passed: boolean;
  halfA: AuditPromptResult; halfB: AuditPromptResult; both: AuditPromptResult;
  solvers: Record<PromptKind, SolverResult[]>;
  /** Models that gave no valid answer for a prompt, with the reason. */
  invalid?: Record<PromptKind, Array<{ model: string; reason: string }>>;
  factCheck?: FactCheckResult; failures: string[];
}
export interface AuditRound { round: number; puzzlesAudited: number; passed: number }
export interface AuditReport {
  auditVersion: number; generatedAt: string; solverModels: string[]; factModel: string; passRule: string; total: number; passed: number; failed?: number; pending?: number;
  passRate: number | null; singleHalfHitRate: number | null; bothHalvesHitRate: number | null; tokenUsage: Record<string, TokenUsage>;
  results: PuzzleAuditResult[]; rounds: AuditRound[]; categories?: Record<string, unknown>; factFlags?: unknown;
}
export interface PuzzleAuditor { audit(puzzle: Puzzle): Promise<PuzzleAuditResult>; auditMany?(puzzles: Puzzle[]): Promise<PuzzleAuditResult[]> }

export const statusOf = (result: PuzzleAuditResult): AuditStatus => result.status ?? (result.passed ? 'passed' : 'failed');

export function puzzleFingerprint(puzzle: Puzzle, solverModels: string[] = [], factModel = ''): string {
  return createHash('sha256').update(JSON.stringify([AUDIT_VERSION, [...solverModels].sort(), factModel, puzzle.id, puzzle.answer, puzzle.aliases, puzzle.halfA, puzzle.halfB])).digest('hex');
}

/** The text a solver sees. No labels: a label such as "Half B" is what a weak model answered with. */
export function clueText(puzzle: Pick<Puzzle, 'halfA' | 'halfB'>, kind: PromptKind): string {
  if (kind === 'halfA') return puzzle.halfA;
  if (kind === 'halfB') return puzzle.halfB;
  return `${puzzle.halfA} The same answer also fits this: ${puzzle.halfB}`;
}

export type BlindClue = { puzzleIndex: number; kind: PromptKind; text: string };
/** One request per prompt kind, never two prompts from the same puzzle in one request. */
export function createBlindBatches(puzzles: Puzzle[], batchSize: number): BlindClue[][] {
  const batches: BlindClue[][] = [];
  for (const kind of KINDS) {
    for (let start = 0; start < puzzles.length; start += Math.max(1, batchSize)) {
      batches.push(puzzles.slice(start, start + Math.max(1, batchSize)).map((puzzle, offset) => ({ puzzleIndex: start + offset, kind, text: clueText(puzzle, kind) })));
    }
  }
  return batches;
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** A random 4 to 6 character label with at least one letter and one digit, so it reads as neither a word nor a letter. */
export function opaqueId(used: Set<string>): string {
  for (;;) {
    const length = randomInt(4, 7);
    let id = '';
    for (let i = 0; i < length; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
    if (/[a-z]/.test(id) && /\d/.test(id) && !used.has(id)) { used.add(id); return id; }
  }
}

/** Why an answer cannot count, or undefined when it is a plausible real-world answer. */
export function invalidAnswerReason(answer: BlindAnswer, ids: Iterable<string>, knownShortNames: ReadonlySet<string> = new Set(), clue = ''): string | undefined {
  const best = normaliseGuess(answer.best_answer);
  const all = [best, ...answer.alternatives.map(normaliseGuess)];
  const labels = new Set([...ids].map(id => normaliseGuess(id)));
  // Real two-letter names (Io, a moon of Jupiter) are allowed only when a fact table lists them.
  if (best.length <= 2 && !knownShortNames.has(best)) return `answer "${answer.best_answer}" is one or two characters`;
  if (all.some(value => labels.has(value))) return `answer repeats a clue id`;
  if (all[0] === all[1] && all[1] === all[2]) return `the same value "${answer.best_answer}" in all three fields`;
  // A name is short. A sentence, or a phrase copied from the clue, is the model repeating its input.
  const words = best.split(' ').length;
  if (words > 6) return `answer "${answer.best_answer}" is a sentence, not a name`;
  if (words >= 3 && normaliseGuess(clue).includes(best)) return `answer repeats the clue text`;
  return undefined;
}

const solverSystem = [
  'You solve short trivia clues. Each clue describes one real thing: a country, a game character, an animal, a food, an instrument, a sport or a space object.',
  'For every item give your single best answer and two different plausible alternatives. Each must be a real name, never a letter, a number or a label.',
  'The clue_id is only a label for matching your reply to the item. It carries no meaning and is never the answer.',
  'Solve each item on its own. Do not assume information that is not in the clue.',
  'Return only JSON: {"answers":[{"clue_id":"the supplied clue_id","best_answer":"name","alternatives":["name","name"]}]}, one item per supplied clue_id.',
].join(' ');

export interface AuditPanelOptions {
  solverModels: string[]; factModel?: string; batchSize?: number;
  /** How long to wait after a per-minute quota error that gave no delay of its own, and how often to try again. */
  quotaWaitMs?: number; quotaRetries?: number; sleep?: (ms: number) => Promise<void>; log?: (message: string) => void;
  /** Normalised entity names of two characters or fewer that are real answers, such as "io". */
  knownShortNames?: ReadonlySet<string>;
}

interface Collected { rows: Record<PromptKind, SolverResult[]>; invalid: Record<PromptKind, Array<{ model: string; reason: string }>> }

export class BlindPuzzleAuditor implements PuzzleAuditor {
  /** Models whose daily quota ran out during this run. They are skipped until the next run. */
  readonly exhausted = new Set<string>();
  private readonly usedIds = new Set<string>();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: (message: string) => void;

  constructor(private readonly clients: Record<string, LlmClient>, readonly options: AuditPanelOptions) {
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.log = options.log ?? (message => console.log(message));
  }

  get tokenUsage(): Record<string, TokenUsage> {
    const usage: Record<string, TokenUsage> = {};
    for (const model of new Set(this.options.solverModels)) usage[model] = this.clients[model]?.tokenUsage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    return usage;
  }

  /** Solvers that can still answer in this run. */
  get availableSolvers(): string[] { return this.options.solverModels.filter(model => this.clients[model] && !this.exhausted.has(model)); }

  async audit(puzzle: Puzzle): Promise<PuzzleAuditResult> { return (await this.auditMany([puzzle]))[0]!; }

  async auditMany(puzzles: Puzzle[]): Promise<PuzzleAuditResult[]> {
    const collected: Collected[] = puzzles.map(() => ({ rows: { halfA: [], halfB: [], both: [] }, invalid: { halfA: [], halfB: [], both: [] } }));
    // Different providers have separate limits, so the solver models run side by side.
    await Promise.all(this.options.solverModels.map(model => this.solveWith(model, puzzles, collected)));
    return puzzles.map((puzzle, index) => this.judge(puzzle, collected[index]!));
  }

  private async solveWith(model: string, puzzles: Puzzle[], collected: Collected[]): Promise<void> {
    if (!this.clients[model]) return;
    const retry: BlindClue[] = [];
    for (const batch of createBlindBatches(puzzles, Math.min(this.options.batchSize ?? 8, 8))) {
      if (this.exhausted.has(model)) { for (const clue of batch) collected[clue.puzzleIndex]!.invalid[clue.kind].push({ model, reason: 'daily quota exhausted' }); continue; }
      const answers = await this.ask(model, batch);
      for (const [clue, outcome] of answers) {
        if ('answer' in outcome) this.record(model, puzzles, collected, clue, outcome.answer);
        else retry.push(clue);
      }
    }
    // Missing or invalid answers are asked again one clue at a time, where nothing else can be confused with them.
    for (const clue of retry) {
      let last = 'no answer';
      for (let attempt = 0; attempt < 2 && !this.exhausted.has(model); attempt++) {
        const outcome = (await this.ask(model, [clue])).get(clue)!;
        if ('answer' in outcome) { this.record(model, puzzles, collected, clue, outcome.answer); last = ''; break; }
        last = outcome.reason;
      }
      if (last) collected[clue.puzzleIndex]!.invalid[clue.kind].push({ model, reason: this.exhausted.has(model) ? 'daily quota exhausted' : last });
    }
  }

  private record(model: string, puzzles: Puzzle[], collected: Collected[], clue: BlindClue, answer: BlindAnswer): void {
    const puzzle = puzzles[clue.puzzleIndex]!;
    collected[clue.puzzleIndex]!.rows[clue.kind].push({ model, best_answer: answer.best_answer, alternatives: answer.alternatives, referee: judgeGuess(answer.best_answer, puzzle.answer, puzzle.aliases) });
  }

  /** One request. Every clue comes back either with a valid answer or with the reason it has none. */
  private async ask(model: string, clues: BlindClue[]): Promise<Map<BlindClue, { answer: BlindAnswer } | { reason: string }>> {
    const ids = clues.map(() => opaqueId(this.usedIds));
    const out = new Map<BlindClue, { answer: BlindAnswer } | { reason: string }>();
    let reply: z.infer<typeof BlindBatchSchema> | undefined;
    try {
      reply = await this.call(model, [{ role: 'system', content: solverSystem }, { role: 'user', content: JSON.stringify(clues.map((clue, i) => ({ clue_id: ids[i], clue: clue.text }))) }]);
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 160) : String(error);
      for (const clue of clues) out.set(clue, { reason });
      return out;
    }
    const byId = new Map(reply.answers.map(answer => [answer.clue_id.trim(), answer]));
    clues.forEach((clue, i) => {
      const raw = byId.get(ids[i]!);
      if (!raw) { out.set(clue, { reason: 'omitted from the reply' }); return; }
      const answer: BlindAnswer = { best_answer: raw.best_answer.trim(), alternatives: [raw.alternatives[0]!.trim(), raw.alternatives[1]!.trim()] };
      const invalid = invalidAnswerReason(answer, ids, this.options.knownShortNames, clue.text);
      out.set(clue, invalid ? { reason: invalid } : { answer });
    });
    return out;
  }

  /** Per-minute quota: wait and keep using the model. Daily quota: drop the model for the rest of this run. */
  private async call(model: string, messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<z.infer<typeof BlindBatchSchema>> {
    const retries = this.options.quotaRetries ?? 5;
    for (let attempt = 0; ; attempt++) {
      try {
        return (await this.clients[model]!.chatJsonWithUsage(messages, BlindBatchSchema, blindFormat)).value;
      } catch (error) {
        if (!(error instanceof LlmQuotaError)) throw error;
        if (error.daily) { this.exhausted.add(model); this.log(`Audit model ${model} reached its daily quota; it is skipped until the next run.`); throw error; }
        if (attempt >= retries) throw error;
        this.log(`Audit model ${model} is rate limited; waiting before continuing.`);
        await this.sleep(this.options.quotaWaitMs ?? 60_000);
      }
    }
  }

  private judge(puzzle: Puzzle, collected: Collected): PuzzleAuditResult {
    const { rows, invalid } = collected;
    const first = (kind: PromptKind): AuditPromptResult => rows[kind][0] ?? { best_answer: 'No valid solver answer', alternatives: ['', ''], referee: 'unclear' };
    const failures: string[] = [];
    const short = KINDS.filter(kind => rows[kind].length < MIN_VALID_SOLVERS);
    let status: AuditStatus;
    if (short.length) {
      status = 'pending';
      failures.push(`Pending: ${short.map(kind => `${kind} has ${rows[kind].length} valid solver answer${rows[kind].length === 1 ? '' : 's'}`).join(', ')}; ${MIN_VALID_SOLVERS} needed for each prompt.`);
    } else {
      for (const kind of ['halfA', 'halfB'] as const) {
        const accepted = rows[kind].filter(row => row.referee === 'accepted').length;
        if (accepted >= Math.floor(rows[kind].length / 2) + 1) failures.push(`${kind} alone was solved by ${accepted}/${rows[kind].length} valid solvers; a majority must miss it.`);
      }
      const together = rows.both.filter(row => row.referee === 'accepted').length;
      if (together < Math.floor(rows.both.length / 2) + 1) failures.push(`Both halves were solved by ${together}/${rows.both.length} valid solvers; a majority is required.`);
      status = failures.length ? 'failed' : 'passed';
    }
    return { id: puzzle.id, fingerprint: puzzleFingerprint(puzzle, this.options.solverModels, this.options.factModel ?? ''), auditVersion: AUDIT_VERSION, answer: puzzle.answer,
      status, passed: status === 'passed', halfA: first('halfA'), halfB: first('halfB'), both: first('both'), solvers: rows, invalid, failures };
  }
}

/** Audits what is not already settled. Pending results are always audited again; settled ones are reused. */
export async function auditPack(pack: Puzzle[], auditor: PuzzleAuditor, options: { batchSize?: number; reportPath?: string; checkpointPath?: string; resume?: PuzzleAuditResult[];
  solverModels: string[]; factModel: string; rounds?: AuditRound[]; generatedAt?: string; onProgress?: (completed: number, total: number, result: PuzzleAuditResult) => void | Promise<void> }): Promise<AuditReport> {
  const results: PuzzleAuditResult[] = new Array(pack.length);
  const byId = new Map((options.resume ?? []).map(result => [result.id, result]));
  const pending: number[] = [];
  pack.forEach((puzzle, index) => {
    const previous = byId.get(puzzle.id);
    if (previous?.auditVersion === AUDIT_VERSION && statusOf(previous) !== 'pending' && previous.fingerprint === puzzleFingerprint(puzzle, options.solverModels, options.factModel)) results[index] = previous;
    else pending.push(index);
  });
  let completed = results.filter(Boolean).length;
  const size = options.batchSize ?? 8;
  for (let start = 0; start < pending.length; start += size) {
    const indexes = pending.slice(start, start + size);
    const audits = auditor.auditMany ? await auditor.auditMany(indexes.map(i => pack[i]!)) : await Promise.all(indexes.map(i => auditor.audit(pack[i]!)));
    for (const [offset, result] of audits.entries()) { results[indexes[offset]!] = result; completed++; await options.onProgress?.(completed, pack.length, result); }
    if (options.checkpointPath) {
      await mkdir(dirname(options.checkpointPath), { recursive: true });
      await writeFile(options.checkpointPath, JSON.stringify({ auditVersion: AUDIT_VERSION, solverModels: options.solverModels, factModel: options.factModel, results: results.filter(Boolean) }, null, 2) + '\n', 'utf8');
    }
  }
  const report = buildReport(results.filter(Boolean), options.solverModels, options.factModel, 'tokenUsage' in auditor ? (auditor as BlindPuzzleAuditor).tokenUsage : {}, options.rounds ?? [], options.generatedAt);
  if (options.reportPath) { await mkdir(dirname(options.reportPath), { recursive: true }); await writeFile(options.reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8'); }
  return report;
}

export const PASS_RULE = `Each of half A, half B and both halves together needs at least ${MIN_VALID_SOLVERS} valid solver answers, or the puzzle stays pending. A majority of valid solvers must miss each half alone and a majority must solve both halves together. Facts are checked per attribute by a two-model panel; a fact is rejected only when both models call it false.`;

export function buildReport(results: PuzzleAuditResult[], solverModels: string[], factModel: string, tokenUsage: Record<string, TokenUsage>, rounds: AuditRound[], generatedAt?: string): AuditReport {
  const settled = results.filter(result => statusOf(result) !== 'pending');
  const passed = settled.filter(result => statusOf(result) === 'passed').length;
  const singles = settled.flatMap(result => [...result.solvers.halfA, ...result.solvers.halfB]);
  const together = settled.flatMap(result => result.solvers.both);
  return {
    auditVersion: AUDIT_VERSION, generatedAt: generatedAt ?? new Date().toISOString(), solverModels, factModel, passRule: PASS_RULE,
    total: results.length, passed, failed: settled.length - passed, pending: results.length - settled.length, passRate: settled.length ? passed / settled.length : null,
    singleHalfHitRate: singles.length ? singles.filter(row => row.referee === 'accepted').length / singles.length : null,
    bothHalvesHitRate: together.length ? together.filter(row => row.referee === 'accepted').length / together.length : null,
    tokenUsage, results, rounds,
  };
}
