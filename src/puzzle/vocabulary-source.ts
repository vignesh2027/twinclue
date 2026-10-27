import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VocabEntry } from '../game/vocabulary.js';
import type { Puzzle } from './types.js';

/** Loads every fact table's entity names once, keyed by the table category that forged puzzles record as sourceTable. */
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
  return tables;
}

/** The closed vocabulary for a puzzle: its fact table when known, otherwise the answer and both also-fits lists. */
export function vocabularyFor(puzzle: Puzzle, tables: Map<string, VocabEntry[]>): VocabEntry[] | undefined {
  return puzzle.sourceTable ? tables.get(puzzle.sourceTable) : undefined;
}
