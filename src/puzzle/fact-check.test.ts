import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LlmQuotaError, type LlmClient } from '../llm/client.js';
import { FACT_RULE, combineVerdicts, factCheckCandidates, factKey, factToCheck } from './fact-check.js';
import type { FactTable, ForgeCandidate } from './forge.js';

const usage = { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
const table: FactTable = { category: 'video game characters', sources: ['fixture'], license: 'CC0', entities: [
  { name: 'Shulk', aliases: [], fame: 2, attributes: { debutDecade: '2010s', debutYear: 2010, publisher: 'Nintendo', speciesOrType: 'Homs' } },
  { name: 'Wrongo', aliases: [], fame: 1, attributes: { debutDecade: '2000s', debutYear: 2011, publisher: 'Nintendo' } },
] };
const candidate = (answer: string, attributes: Array<[string, string]>): ForgeCandidate => ({ id: `c-${answer}`, sourceTable: table.category, category: 'games', difficulty: 'medium', answer, aliases: [],
  halfA: 'x', halfB: 'y', halfAAlsoFits: ['a', 'b'], halfBAlsoFits: ['c', 'd'], alsoFitsA: ['a', 'b'], alsoFitsB: ['c', 'd'],
  predicates: { halfA: [{ attribute: attributes[0]![0], operator: 'eq', value: attributes[0]![1] }], halfB: [{ attribute: attributes[1]![0], operator: 'eq', value: attributes[1]![1] }], setSizeA: 5, setSizeB: 5 } });

/** A fact model that answers from a fixed opinion per attribute and records what it was asked. */
function model(opinion: Record<string, 'true' | 'false' | 'unsure'>, asked: string[] = []): LlmClient {
  return { tokenUsage: usage, chatJsonWithUsage: async (messages: Array<{ content: string }>) => {
    const rows = JSON.parse(messages[1]!.content) as Array<{ key: string; attribute: string; value: unknown }>;
    asked.push(...rows.map(row => `${row.attribute}=${JSON.stringify(row.value)}`));
    return { value: { checks: rows.map(row => ({ key: row.key, verdict: opinion[row.attribute] ?? 'true', reason: 'fixture' })) }, usage };
  } } as unknown as LlmClient;
}
async function withDir(run: (path: string) => Promise<void>) { const dir = await mkdtemp(join(tmpdir(), 'tc-facts-')); try { await run(join(dir, 'verdicts.json')); } finally { await rm(dir, { recursive: true, force: true }); } }

describe('fact panel', () => {
  it('rejects a fact only when both models say false, and keeps a split as flagged', () => {
    const t = { verdict: 'true' as const, reason: '' }, f = { verdict: 'false' as const, reason: '' }, u = { verdict: 'unsure' as const, reason: '' };
    expect(combineVerdicts({ a: f, b: f }, ['a', 'b']).outcome).toBe('rejected');
    expect(combineVerdicts({ a: f, b: t }, ['a', 'b']).outcome).toBe('flagged');
    expect(combineVerdicts({ a: u, b: t }, ['a', 'b']).outcome).toBe('flagged');
    expect(combineVerdicts({ a: t, b: t }, ['a', 'b']).outcome).toBe('accepted');
    expect(combineVerdicts({ a: t }, ['a', 'b']).outcome).toBe('pending');
  });

  it('derives a decade from the raw year in code and asks the models about the year instead', () => {
    expect(factToCheck(table.entities[0]!, { attribute: 'debutDecade', operator: 'eq', value: '2010s' })).toEqual({ ask: { attribute: 'debutYear', value: 2010, match: 'equals' } });
    expect(factToCheck(table.entities[1]!, { attribute: 'debutDecade', operator: 'eq', value: '2000s' }).codeError).toMatch(/2011 gives 2010s/);
    expect(factToCheck(table.entities[0]!, { attribute: 'publisher', operator: 'eq', value: 'Nintendo' }).ask?.attribute).toBe('publisher');
  });

  it('keeps a split fact, rejects a both-false fact, never sends a decade to a model, and caches by panel rule', () => withDir(async path => {
    const askedA: string[] = [], askedB: string[] = [];
    const clients = { a: model({ speciesOrType: 'false', publisher: 'false' }, askedA), b: model({ speciesOrType: 'true', publisher: 'false' }, askedB) };
    const shulkSplit = candidate('Shulk', [['debutDecade', '2010s'], ['speciesOrType', 'Homs']]);
    const shulkFalse = { ...candidate('Shulk', [['debutDecade', '2010s'], ['publisher', 'Nintendo']]), id: 'c-shulk-2' };
    const wrong = candidate('Wrongo', [['debutDecade', '2000s'], ['publisher', 'Nintendo']]);
    const summary = await factCheckCandidates([shulkSplit, shulkFalse, wrong], [table], clients, ['a', 'b'], path);
    expect(summary.valid.map(row => row.id)).toEqual(['c-Shulk']);
    expect(summary.flagged[0]?.notes[0]).toMatch(/speciesOrType/);
    expect(summary.removed.map(row => row.id).sort()).toEqual(['c-Wrongo', 'c-shulk-2']);
    expect(summary.removed.find(row => row.id === 'c-Wrongo')?.reasons.join(' ')).toMatch(/2011 gives 2010s/);
    expect([...askedA, ...askedB].some(item => item.startsWith('debutDecade'))).toBe(false);
    expect(askedA).toContain('debutYear=2010');
    const cache = JSON.parse(await readFile(path, 'utf8'));
    expect(cache.every((row: { rule: string }) => row.rule === FACT_RULE)).toBe(true);
    const again: string[] = [];
    await factCheckCandidates([shulkSplit], [table], { a: model({}, again), b: model({}, again) }, ['a', 'b'], path);
    expect(again).toEqual([]);
  }));

  it('discards verdicts cached under the old single-model rule', () => withDir(async path => {
    await writeFile(path, JSON.stringify([{ key: factKey('Shulk', 'publisher', 'Nintendo'), entity: 'Shulk', attribute: 'publisher', value: 'Nintendo', verdict: 'false', reason: 'old single model' }]));
    const asked: string[] = [];
    const summary = await factCheckCandidates([candidate('Shulk', [['publisher', 'Nintendo'], ['speciesOrType', 'Homs']])], [table], { a: model({}, asked), b: model({}) }, ['a', 'b'], path);
    expect(asked).toContain('publisher="Nintendo"');
    expect(summary.valid).toHaveLength(1);
  }));

  it('leaves facts pending when a fact model has hit its daily quota', () => withDir(async path => {
    const out = { tokenUsage: usage, chatJsonWithUsage: async () => { throw new LlmQuotaError('per day', true); } } as unknown as LlmClient;
    const summary = await factCheckCandidates([candidate('Shulk', [['publisher', 'Nintendo'], ['speciesOrType', 'Homs']])], [table], { a: model({}), b: out }, ['a', 'b'], path, { log: () => undefined });
    expect(summary.pending).toHaveLength(1);
    expect(summary.valid).toHaveLength(0);
    expect(summary.removed).toHaveLength(0);
  }));
});
