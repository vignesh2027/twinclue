import type { Puzzle } from './types.js';

const blocklist = ['fuck','shit','bitch','cunt','nigger','faggot'];
export function normalisePuzzleText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function validatePuzzle(puzzle: Puzzle): string[] {
  const reasons: string[] = [];
  const halves = [puzzle.halfA, puzzle.halfB];
  if (halves.some((half) => !half.trim())) reasons.push('Both halves must be non-empty.');
  if (halves.some((half) => half.length >= 160)) reasons.push('Each half must be under 160 characters.');
  if (puzzle.answer.trim().split(/\s+/).length > 4) reasons.push('The answer must be at most four words.');
  const terms = [puzzle.answer, ...puzzle.aliases].map(normalisePuzzleText).filter(Boolean);
  for (const [label, alternatives] of [['Half A', puzzle.halfAAlsoFits], ['Half B', puzzle.halfBAlsoFits]] as const) {
    if (alternatives.length < 2) reasons.push(`${label} must list at least two other answers it fits.`);
    const normalized = alternatives.map(normalisePuzzleText);
    if (normalized.some((entry) => !entry)) reasons.push(`${label} alternatives cannot be empty.`);
    if (new Set(normalized).size !== normalized.length) reasons.push(`${label} alternatives must be distinct.`);
    if (normalized.some((entry) => terms.some((term) => entry.includes(term)))) reasons.push(`${label} alternatives cannot include the answer or an alias.`);
  }
  for (const half of halves) {
    const normalized = normalisePuzzleText(half);
    if (terms.some((term) => normalized.includes(term))) reasons.push('A half contains the answer or an alias.');
  }
  if (halves.some((half) => blocklist.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(normalisePuzzleText(half))))) reasons.push('A half contains a blocklisted word.');
  return [...new Set(reasons)];
}
