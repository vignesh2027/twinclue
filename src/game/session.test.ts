import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionStore } from './session.js';
import { Round } from './round.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

async function withDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'twinclue-'));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

describe('session persistence', () => {
  it('saves atomically and restores score, streak and the active round with its end time', () => withDir(async dir => {
    const store = new SessionStore(join(dir, 'session.json'));
    const session = new Session();
    const round = new Round(puzzleFixture);
    round.start(5, 60_000);
    round.vote('A', '1', 'Paris', 10);
    session.addRound(round);
    Object.assign(session.stats, { rounds: 3, wins: 2, streak: 2 });
    await store.now(session);
    expect((await readdir(dir)).filter(name => name.includes('.tmp'))).toEqual([]);
    const loaded = await store.load();
    expect(loaded.scoreboard).toMatchObject({ rounds: 3, wins: 2, streak: 2 });
    expect(loaded.current?.voterCount('A')).toBe(1);
    expect(loaded.current?.endsAt).toBe(60_005);
  }));

  it('moves a corrupt file aside with a loud log and starts fresh', () => withDir(async dir => {
    const path = join(dir, 'session.json');
    await writeFile(path, '{"version":2, broken');
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const loaded = await new SessionStore(path, log).load();
    expect(loaded.scoreboard).toMatchObject({ rounds: 0, wins: 0, streak: 0 });
    expect(log.error).toHaveBeenCalledOnce();
    expect(log.error.mock.calls[0]![1]).toMatch(/CORRUPT/);
    const files = await readdir(dir);
    expect(files.some(name => name.startsWith('session.json.corrupt-'))).toBe(true);
    expect(files).not.toContain('session.json');
  }));

  it('keeps history bounded, drops finished vote maps and leaves rehearsal rounds out of the score', () => withDir(async dir => {
    const session = new Session();
    for (let i = 0; i < 70; i++) {
      const round = new Round(puzzleFixture, { rehearsal: i === 69, minVotersToWin: 1 });
      round.start(0);
      round.vote('A', `${i}`, 'Paris', 1);
      round.vote('B', `${i}b`, 'Paris', 1);
      round.finish(2);
      session.addRound(round);
      session.recordResult(round);
    }
    expect(session.recent).toHaveLength(50);
    expect(session.scoreboard).toMatchObject({ rounds: 69, wins: 69, streak: 69 });
    const path = join(dir, 'session.json');
    await new SessionStore(path).now(session);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    expect(saved.current.votesA).toEqual([]);
  }));

  it('throttles vote-driven saves to one write per interval', () => withDir(async dir => {
    const store = new SessionStore(join(dir, 'session.json'), undefined, undefined, 200);
    const session = new Session();
    const write = vi.spyOn(session, 'serialize');
    for (let i = 0; i < 50; i++) store.request(session);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(write).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 50; i++) store.request(session);
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(write).toHaveBeenCalledTimes(1);
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(write).toHaveBeenCalledTimes(2);
    store.stop();
  }));

  it('resolves a save that arrives during another write only once its own state is on disk', () => withDir(async dir => {
    const path = join(dir, 'session.json');
    const store = new SessionStore(path);
    const session = new Session();
    const first = store.now(session);
    session.stats.rounds = 7;
    // The shutdown path awaits exactly this call and then exits, so the newer score must already be written.
    await store.now(session);
    expect(JSON.parse(await readFile(path, 'utf8')).stats.rounds).toBe(7);
    await first;
  }));
});
