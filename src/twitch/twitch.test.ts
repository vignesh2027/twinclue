import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { TokenStore, registerAuthRoutes } from './auth.js';
import { DedupeCache, EventSubClient, parseChatEvent, type SocketLike } from './eventsub.js';
import { ChatSender } from './chat.js';
import { TwitchHelix, type HelixApi, type HelixResponse } from './helix.js';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
async function withDir(run: (dir: string) => Promise<void>) { const dir = await mkdtemp(join(tmpdir(), 'tc-twitch-')); try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); } }
const helixReply = (status: number, body: unknown = {}, headers: Record<string, string> = {}): HelixResponse => ({ status, body, headers: new Headers(headers) });

describe('tokens', () => {
  it('writes tokens.json with mode 0600 and shares one refresh between concurrent callers', () => withDir(async dir => {
    const path = join(dir, 'tokens.json');
    const fetcher = vi.fn(async () => json({ access_token: 'new', refresh_token: 'r2', expires_in: 3600, scope: ['user:read:chat'], token_type: 'bearer' }));
    const store = new TokenStore({ path, clientId: 'id', clientSecret: 'secret', fetcher: fetcher as typeof fetch, now: () => 1000 });
    await store.put('bot', { access_token: 'old', refresh_token: 'r1', expires_at: 0, scope: [], token_type: 'bearer' });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const [one, two] = await Promise.all([store.valid('bot'), store.valid('bot')]);
    expect(one.access_token).toBe('new');
    expect(two.access_token).toBe('new');
    expect(fetcher).toHaveBeenCalledOnce();
    const loaded = new TokenStore({ path, clientId: 'id', clientSecret: 'secret' });
    await loaded.load();
    expect(loaded.get('bot')?.refresh_token).toBe('r2');
  }));

  it('tightens an existing token file to 0600 on load', () => withDir(async dir => {
    const path = join(dir, 'tokens.json');
    await writeFile(path, JSON.stringify({ bot: { access_token: 'a', refresh_token: 'r', expires_at: 0, scope: [], token_type: 'bearer' } }), { mode: 0o644 });
    await new TokenStore({ path, clientId: 'id', clientSecret: 's' }).load();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  }));

  it('validates with /oauth2/validate and refreshes once on 401', () => withDir(async dir => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      calls.push(target);
      if (target.endsWith('/validate')) return String((init?.headers as Record<string, string>).authorization).endsWith('fresh') ? json({ login: 'bot', user_id: '9', scopes: [], expires_in: 100 }) : json({}, 401);
      return json({ access_token: 'fresh', refresh_token: 'r2', expires_in: 3600, token_type: 'bearer' });
    });
    const store = new TokenStore({ path: join(dir, 't.json'), clientId: 'id', clientSecret: 's', fetcher: fetcher as typeof fetch });
    await store.put('bot', { access_token: 'stale', refresh_token: 'r1', expires_at: Date.now() + 3_600_000, scope: [], token_type: 'bearer' });
    const identity = await store.validate('bot');
    expect(identity?.userId).toBe('9');
    expect(store.status.bot.valid).toBe(true);
    expect(calls.filter(url => url.endsWith('/token'))).toHaveLength(1);
  }));

  it('refuses an OAuth callback from the wrong Twitch account and expires states', () => withDir(async dir => {
    const app = Fastify();
    const store = new TokenStore({ path: join(dir, 't.json'), clientId: 'id', clientSecret: 's' });
    let now = 0;
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith('/validate') ? json({ login: 'someoneelse', user_id: '7', scopes: [], expires_in: 100 }) : json({ access_token: 'x', refresh_token: 'y', expires_in: 3600, scope: [], token_type: 'bearer' }));
    registerAuthRoutes(app, { clientId: 'id', clientSecret: 's', publicUrl: 'https://tc.example', store, fetcher: fetcher as typeof fetch, now: () => now, expectedLogin: () => 'sickoncode', requireAdmin: async () => undefined });
    const state = (body: string) => new URL(JSON.parse(body).url).searchParams.get('state');
    const first = state((await app.inject({ method: 'POST', url: '/auth/start', payload: { role: 'bot' } })).body);
    const wrong = await app.inject({ url: `/auth/callback?code=c&state=${first}` });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.body).toContain('Wrong Twitch account');
    expect(store.get('bot')).toBeUndefined();
    const second = state((await app.inject({ method: 'POST', url: '/auth/start', payload: { role: 'bot' } })).body);
    now += 10 * 60_000 + 1;
    expect((await app.inject({ url: `/auth/callback?code=c&state=${second}` })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/auth/start', payload: { role: 'a' } })).statusCode).toBe(400);
    await app.close();
  }));
});

describe('helix', () => {
  it('refreshes once on 401 and retries 5xx with backoff', async () => {
    const statuses = [401, 503, 200];
    const fetcher = vi.fn(async () => json({ data: [{ id: '5' }] }, statuses.shift() ?? 200));
    const tokens = { valid: vi.fn(async () => ({ access_token: 't' })), refresh: vi.fn(async () => ({ access_token: 't2' })) };
    const helix = new TwitchHelix({ clientId: 'id', tokens: tokens as never, fetcher: fetcher as typeof fetch, sleep: async () => undefined });
    expect(await helix.userId('x', 'bot')).toBe('5');
    expect(tokens.refresh).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('chat sender', () => {
  function sender(reply: () => HelixResponse, shared = false) {
    let clock = 0;
    const posts: Array<{ at: number; body: any }> = [];
    const helix: HelixApi = { call: async (_method, _path, _role, body) => { posts.push({ at: clock, body }); return reply(); } };
    const chat = new ChatSender({ helix, botUserId: 'bot', channels: { a: '1', b: '2' }, sharedChat: () => shared, now: () => clock, sleep: async ms => { clock += ms; } });
    return { chat, posts, advance: (ms: number) => { clock += ms; } };
  }
  const ok = () => helixReply(200, { data: [{ message_id: 'm', is_sent: true }] });

  it('keeps 1 per second per channel and 20 per 30 seconds for the bot user', async () => {
    const { chat, posts } = sender(ok);
    await Promise.all(Array.from({ length: 20 }, (_, i) => chat.send(i % 2 ? 'a' : 'b', `m${i}`)));
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => chat.send(i % 2 ? 'a' : 'b', `late${i}`)));
    expect(results.every(Boolean)).toBe(true);
    for (let i = 0; i < posts.length; i++) {
      const window = posts.filter(post => post.at > posts[i]!.at - 30_000 && post.at <= posts[i]!.at);
      expect(window.length).toBeLessThanOrEqual(20);
      const sameChannel = posts.slice(0, i).filter(post => post.body.broadcaster_id === posts[i]!.body.broadcaster_id).at(-1);
      if (sameChannel) expect(posts[i]!.at - sameChannel.at).toBeGreaterThanOrEqual(1000);
    }
    expect(posts.at(-1)!.at).toBeGreaterThanOrEqual(30_000);
  });

  it('treats is_sent false as a failure', async () => {
    const { chat } = sender(() => helixReply(200, { data: [{ message_id: '', is_sent: false, drop_reason: { code: 'msg_duplicate', message: 'dup' } }] }));
    expect(await chat.send('a', 'hello')).toBe(false);
  });

  it('waits for Ratelimit-Reset after a 429 and then sends', async () => {
    let first = true;
    const { chat, posts } = sender(() => { if (first) { first = false; return helixReply(429, {}, { 'ratelimit-reset': '12' }); } return ok(); });
    expect(await chat.send('a', 'hello')).toBe(true);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.at).toBeGreaterThanOrEqual(12_000);
  });

  it('sends once when Shared Chat joins both channels, and to both otherwise', async () => {
    const shared = sender(ok, true);
    await shared.chat.send('both', 'Round started');
    expect(shared.posts).toHaveLength(1);
    const separate = sender(ok, false);
    await separate.chat.send('both', 'Round started');
    expect(separate.posts.map(post => post.body.broadcaster_id)).toEqual(['1', '2']);
  });
});

class FakeSocket implements SocketLike {
  listeners = new Map<string, Array<(...args: any[]) => void>>();
  closed = false;
  on(event: string, listener: (...args: any[]) => void): this { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  send(): void {}
  close(): void { this.closed = true; for (const fn of this.listeners.get('close') ?? []) fn(1000); }
  emit(event: string, data: unknown): void { for (const fn of this.listeners.get(event) ?? []) fn(data); }
}

describe('eventsub unit', () => {
  it('attributes Shared Chat messages to their source channel and dedupes on source_message_id', () => {
    const own = parseChatEvent({ broadcaster_user_id: '10', chatter_user_id: '7', chatter_user_name: 'sam', message_id: 'm1', source_message_id: null, message: { text: '!g x' }, badges: [{ set_id: 'moderator' }] }, { a: '10', b: '20' });
    expect(own).toMatchObject({ side: 'a', userId: '7', dedupeKey: 'm1', badges: [{ set_id: 'moderator' }] });
    const copy = parseChatEvent({ broadcaster_user_id: '20', source_broadcaster_user_id: '10', chatter_user_id: '7', message_id: 'other-id', source_message_id: 'm1', message: { text: '!g x' }, badges: [], source_badges: [{ set_id: 'moderator' }] }, { a: '10', b: '20' });
    expect(copy).toMatchObject({ side: 'a', dedupeKey: 'm1', badges: [{ set_id: 'moderator' }] });
    expect(parseChatEvent({ broadcaster_user_id: '20', source_broadcaster_user_id: '30', chatter_user_id: '7', message_id: 'z', message: { text: '!g x' } }, { a: '10', b: '20' })).toBeUndefined();
  });

  it('bounds the dedupe cache and forgets ids after the window', () => {
    const cache = new DedupeCache(3, 1000);
    expect(cache.seen('a', 0)).toBe(false);
    expect(cache.seen('a', 10)).toBe(true);
    for (const key of ['b', 'c', 'd']) cache.seen(key, 20);
    expect(cache.size).toBe(3);
    expect(cache.seen('a', 30)).toBe(false);
    expect(cache.seen('b', 2000)).toBe(false);
  });

  it('subscribes once per spec right after welcome, survives failures, and never rejects', async () => {
    const sockets: FakeSocket[] = [];
    const calls: any[] = [];
    const helix: HelixApi = {
      call: async (_method, _path, _role, body: any) => {
        calls.push(body);
        if (body.type === 'channel.shared_chat.update') throw new Error('network down');
        if (body.type === 'channel.shared_chat.end' && body.condition.broadcaster_user_id === '20') return helixReply(403, { message: 'missing scope' });
        return helixReply(body.type === 'channel.shared_chat.begin' ? 409 : 202);
      },
    };
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const client = new EventSubClient({ channels: { a: '10', b: '20' }, botUserId: '30', helix, socketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; } });
    client.connect();
    sockets[0]!.emit('message', JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 's1', keepalive_timeout_seconds: 10 } } }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(calls).toHaveLength(8);
    expect(calls.every(call => call.transport.session_id === 's1')).toBe(true);
    expect(calls.filter(call => call.type === 'channel.chat.message').map(call => call.condition)).toEqual([{ broadcaster_user_id: '10', user_id: '30' }, { broadcaster_user_id: '20', user_id: '30' }]);
    const status = client.status();
    expect(status.subscriptions.filter(sub => sub.status === 'enabled')).toHaveLength(5);
    expect(status.subscriptions.find(sub => sub.type === 'channel.shared_chat.end' && sub.side === 'b')).toMatchObject({ status: 'failed', reauthorize: true });
    client.stop();
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('subscribes only the configured side when channel B is missing', async () => {
    const calls: any[] = [];
    const socket = new FakeSocket();
    const client = new EventSubClient({ channels: { a: '10' }, botUserId: '30', helix: { call: async (_m, _p, _r, body) => { calls.push(body); return helixReply(202); } }, socketFactory: () => socket });
    client.connect();
    socket.emit('message', JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 's', keepalive_timeout_seconds: 10 } } }));
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(calls.map(call => call.condition.broadcaster_user_id)).toEqual(['10', '10', '10', '10']);
    client.stop();
  });

  it('backs off exponentially with jitter up to 30 seconds', () => {
    const low = new EventSubClient({ channels: {}, botUserId: '1', helix: { call: async () => helixReply(202) }, random: () => 0 });
    const high = new EventSubClient({ channels: {}, botUserId: '1', helix: { call: async () => helixReply(202) }, random: () => 1 });
    expect([0, 1, 2, 3].map(attempt => low.backoffDelay(attempt))).toEqual([500, 1000, 2000, 4000]);
    expect(high.backoffDelay(2)).toBe(4000);
    expect(high.backoffDelay(20)).toBe(30_000);
    expect(low.backoffDelay(20)).toBe(15_000);
  });
});
