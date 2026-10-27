import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDemoServer, buildServer } from './server.js';
import type { SocketLike } from './twitch/eventsub.js';

const ADMIN = 'server-test-admin-token-0123456789';

describe('server wiring', () => {
  it('serialises EventSub restarts so two quick OAuth callbacks leave exactly one client', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tc-server-'));
    const sockets: Array<{ closed: boolean }> = [];
    const socketFactory = (): SocketLike => {
      const entry = { closed: false };
      sockets.push(entry);
      return { on() { return this; }, send() {}, close() { entry.closed = true; }, terminate() { entry.closed = true; } };
    };
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    const fetcher = (async (url: string | URL | Request) => {
      const target = String(url);
      // A little latency, so the two restarts overlap unless they are serialised.
      await new Promise(resolve => setTimeout(resolve, 5));
      if (target.endsWith('/oauth2/token')) return json({ access_token: `t${Math.random()}`, refresh_token: 'r', expires_in: 3600, scope: [], token_type: 'bearer' });
      if (target.endsWith('/oauth2/validate')) return json({ login: 'hostbot', user_id: '30', scopes: [], expires_in: 3600 });
      if (target.includes('/helix/users')) return json({ data: [{ id: target.includes('chana') ? '10' : '20' }] });
      if (target.includes('/shared_chat/session')) return json({ data: [] });
      return json({}, 202);
    }) as typeof fetch;
    const server = await buildServer({ TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'secret', PUBLIC_URL: 'https://tc.example', CHANNEL_A: 'chana', CHANNEL_B: 'chanb', BOT_LOGIN: 'hostbot', ADMIN_TOKEN: ADMIN },
      { sessionPath: join(dir, 'session.json'), tokenPath: join(dir, 'tokens.json'), fetcher, socketFactory, pack: [] });
    try {
      expect(sockets).toHaveLength(0);
      const state = async () => new URL((await server.app.inject({ method: 'POST', url: '/auth/start', headers: { authorization: `Bearer ${ADMIN}` }, payload: { role: 'bot' } })).json().url).searchParams.get('state');
      const [one, two] = [await state(), await state()];
      const results = await Promise.all([one, two].map(s => server.app.inject({ url: `/auth/callback?code=c&state=${s}` })));
      expect(results.map(result => result.statusCode)).toEqual([200, 200]);
      await server.twitchSettled();
      expect(sockets).toHaveLength(2);
      expect(sockets.filter(socket => !socket.closed)).toHaveLength(1);
    } finally {
      await server.shutdown();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('gives demo mode its own random admin token', async () => {
    const first = await buildDemoServer({});
    const second = await buildDemoServer({});
    try {
      expect(first.demoAdminToken).toMatch(/^[0-9a-f]{48}$/);
      expect(second.demoAdminToken).not.toBe(first.demoAdminToken);
      expect((await first.app.inject({ url: '/api/state' })).statusCode).toBe(401);
      expect((await first.app.inject({ url: '/api/state', headers: { authorization: `Bearer ${first.demoAdminToken}` } })).statusCode).toBe(200);
      expect((await first.app.inject({ url: '/overlay/a' })).statusCode).toBe(403);
    } finally {
      await first.shutdown();
      await second.shutdown();
    }
  });
});
