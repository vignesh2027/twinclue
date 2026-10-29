import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { forgedPack } from './forged-pack.js';
import { SHOWCASE_IDS, isVideoSafe, showcasePuzzles } from './showcase.js';
import { demoPuzzlePack } from './demo-pack.js';
import { puzzleFingerprint, statusOf, type AuditReport } from './audit.js';
import { validatePuzzle } from './validate.js';

const report = JSON.parse(readFileSync('src/puzzle/audit-report.json', 'utf8')) as AuditReport;

describe('video-safe showcase', () => {
  it('lists eight audited, passing, video-safe puzzles from at least five categories', () => {
    const showcase = showcasePuzzles(forgedPack);
    expect(showcase.map(p => p.id)).toEqual([...SHOWCASE_IDS]);
    expect(new Set(showcase.map(p => p.sourceTable)).size).toBeGreaterThanOrEqual(5);
    for (const puzzle of showcase) {
      const result = report.results.find(row => row.id === puzzle.id);
      expect(result && statusOf(result), puzzle.answer).toBe('passed');
      expect(result!.fingerprint).toBe(puzzleFingerprint(puzzle, report.solverModels, report.factModel));
      expect(isVideoSafe(puzzle)).toBe(true);
      expect(validatePuzzle(puzzle)).toEqual([]);
    }
  });

  it('never treats game characters or unaudited samples as video-safe', () => {
    for (const puzzle of forgedPack.filter(p => p.sourceTable === 'video game characters')) expect(isVideoSafe(puzzle)).toBe(false);
    for (const puzzle of demoPuzzlePack) expect(isVideoSafe(puzzle)).toBe(false);
  });

  it('keeps no demo sample whose half names the answer on its own', () => {
    expect(demoPuzzlePack.map(p => p.answer)).not.toContain('Mario');
    for (const puzzle of demoPuzzlePack) {
      expect(validatePuzzle(puzzle)).toEqual([]);
      for (const half of [puzzle.halfA, puzzle.halfB]) expect(half).not.toMatch(/brother|green/i);
    }
  });
});
