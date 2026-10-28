import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { pickHint, withHints } from './hints.js';
import { matchesPredicate, type FactTable } from './forge.js';
import { validatePuzzle, normalisePuzzleText } from './validate.js';
import { forgedPack } from './forged-pack.js';
import type { Puzzle } from './types.js';

const tables: FactTable[] = readdirSync('facts').filter(file => file.endsWith('.json') && file !== 'verdicts.json').map(file => {
  const raw = JSON.parse(readFileSync(`facts/${file}`, 'utf8'));
  return { category: raw._meta.category, entities: raw.entities, sources: raw._meta.sources, license: raw._meta.license };
});

describe('hint lines', () => {
  it('uses a fact of the answer from its own table that narrows the side but still leaves two or more candidates', () => {
    let checked = 0;
    for (const puzzle of forgedPack) {
      const table = tables.find(row => row.category === puzzle.sourceTable)!;
      for (const side of ['A', 'B'] as const) {
        const hint = pickHint(puzzle, table, side);
        if (!hint) continue;
        checked++;
        const answer = table.entities.find(entity => entity.name === puzzle.answer)!;
        expect(matchesPredicate(answer, hint.predicate), `${puzzle.answer} ${hint.text}`).toBe(true);
        const used = [...puzzle.predicates!.halfA, ...puzzle.predicates!.halfB].map(row => row.attribute);
        expect(used).not.toContain(hint.predicate.attribute);
        const own = (side === 'A' ? puzzle.predicates!.halfA : puzzle.predicates!.halfB).map(row => ({ ...row, operator: row.operator ?? 'eq' as const }));
        const members = table.entities.filter(entity => own.every(row => matchesPredicate(entity, row)));
        expect(hint.remaining).toBeGreaterThanOrEqual(2);
        expect(hint.remaining).toBeLessThan(members.length);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('ships hints on the forged pack that pass the leak checks and never name the answer', () => {
    const withHint = forgedPack.filter(puzzle => puzzle.hintA || puzzle.hintB);
    expect(withHint.length).toBeGreaterThan(forgedPack.length * 0.8);
    for (const puzzle of forgedPack) {
      expect(validatePuzzle(puzzle), puzzle.id).toEqual([]);
      for (const hint of [puzzle.hintA, puzzle.hintB].filter(Boolean) as string[]) {
        for (const name of [puzzle.answer, ...puzzle.aliases]) expect(normalisePuzzleText(hint)).not.toContain(normalisePuzzleText(name));
      }
      const regenerated = withHints({ ...puzzle, hintA: undefined, hintB: undefined }, tables);
      expect([regenerated.hintA, regenerated.hintB], 'hints are deterministic').toEqual([puzzle.hintA, puzzle.hintB]);
    }
  });

  it('rejects a hint that names the answer', () => {
    const puzzle = forgedPack[0]!;
    const leaky: Puzzle = { ...puzzle, hintA: `It is ${puzzle.answer}.` };
    expect(validatePuzzle(leaky)).toContain('A hint contains the answer or an alias.');
  });
});
