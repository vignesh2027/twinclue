import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFactVocabularies, vocabularyFor } from './vocabulary-source.js';
import { Round } from '../game/round.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

describe('closed vocabulary sources', () => {
  it('loads custom CSV tables, so a custom puzzle names every entity and not only the two halves\' candidates', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tc-vocab-'));
    try {
      await mkdir(join(dir, 'custom'));
      const rows = ['Paris', 'Rome', 'Vienna', 'Prague', 'Rouen', 'Melun', 'Montereau', 'Oslo'];
      await writeFile(join(dir, 'custom', 'club.csv'), `name,aliases,fame,river\n${rows.map(name => `${name},,2,x`).join('\n')}\n`);
      const tables = loadFactVocabularies(dir);
      const puzzle = { ...puzzleFixture, sourceTable: 'club' };
      const round = new Round(puzzle, { vocabulary: vocabularyFor(puzzle, tables) });
      round.start(0, 60_000);
      // Oslo fits neither half. Named on its own bar, it tells side A nothing about side B's candidates.
      round.vote('A', '1', 'Oslo', 0);
      round.vote('A', '2', 'Melun', 0);
      expect(round.displayBuckets('A').buckets.map(bucket => bucket.answer).sort()).toEqual(['Melun', 'Oslo']);
      expect(round.displayBuckets('A').other).toBe(0);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
