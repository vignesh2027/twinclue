import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerSandbox, readCookie } from './sandbox.js';
import { forgedPack } from '../puzzle/forged-pack.js';
import { isVideoSafe } from '../puzzle/showcase.js';
import { buildSandboxServer, trustedProxies } from '../server.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });
function sandbox(options: Partial<Parameters<typeof registerSandbox>[1]> = {}) {
  const app = Fastify();
  apps.push(app);
  const manager = registerSandbox(app, { pack: forgedPack, ...options });
  return { app, manager };
}
async function visit(app: FastifyInstance): Promise<string> {
  const page = await app.inject({ url: '/' });
  const cookie = String(page.headers['set-cookie']).split(';')[0]!;
  expect(cookie).toMatch(/^tc_sandbox=[a-f0-9]{32}$/);
  return cookie;
}
const post = (app: FastifyInstance, cookie: string, url: string, payload: unknown = {}) => app.inject({ method: 'POST', url, headers: { cookie }, payload: payload as object });

describe('sandbox mode', () => {
  it('serves a page with the sandbox banner and no admin or Twitch routes', async () => {
    const { app } = sandbox();
    const page = await app.inject({ url: '/' });
    expect(page.body).toContain('Sandbox:</b> no Twitch connection, both chats simulated by you.');
    expect(page.body).toContain('/overlay/a?sandbox=1');
    expect((await app.inject({ url: '/panel' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/auth/start' })).statusCode).toBe(404);
    expect(page.headers['set-cookie']).toMatch(/HttpOnly; SameSite=Lax/);
  });

  it('gives each cookie its own game and plays only audited video-safe puzzles', async () => {
    const { app, manager } = sandbox();
    const one = await visit(app);
    const two = await visit(app);
    await post(app, one, '/sandbox/api/start');
    expect((await post(app, one, '/sandbox/api/vote', { side: 'A', text: 'anything' })).json().result).toBe('voted');
    expect((await app.inject({ url: '/sandbox/api/state', headers: { cookie: two } })).json().state.roundStatus).toBe('idle');
    expect(manager.size).toBe(2);
    for (const visitor of manager.visitors.values()) for (const puzzle of visitor.controller.playable) expect(isVideoSafe(puzzle)).toBe(true);
    const id = readCookie(one, 'tc_sandbox')!;
    expect(manager.visitors.get(id)!.controller.playable.some(puzzle => puzzle.sourceTable === 'video game characters')).toBe(false);
  });

  it('wins a round when both simulated chats lead with the answer, and unlocks a hint in one click', async () => {
    const { app, manager } = sandbox();
    const cookie = await visit(app);
    await post(app, cookie, '/sandbox/api/start');
    const round = manager.visitors.get(readCookie(cookie, 'tc_sandbox')!)!.controller.activeRound!;
    if (round.hintText('A')) expect((await post(app, cookie, '/sandbox/api/hint', { side: 'A' })).json().result).toBe('unlocked');
    for (const side of ['A', 'B']) await post(app, cookie, '/sandbox/api/vote', { side, text: round.puzzle.answer });
    const locked = await post(app, cookie, '/sandbox/api/lock');
    expect(locked.json().state.roundStatus).toBe('won');
  });

  it('rate limits actions, caps games, refuses cross-site requests and forgets idle games', async () => {
    let now = 0;
    const { app, manager } = sandbox({ actionsPerSecond: 1, actionBurst: 3, maxSessions: 1, now: () => now, idleMs: 1_000 });
    const cookie = await visit(app);
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await app.inject({ url: '/sandbox/api/state', headers: { cookie } })).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    now += 2_000;
    expect((await app.inject({ url: '/sandbox/api/state', headers: { cookie } })).statusCode).toBe(200);
    const other = await visit(app);
    expect((await app.inject({ url: '/sandbox/api/state', headers: { cookie: other } })).statusCode).toBe(503);
    expect((await app.inject({ method: 'POST', url: '/sandbox/api/start', headers: { cookie, origin: 'https://evil.example' } })).statusCode).toBe(403);
    now += 5_000;
    manager.sweep();
    expect(manager.size).toBe(0);
    expect((await app.inject({ url: '/sandbox/api/state', headers: { cookie: other } })).statusCode).toBe(200);
  });

  it('opens each overlay socket on the visitor own game only', async () => {
    const { app } = sandbox();
    const cookie = await visit(app);
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    await app.inject({ method: 'POST', url: '/sandbox/api/start', headers: { cookie } });
    const frame = await new Promise<any>((resolve, reject) => {
      const ws = new WebSocket(`${address.replace('http', 'ws')}/sandbox/ws/a`, { headers: { cookie, origin: address } });
      ws.on('message', data => { resolve(JSON.parse(String(data))); ws.close(); });
      ws.on('unexpected-response', (_request, response) => reject(new Error(String(response.statusCode))));
    });
    expect(frame).toMatchObject({ type: 'state', sandbox: true, roundStatus: 'active' });
    const refused = await new Promise<number>(resolve => {
      const ws = new WebSocket(`${address.replace('http', 'ws')}/sandbox/ws/a`, { headers: { origin: address } });
      ws.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
      ws.on('error', () => undefined);
    });
    expect(refused).toBe(400);
  });

  it('builds from SANDBOX settings with the showcase first', async () => {
    const server = await buildSandboxServer({});
    try {
      const first = [...server.manager['visitor']('a'.repeat(32), '1.1.1.1')!.controller.playable][0]!;
      expect(first.id).toBe('forge-836ad8450a');
    } finally { await server.shutdown(); }
  });

  it('plays a sample round by itself when the visitor asks to watch', async () => {
    const { app, manager } = sandbox();
    const cookie = await visit(app);
    expect((await post(app, cookie, '/sandbox/api/watch')).json().result).toBe('watching');
    const controller = manager.visitors.get(readCookie(cookie, 'tc_sandbox')!)!.controller;
    await new Promise(resolve => setTimeout(resolve, 8_600));
    expect(controller.activeRound?.status).toBe('won');
  }, 15_000);

  it('believes only TRUST_PROXY hops of X-Forwarded-For, so a forged leftmost entry cannot dodge the per-address limit', async () => {
    expect(trustedProxies(undefined)).toBe(false);
    expect(trustedProxies('0')).toBe(false);
    const server = await buildSandboxServer({ TRUST_PROXY: '1' });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 22; i++) {
        const cookie = `tc_sandbox=${(i + 1).toString(16).padStart(32, 'c')}`;
        codes.push((await server.app.inject({ url: '/sandbox/api/state', headers: { cookie, 'x-forwarded-for': `6.6.${i}.1, 203.0.113.7` } })).statusCode);
      }
      expect(codes.filter(code => code === 200)).toHaveLength(20);
      expect(codes.slice(20)).toEqual([503, 503]);
      // A different real visitor behind the same proxy still gets a game.
      expect((await server.app.inject({ url: '/sandbox/api/state', headers: { cookie: `tc_sandbox=${'d'.repeat(32)}`, 'x-forwarded-for': '198.51.100.9' } })).statusCode).toBe(200);
    } finally { await server.shutdown(); }
  });

  it('never creates a game from a socket upgrade; the overlay page creates it with the client address', async () => {
    const { app, manager } = sandbox();
    const cookie = await visit(app);
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const refused = await new Promise<number>(resolve => {
      const ws = new WebSocket(`${address.replace('http', 'ws')}/sandbox/ws/a`, { headers: { cookie, origin: address } });
      ws.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
      ws.on('error', () => undefined);
    });
    expect(refused).toBe(503);
    expect(manager.size).toBe(0);
    expect((await app.inject({ url: '/overlay/a?sandbox=1', headers: { cookie } })).statusCode).toBe(200);
    expect(manager.size).toBe(1);
  });

  it('caps overlay sockets per visitor and closes them when the game is forgotten', async () => {
    let now = 0;
    const { app, manager } = sandbox({ maxSocketsPerVisitor: 3, idleMs: 1_000, now: () => now });
    const cookie = await visit(app);
    await app.inject({ url: '/sandbox/api/state', headers: { cookie } });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const open = await Promise.all(Array.from({ length: 5 }, () => new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`${address.replace('http', 'ws')}/sandbox/ws/a`, { headers: { cookie, origin: address } });
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    })));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(open.filter(ws => ws.readyState === WebSocket.OPEN)).toHaveLength(3);
    now += 5_000;
    manager.sweep();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(open.filter(ws => ws.readyState === WebSocket.OPEN)).toHaveLength(0);
  });

  it('shows the live hint progress beside each chat, since the threshold rises with voters', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('public/sandbox.html', 'utf8');
    const script = readFileSync('public/sandbox.js', 'utf8');
    for (const side of ['a', 'b']) expect(page).toContain(`id="hint-${side}"`);
    expect(page).toContain('unlocks once enough viewers ask');
    expect(script).toContain('`Hint: ${hint.asks} of ${hint.needed} asked`');
    const { app, manager } = sandbox();
    const cookie = await visit(app);
    await post(app, cookie, '/sandbox/api/start');
    const round = manager.visitors.get(readCookie(cookie, 'tc_sandbox')!)!.controller.activeRound!;
    if (!round.hintText('A')) return;
    for (let i = 0; i < 10; i++) await post(app, cookie, '/sandbox/api/vote', { side: 'A', text: `guess ${i}` });
    const hints = (await post(app, cookie, '/sandbox/api/hint', { side: 'A' })).json().state.hints.a;
    expect(hints).toMatchObject({ asks: 1, needed: 2, unlocked: false });
  });
});
