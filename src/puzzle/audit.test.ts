import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { puzzlePack } from './pack.js';
import { AUDIT_VERSION, BlindPuzzleAuditor, auditPack, clueText, createBlindBatches, invalidAnswerReason, opaqueId, puzzleFingerprint, statusOf, type AuditReport, type PuzzleAuditResult } from './audit.js';
import { LlmQuotaError, type LlmClient } from '../llm/client.js';
import type { Puzzle } from './types.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

const usage = { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
const pack: Puzzle[] = ['Paris', 'Rome', 'Vienna', 'Prague', 'Madrid', 'Lisbon', 'Dublin', 'Oslo', 'Bern', 'Athens'].map(answer => ({
  ...puzzleFixture, id: `p-${answer}`, answer, aliases: [], halfA: `First clue fits ${answer}.`, halfB: `Second clue fits ${answer}.`,
}));
const answerFor = (text: string) => /fits (\w+)\./.exec(text)?.[1] ?? 'Unknown';
type Item = { clue_id: string; clue: string };
const itemsOf = (messages: Array<{ content: string }>) => JSON.parse(messages[1]!.content) as Item[];
const shuffle = <T>(items: T[]) => items.map(item => [Math.random(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);

/** A solver that knows every answer from the clue text: it solves both-halves prompts, misses single halves, and replies in random order. */
function oracle(log: Item[][] = []): LlmClient {
  return { tokenUsage: usage, chatJsonWithUsage: async (messages: Array<{ content: string }>) => {
    const items = itemsOf(messages);
    log.push(items);
    return { value: { answers: shuffle(items.map(item => ({ clue_id: item.clue_id, best_answer: item.clue.includes('also fits') ? answerFor(item.clue) : `Not ${answerFor(item.clue)}x`, alternatives: ['Nowhere Land', 'Somewhere Else'] }))) }, usage };
  } } as unknown as LlmClient;
}

describe('committed puzzle audit', () => {
  it('covers every shipped puzzle with a passing result under the current audit version', async () => {
    const report = JSON.parse(await readFile(new URL('./audit-report.json', import.meta.url), 'utf8')) as AuditReport;
    if (!puzzlePack.length) return;
    expect(report.auditVersion).toBe(AUDIT_VERSION);
    for (const puzzle of puzzlePack) {
      const result = report.results.find(row => row.id === puzzle.id);
      expect(result && statusOf(result), puzzle.id).toBe('passed');
      expect(result!.fingerprint).toBe(puzzleFingerprint(puzzle, report.solverModels, report.factModel));
    }
  });
});

describe('blind prompts', () => {
  it('never puts two prompts from one puzzle in a request and never labels a half', () => {
    for (const batch of createBlindBatches(pack, 4)) {
      expect(new Set(batch.map(clue => clue.puzzleIndex)).size).toBe(batch.length);
      for (const clue of batch) expect(clue.text).not.toMatch(/half [ab]\b/i);
    }
    expect(clueText(puzzleFixture, 'both')).toContain(puzzleFixture.halfA);
    expect(clueText(puzzleFixture, 'both')).toContain(puzzleFixture.halfB);
  });

  it('uses random 4 to 6 character ids with a letter and a digit, never a bare letter or word', () => {
    const used = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const id = opaqueId(used);
      expect(id).toMatch(/^[a-z0-9]{4,6}$/);
      expect(id).toMatch(/[a-z]/);
      expect(id).toMatch(/\d/);
    }
    expect(used.size).toBe(500);
  });

  it('keeps every id mapped to its own clue text and answer when replies come back shuffled', async () => {
    const log: Item[][] = [];
    const auditor = new BlindPuzzleAuditor({ one: oracle(log), two: oracle(), three: oracle() }, { solverModels: ['one', 'two', 'three'], batchSize: 4 });
    const results = await auditor.auditMany(shuffle(pack));
    for (const result of results) {
      for (const row of result.solvers.both) expect(row.best_answer).toBe(result.answer);
      for (const row of [...result.solvers.halfA, ...result.solvers.halfB]) expect(row.best_answer).toBe(`Not ${result.answer}x`);
      expect(statusOf(result)).toBe('passed');
    }
    const sent = log.flat();
    expect(new Set(sent.map(item => item.clue_id)).size).toBe(sent.length);
    expect(sent.every(item => /^[a-z0-9]{4,6}$/.test(item.clue_id))).toBe(true);
  });
});

describe('answer validity', () => {
  it('rejects ids, one or two characters, and one value in all three fields, but allows listed short names', () => {
    expect(invalidAnswerReason({ best_answer: 'B', alternatives: ['B', 'B'] }, ['k7qz'])).toMatch(/one or two characters/);
    expect(invalidAnswerReason({ best_answer: 'k7qz', alternatives: ['Peru', 'Chile'] }, ['k7qz'])).toMatch(/clue id/);
    expect(invalidAnswerReason({ best_answer: 'Peru', alternatives: ['k7qz', 'Chile'] }, ['k7qz'])).toMatch(/clue id/);
    expect(invalidAnswerReason({ best_answer: 'Peru', alternatives: ['peru', 'PERU'] }, ['k7qz'])).toMatch(/all three/);
    expect(invalidAnswerReason({ best_answer: 'Io', alternatives: ['Europa', 'Titan'] }, ['k7qz'], new Set(['io']))).toBeUndefined();
    expect(invalidAnswerReason({ best_answer: 'Peru', alternatives: ['Chile', 'Bolivia'] }, ['k7qz'])).toBeUndefined();
    expect(invalidAnswerReason({ best_answer: 'A character is a human and is female', alternatives: ['Chell', 'Lara Croft'] }, ['k7qz'], new Set(), 'A character is a human and is female.')).toBeDefined();
    expect(invalidAnswerReason({ best_answer: 'is in Africa', alternatives: ['Kenya', 'Ghana'] }, ['k7qz'], new Set(), 'A country has a coastline and is in Africa.')).toMatch(/repeats the clue/);
    expect(invalidAnswerReason({ best_answer: 'Bosnia and Herzegovina', alternatives: ['Serbia', 'Croatia'] }, ['k7qz'], new Set(), 'A country in Europe.')).toBeUndefined();
  });

  it('retries an invalid answer one clue at a time and uses the valid retry', async () => {
    const calls: number[] = [];
    const echo = { tokenUsage: usage, chatJsonWithUsage: async (messages: Array<{ content: string }>) => {
      const items = itemsOf(messages);
      calls.push(items.length);
      // In a batch the model answers with the id itself; asked alone, it answers properly.
      return { value: { answers: items.map(item => ({ clue_id: item.clue_id, best_answer: items.length > 1 ? item.clue_id : answerFor(item.clue), alternatives: ['Nowhere Land', 'Somewhere Else'] })) }, usage };
    } } as unknown as LlmClient;
    const auditor = new BlindPuzzleAuditor({ echo, two: oracle() }, { solverModels: ['echo', 'two'], batchSize: 4 });
    const [result] = await auditor.auditMany(pack.slice(0, 2));
    expect(result!.solvers.both.find(row => row.model === 'echo')?.best_answer).toBe('Paris');
    expect(calls.filter(size => size === 1).length).toBe(6);
  });
});

describe('pending, not failed', () => {
  it('keeps a puzzle pending when fewer than two solvers give valid answers', async () => {
    const broken = { tokenUsage: usage, chatJsonWithUsage: async (messages: Array<{ content: string }>) => ({ value: { answers: itemsOf(messages).map(item => ({ clue_id: item.clue_id, best_answer: 'B', alternatives: ['B', 'B'] })) }, usage }) } as unknown as LlmClient;
    const auditor = new BlindPuzzleAuditor({ good: oracle(), broken }, { solverModels: ['good', 'broken'], batchSize: 8 });
    const [result] = await auditor.auditMany([pack[0]!]);
    expect(statusOf(result!)).toBe('pending');
    expect(result!.passed).toBe(false);
    expect(result!.failures[0]).toMatch(/Pending/);
    expect(result!.invalid?.both[0]).toMatchObject({ model: 'broken' });
  });

  it('waits out a per-minute quota and keeps the model, but drops a model on its daily quota', async () => {
    let throttled = 1;
    const slow = { tokenUsage: usage, chatJsonWithUsage: async (messages: Array<{ content: string }>) => {
      if (throttled-- > 0) throw new LlmQuotaError('Rate limited per minute', false);
      return (oracle() as unknown as { chatJsonWithUsage: (m: unknown) => Promise<unknown> }).chatJsonWithUsage(messages);
    } } as unknown as LlmClient;
    const daily = { tokenUsage: usage, chatJsonWithUsage: async () => { throw new LlmQuotaError('Requests per day exhausted', true); } } as unknown as LlmClient;
    const waits: number[] = [];
    const auditor = new BlindPuzzleAuditor({ slow, daily, good: oracle() }, { solverModels: ['slow', 'daily', 'good'], batchSize: 8, sleep: async ms => { waits.push(ms); }, quotaWaitMs: 1234, log: () => undefined });
    const [result] = await auditor.auditMany([pack[0]!]);
    expect(waits).toEqual([1234]);
    expect(auditor.exhausted).toEqual(new Set(['daily']));
    expect(auditor.availableSolvers).toEqual(['slow', 'good']);
    expect(result!.solvers.both.map(row => row.model).sort()).toEqual(['good', 'slow']);
    expect(statusOf(result!)).toBe('passed');
  });

  it('re-audits pending results and results from older audit versions, and reuses settled ones', async () => {
    const solverModels = ['one', 'two'];
    const settled: PuzzleAuditResult = { id: pack[0]!.id, fingerprint: puzzleFingerprint(pack[0]!, solverModels, 'facts'), auditVersion: AUDIT_VERSION, answer: 'Paris', status: 'failed', passed: false,
      halfA: { best_answer: 'x', alternatives: ['', ''], referee: 'rejected' }, halfB: { best_answer: 'x', alternatives: ['', ''], referee: 'rejected' }, both: { best_answer: 'x', alternatives: ['', ''], referee: 'rejected' },
      solvers: { halfA: [], halfB: [], both: [] }, failures: ['kept from an earlier run'] };
    const pendingRow = { ...settled, id: pack[1]!.id, fingerprint: puzzleFingerprint(pack[1]!, solverModels, 'facts'), status: 'pending' as const };
    const oldVersion = { ...settled, id: pack[2]!.id, fingerprint: puzzleFingerprint(pack[2]!, solverModels, 'facts'), auditVersion: 2.1, status: undefined, passed: true };
    const auditor = new BlindPuzzleAuditor({ one: oracle(), two: oracle() }, { solverModels, factModel: 'facts', batchSize: 8 });
    const report = await auditPack(pack.slice(0, 3), auditor, { solverModels, factModel: 'facts', resume: [settled, pendingRow, oldVersion] });
    expect(report.results[0]!.failures).toEqual(['kept from an earlier run']);
    expect(statusOf(report.results[1]!)).toBe('passed');
    expect(report.results[2]!.auditVersion).toBe(AUDIT_VERSION);
    expect(report).toMatchObject({ total: 3, passed: 2, failed: 1, pending: 0 });
  });
});
