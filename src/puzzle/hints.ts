import { hasTemplate, isClueAttribute, leaksSeriesName, matchesPredicate, renderPredicateGroup, type AttributePredicate, type FactTable } from './forge.js';
import type { Puzzle } from './types.js';
import { validatePuzzle } from './validate.js';

export interface HintPick { predicate: AttributePredicate; text: string; remaining: number }

/**
 * The hint for one side: another fact about the answer from the puzzle's own table, on an attribute neither half
 * uses. It must narrow that side's set yet leave at least two members, so a hint plus its own half still needs
 * the other community. The narrowest such fact wins, because it helps most.
 */
export function pickHint(puzzle: Puzzle, table: FactTable, side: 'A' | 'B', exclude: ReadonlySet<string> = new Set()): HintPick | undefined {
  const answer = table.entities.find(entity => entity.name === puzzle.answer);
  if (!answer || !puzzle.predicates) return undefined;
  const asPredicates = (rows: NonNullable<Puzzle['predicates']>['halfA']): AttributePredicate[] => rows.map(row => ({ ...row, operator: row.operator ?? 'eq' }));
  const own = asPredicates(side === 'A' ? puzzle.predicates.halfA : puzzle.predicates.halfB);
  const used = new Set([...puzzle.predicates.halfA, ...puzzle.predicates.halfB].map(row => row.attribute));
  const members = table.entities.filter(entity => own.every(predicate => matchesPredicate(entity, predicate)));
  let best: HintPick | undefined;
  for (const [attribute, raw] of Object.entries(answer.attributes).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isClueAttribute(attribute) || used.has(attribute) || exclude.has(attribute) || !hasTemplate(attribute)) continue;
    const options: AttributePredicate[] = Array.isArray(raw) ? raw.map(value => ({ attribute, operator: 'has', value })) : [{ attribute, operator: 'eq', value: raw }];
    for (const predicate of options) {
      const remaining = members.filter(entity => matchesPredicate(entity, predicate)).length;
      if (remaining < 2 || remaining >= members.length) continue;
      const text = renderPredicateGroup([predicate], table.category);
      if (leaksSeriesName(text, text, answer)) continue;
      if (validatePuzzle({ ...puzzle, [side === 'A' ? 'hintA' : 'hintB']: text }).some(reason => /hint/i.test(reason))) continue;
      if (!best || remaining < best.remaining) best = { predicate, text, remaining };
    }
  }
  return best;
}

/** Adds hints to forged puzzles from their source tables. Halves and fingerprints are unchanged. */
export function withHints(puzzle: Puzzle, tables: FactTable[]): Puzzle {
  const table = tables.find(row => row.category === puzzle.sourceTable);
  if (!table) return puzzle;
  // The two communities get different facts when the table allows; otherwise B may get the same fact as A.
  const a = pickHint(puzzle, table, 'A');
  const hintA = a?.text;
  const hintB = (pickHint(puzzle, table, 'B', new Set(a ? [a.predicate.attribute] : [])) ?? pickHint(puzzle, table, 'B'))?.text;
  return { ...puzzle, ...(hintA ? { hintA } : {}), ...(hintB ? { hintB } : {}) };
}
