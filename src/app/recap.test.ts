import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { buildRecap, RecapStore, renderRecapPage } from './recap.js';
import { registerWebRoutes } from './web.js';
import { GameController } from './controller.js';
import { Session } from '../game/session.js';
import { Round } from '../game/round.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const tempDir = async () => { const dir = await mkdtemp(join(tmpdir(), 'tc-recap-')); dirs.push(dir); return dir; };

function playedSession(): Session {
  const session = new Session();
  const play = (answerA: string, answerB: string, ms: number, names: [string, string][]) => {
    const round = new Round({ ...puzzleFixture, predicates: { ...puzzleFixture.predicates!, setSizeA: ms > 20_000 ? 12 : 6, setSizeB: 5 } }, { minVotersToWin: 1 });
    round.start(0);
    round.vote('A', names[0]![0], answerA, 0, names[0]![1]);
    round.vote('B', names[1]![0], answerB, 0, names[1]![1]);
    round.finish(ms);
    session.recordResult(round);
  };
  play('Paris', 'Paris', 30_000, [['1', 'alice'], ['2', 'bob']]);
  play('Paris', 'Paris', 12_000, [['1', 'alice'], ['3', 'Tom & "Jerry"']]);
  play('Rome', 'Paris', 50_000, [['4', 'carol'], ['2', 'bob']]);
  return session;
}

describe('session recap', () => {
  it('summarises rounds, wins, best streak, fastest solve, top voters and the biggest half-alone moments', () => {
    const recap = buildRecap(playedSession(), 'abcdef012345', 1_000);
    expect(recap).toMatchObject({ rounds: 3, wins: 2, bestStreak: 2, points: 6, fastest: { answer: 'Paris', ms: 12_000 } });
    expect(recap.topVoters.A[0]).toEqual({ name: 'alice', correct: 2, rounds: 2 });
    expect(recap.topVoters.B.map(row => row.name)).toContain('bob');
    expect(recap.moments[0]).toMatchObject({ community: 'A', setSize: 12 });
    expect(recap.moments.length).toBeLessThanOrEqual(3);
  });

  it('renders an escaped page with Open Graph tags', () => {
    const html = renderRecapPage(buildRecap(playedSession(), 'abcdef012345'), 'https://tc.example/');
    expect(html).toContain('<meta property="og:image" content="https://tc.example/og-recap.png">');
    expect(html).toContain('og:title');
    expect(html).toContain('2 wins together');
    // Display names are stripped of angle brackets when recorded, and everything else is escaped on the page.
    expect(html).not.toContain('Tom & "Jerry"');
    expect(html).toContain('Tom &#38; &#34;Jerry&#34;');
    expect(html).not.toMatch(/—|->/);
  });

  it('stores recaps by a strict id, so a crafted id cannot read another file', async () => {
    const store = new RecapStore(await tempDir());
    const recap = buildRecap(playedSession(), 'abcdef012345');
    await store.save(recap);
    expect((await store.load('abcdef012345'))?.wins).toBe(2);
    expect(await store.load('../../.env')).toBeUndefined();
    expect(await store.load('ABCDEF012345')).toBeUndefined();
  });

  it('creates the page from the panel, posts one chat line with the link, and serves it publicly', async () => {
    const app = Fastify();
    const controller = new GameController(playedSession(), [puzzleFixture]);
    const posted: string[] = [];
    registerWebRoutes(app, controller, { security: { adminToken: 'recap-admin-token-0123456789abcdef' }, publicUrl: 'https://tc.example', recaps: new RecapStore(await tempDir()),
      postRecap: async url => { posted.push(url); return true; } });
    expect((await app.inject({ method: 'POST', url: '/api/recap' })).statusCode).toBe(401);
    const created = await app.inject({ method: 'POST', url: '/api/recap', headers: { authorization: 'Bearer recap-admin-token-0123456789abcdef' } });
    const body = created.json();
    expect(body).toMatchObject({ sent: true });
    expect(body.url).toMatch(/^https:\/\/tc\.example\/recap\/[a-f0-9]{12}$/);
    expect(posted).toEqual([body.url]);
    const page = await app.inject({ url: `/recap/${body.id}` });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Top voters'.toUpperCase());
    expect((await app.inject({ url: '/recap/000000000000' })).statusCode).toBe(404);
    const og = await app.inject({ url: '/og-recap.png' });
    expect(og.headers['content-type']).toBe('image/png');
    expect(og.rawPayload.subarray(1, 4).toString()).toBe('PNG');
    controller.close();
    await app.close();
  });
});
