import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer } from '../server.js';
import { overlayKeys } from '../app/web.js';
import type { SocketLike } from '../twitch/eventsub.js';

const SECRETS = {
  admin: 'admin-secret-ADMIN-0123456789abcdef', clientSecret: 'client-secret-CS-98765', access: 'access-token-AT-55555', refresh: 'refresh-token-RT-44444',
  freshAccess: 'fresh-access-FA-33333', freshRefresh: 'fresh-refresh-FR-22222', oauthCode: 'oauth-code-OC-11111',
};

describe('structured logs', () => {
  it('never contain tokens, the client secret, overlay keys or OAuth codes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tc-log-'));
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
    await writeFile(join(dir, 'tokens.json'), JSON.stringify({ bot: { access_token: SECRETS.access, refresh_token: SECRETS.refresh, expires_at: 0, scope: [], token_type: 'bearer' } }));
    let validateCalls = 0;
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      const body = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
      if (target.endsWith('/oauth2/token')) return body({ access_token: SECRETS.freshAccess, refresh_token: SECRETS.freshRefresh, expires_in: 3600, scope: [], token_type: 'bearer' });
      if (target.endsWith('/oauth2/validate')) return ++validateCalls === 1 ? body({}, 401) : body({ login: 'hostbot', user_id: '30', scopes: [], expires_in: 3600 });
      if (target.includes('/helix/users')) return body({ data: [{ id: target.includes('login=chana') ? '10' : '20' }] });
      if (target.includes('/eventsub/subscriptions')) return body({ message: `bad request ${String(init?.body)}` }, 400);
      return body({}, 404);
    }) as typeof fetch;
    const socket: SocketLike = { on() { return this; }, send() {}, close() {} };
    const server = await buildServer({ TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: SECRETS.clientSecret, PUBLIC_URL: 'https://tc.example', CHANNEL_A: 'chana', CHANNEL_B: 'chanb', BOT_LOGIN: 'hostbot', ADMIN_TOKEN: SECRETS.admin },
      { logStream: stream, sessionPath: join(dir, 'session.json'), tokenPath: join(dir, 'tokens.json'), fetcher, socketFactory: () => socket, pack: [] });
    try {
      const keys = overlayKeys(SECRETS.admin);
      await server.app.inject({ url: `/overlay/a?k=${keys.a}` });
      await server.app.inject({ url: `/overlay/b?k=${keys.b}` });
      await server.app.inject({ url: '/api/state', headers: { authorization: `Bearer ${SECRETS.admin}` } });
      await server.app.inject({ url: '/api/state', headers: { authorization: 'Bearer wrong-guess' } });
      await server.app.inject({ url: `/auth/callback?code=${SECRETS.oauthCode}&state=unknown` });
      server.app.log.info({ token: SECRETS.access, nested: { access_token: SECRETS.access, refresh_token: SECRETS.refresh, client_secret: SECRETS.clientSecret } }, 'deliberate attempt to log secrets');
      const output = lines.join('');
      expect(output.length).toBeGreaterThan(200);
      expect(output).toContain('/overlay/a?[redacted]');
      for (const [name, secret] of Object.entries(SECRETS)) expect(output.includes(secret), `${name} leaked into logs`).toBe(false);
      for (const key of Object.values(keys)) expect(output).not.toContain(key);
      for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
    } finally {
      await server.shutdown();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
