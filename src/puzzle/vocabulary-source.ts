import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { VocabEntry } from '../game/vocabulary.js';
import { parseCsv } from './csv.js';
import type { Puzzle } from './types.js';

/**
 * Loads every fact table's entity names once, keyed by the name forged puzzles record as sourceTable: the
 * `_meta.category` of a JSON table, or the file name of a custom CSV table under `custom/`.
 */
export function loadFactVocabularies(directory = 'facts'): Map<string, VocabEntry[]> {
  const tables = new Map<string, VocabEntry[]>();
  let files: string[] = [];
  try { files = readdirSync(resolve(directory)).filter(file => file.endsWith('.json') && file !== 'verdicts.json'); } catch { return tables; }
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as { _meta?: { category?: string }; entities?: Array<{ name: string; aliases?: string[] }> };
      if (!raw._meta?.category || !Array.isArray(raw.entities)) continue;
      tables.set(raw._meta.category, raw.entities.map(entity => ({ name: entity.name, aliases: entity.aliases ?? [] })));
    } catch { /* a malformed table only loses its vocabulary; puzzles fall back to their also-fits lists */ }
  }
  let custom: string[] = [];
  try { custom = readdirSync(resolve(directory, 'custom')).filter(file => file.endsWith('.csv')); } catch { /* no custom tables */ }
  for (const file of custom) {
    const name = basename(file, '.csv');
    if (tables.has(name)) continue;
    try {
      const [header, ...rows] = parseCsv(readFileSync(resolve(directory, 'custom', file), 'utf8'));
      if (header?.[0]?.trim().toLowerCase() !== 'name' || header[1]?.trim().toLowerCase() !== 'aliases') continue;
      tables.set(name, rows.filter(row => row[0]?.trim()).map(row => ({ name: row[0]!.trim(), aliases: (row[1] ?? '').split('|').map(alias => alias.trim()).filter(Boolean) })));
    } catch { /* same as above */ }
  }
  return tables;
}

/**
 * The closed vocabulary for a puzzle: its fact table plus both also-fits lists, so every candidate either half
 * allows is always named. Without a known table it is undefined and the round uses the answer and the also-fits lists.
 */
export function vocabularyFor(puzzle: Puzzle, tables: Map<string, VocabEntry[]>): VocabEntry[] | undefined {
  const table = puzzle.sourceTable ? tables.get(puzzle.sourceTable) : undefined;
  if (!table) return undefined;
  const alsoFits = [...(puzzle.alsoFitsA ?? puzzle.halfAAlsoFits), ...(puzzle.alsoFitsB ?? puzzle.halfBAlsoFits)];
  return [...table, ...alsoFits.map(name => ({ name, aliases: [] }))];
}
