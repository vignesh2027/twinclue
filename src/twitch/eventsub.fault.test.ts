import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import { EventSubClient } from './eventsub.js';
import type { HelixApi } from './helix.js';
import { FakeEventSub, waitFor } from '../test/fake-eventsub.js';
import { GameController } from '../app/controller.js';
import { createChatRouter } from '../app/router.js';
import { sideHealth } from '../app/health.js';
import { Session, SessionStore } from '../game/session.js';
import { Metrics } from '../obs/metrics.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

const A = '10', B = '20', BOT = '30';
const ANSWERS = ['Paris', 'Rome', 'Vienna', 'Prague'];
const vocabularies = new Map([['fixture', ANSWERS.map(name => ({ name, aliases: [] }))]]);
const puzzle = { ...puzzleFixture, sourceTable: 'fixture' };

type Harness = Awaited<ReturnType<typeof harness>>;
const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function harness(options: { keepaliveSeconds?: number; session?: Session; store?: SessionStore; fake?: FakeEventSub; now?: () => number } = {}) {
  const fake = options.fake ?? await FakeEventSub.start(options.keepaliveSeconds ?? 10);
  if (!options.fake) cleanups.push(() => fake.close());
  const metrics = new Metrics();
  const subscribeCalls: any[] = [];
  const helix: HelixApi = { call: async (_method, _path, _role, body) => { subscribeCalls.push(body); return { status: 202, body: {}, headers: new Headers() }; } };
  // Consensus is disabled here so the round stays open for every injected fault.
  const controller = new GameController(options.session ?? new Session(), [puzzle], { vocabularies, metrics, store: options.store, cooldownMs: 0, consensus: { minVotes: Number.MAX_SAFE_INTEGER }, now: options.now });
  const client = new EventSubClient({
    channels: { a: A, b: B }, botUserId: BOT, helix, url: fake.url, metrics, backoffBaseMs: 20, keepaliveGraceMs: 200, random: () => 0.5,
    onChat: createChatRouter({ controller, broadcasterIds: { a: A, b: B }, metrics }),
    onStatus: status => controller.setHealth(sideHealth(status, { a: A, b: B })),
  });
  cleanups.push(() => { client.stop(); controller.close(); });
  client.connect();
  await waitFor(() => client.status().connected && client.status().subscriptions.every(sub => sub.status === 'enabled'), 5_000, 'first session');
  /** What the game must show: each viewer's latest vote, per side. */
  const expected = { A: new Map<string, string>(), B: new Map<string, string>() };
  const vote = (ws: WebSocket, side: 'A' | 'B', chatter: string, answer: string, messageId: string = randomUUID()) => {
    fake.chat(ws, { broadcaster: side === 'A' ? A : B, chatterId: chatter, text: `!g ${answer}`, messageId });
    expected[side].set(chatter, answer);
    return messageId;
  };
  return { fake, metrics, controller, client, subscribeCalls, expected, vote };
}

function tallies(h: Harness, side: 'A' | 'B') {
  const counts: Record<string, number> = {};
  for (const answer of h.expected[side].values()) counts[answer] = (counts[answer] ?? 0) + 1;
  return counts;
}
async function expectExact(h: Harness) {
  await waitFor(() => h.controller.activeRound!.voterCount('A') === h.expected.A.size && h.controller.activeRound!.voterCount('B') === h.expected.B.size, 5_000, 'votes to arrive');
  for (const side of ['A', 'B'] as const) {
    const shown = Object.fromEntries(h.controller.activeRound!.displayBuckets(side, 10).buckets.map(bucket => [bucket.answer, bucket.count]));
    expect(shown).toEqual(tallies(h, side));
    expect(h.controller.activeRound!.voterCount(side)).toBe(h.expected[side].size);
  }
}
const spread = (h: Harness, ws: WebSocket, prefix: string, count: number) => {
  for (let i = 0; i < count; i++) h.vote(ws, i % 2 ? 'A' : 'B', `${prefix}${i}`, ANSWERS[i % ANSWERS.length]!);
};

describe('EventSub fault injection against a local fake server', () => {
  it('reconnect mid-round: keeps the old socket until the new welcome, does not resubscribe, loses and doubles nothing', async () => {
    const h = await harness();
    h.controller.startRound();
    const old = h.fake.newest;
    spread(h, old, 'pre', 100);
    await expectExact(h);
    h.fake.reconnectWelcomeDelayMs = 150;
    h.fake.reconnect(old);
    await waitFor(() => h.client.openSockets === 2, 2_000, 'handoff socket');
    // Twitch keeps delivering on the old socket until the new one is welcomed.
    spread(h, old, 'during', 60);
    const overlap = Array.from({ length: 20 }, (_, i) => ({ chatter: `overlap${i}`, id: randomUUID() }));
    for (const { chatter, id } of overlap) h.vote(old, 'A', chatter, 'Paris', id);
    await waitFor(() => h.client.openSockets === 1 && h.fake.live.length === 1, 3_000, 'old socket closed after welcome');
    const fresh = h.fake.newest;
    expect(fresh).not.toBe(old);
    // The same notifications delivered again on the new socket are dropped as duplicates.
    for (const { chatter, id } of overlap) h.vote(fresh, 'A', chatter, 'Paris', id);
    spread(h, fresh, 'post', 100);
    await expectExact(h);
    expect(h.subscribeCalls).toHaveLength(8);
    expect(h.metrics.reconnects.get({ reason: 'session_reconnect' })).toBe(1);
    expect(h.metrics.duplicates.get({ reason: 'duplicate' })).toBe(20);
    expect(h.controller.activeRound?.status).toBe('active');
  });

  it('abrupt close: reconnects with backoff to the default URL (never the used reconnect URL) and resubscribes', async () => {
    const h = await harness();
    h.controller.startRound();
    h.fake.reconnect(h.fake.newest);
    await waitFor(() => h.client.openSockets === 1 && h.fake.connections.length === 2 && h.client.status().connected, 3_000, 'handoff');
    spread(h, h.fake.newest, 'a', 80);
    await expectExact(h);
    h.fake.abrupt(h.fake.newest);
    await waitFor(() => h.fake.connections.length === 3 && h.client.status().connected && h.subscribeCalls.length === 16, 5_000, 'fresh session');
    expect(h.fake.connections[2]!.path).toBe('/ws');
    expect(h.client.status().subscriptions.every(sub => sub.status === 'enabled')).toBe(true);
    // Viewers change their minds after the reconnect: still one vote each.
    for (let i = 0; i < 80; i += 4) h.vote(h.fake.newest, i % 2 ? 'A' : 'B', `a${i}`, 'Prague');
    spread(h, h.fake.newest, 'b', 40);
    await expectExact(h);
    expect(h.metrics.reconnects.get({ reason: 'close_1006' })).toBe(1);
  });

  it('keepalive timeout: a silent socket is dropped and replaced within the keepalive window', async () => {
    const h = await harness({ keepaliveSeconds: 1 });
    h.controller.startRound();
    const first = h.fake.newest;
    spread(h, first, 'k', 40);
    await expectExact(h);
    h.fake.silence(first);
    const started = Date.now();
    await waitFor(() => h.fake.connections.length === 2 && h.client.status().connected && h.subscribeCalls.length === 16, 5_000, 'replacement session');
    expect(Date.now() - started).toBeLessThan(2_500);
    expect(h.metrics.reconnects.get({ reason: 'keepalive_timeout' })).toBe(1);
    spread(h, h.fake.newest, 'k2', 40);
    await expectExact(h);
  });

  it('duplicate notifications: the same message id is counted once', async () => {
    const h = await harness();
    h.controller.startRound();
    const ws = h.fake.newest;
    for (let i = 0; i < 30; i++) {
      const id = randomUUID();
      const envelope = randomUUID();
      const chat = { broadcaster: A, chatterId: `d${i}`, text: '!g Rome', messageId: id };
      for (let copy = 0; copy < 3; copy++) ws.send(FakeEventSub.chatFrame(chat, copy === 2 ? randomUUID() : envelope));
      h.expected.A.set(`d${i}`, 'Rome');
    }
    await expectExact(h);
    expect(h.metrics.duplicates.get({ reason: 'duplicate' })).toBe(60);
    expect(h.metrics.messagesIn.get({ side: 'a' })).toBe(30);
  });

  it('Shared Chat double delivery: each message counts once, for its source community, and third channels are ignored', async () => {
    const h = await harness();
    h.controller.startRound();
    const ws = h.fake.newest;
    for (let i = 0; i < 50; i++) {
      const fromA = i % 2 === 0;
      const source = fromA ? A : B;
      const other = fromA ? B : A;
      const id = randomUUID();
      const answer = ANSWERS[i % 3]!;
      h.fake.chat(ws, { broadcaster: source, chatterId: `s${i}`, text: `!g ${answer}`, messageId: id });
      h.fake.chat(ws, { broadcaster: other, source, chatterId: `s${i}`, text: `!g ${answer}`, messageId: randomUUID(), sourceMessageId: id });
      h.expected[fromA ? 'A' : 'B'].set(`s${i}`, answer);
    }
    h.fake.chat(ws, { broadcaster: A, source: '99', chatterId: 'outsider', text: '!g Paris', messageId: randomUUID(), sourceMessageId: randomUUID() });
    await expectExact(h);
    expect(h.metrics.duplicates.get({ reason: 'shared_chat_copy' })).toBe(50);
    expect(h.metrics.duplicates.get({ reason: 'foreign_channel' })).toBe(1);
    // A moderator of channel B locks the round from inside the shared chat: one lock, through source_badges.
    const lockId = randomUUID();
    h.fake.chat(ws, { broadcaster: B, chatterId: 'modb', text: '!tc lock', messageId: lockId, badges: [{ set_id: 'moderator' }] });
    h.fake.chat(ws, { broadcaster: A, source: B, chatterId: 'modb', text: '!tc lock', messageId: randomUUID(), sourceMessageId: lockId, badges: [{ set_id: 'moderator' }] });
    await waitFor(() => h.controller.activeRound?.status !== 'active', 2_000, 'lock');
    expect(h.controller.session.scoreboard.rounds).toBe(1);
  });

  it('revocation: the panel says which channel to re-authorise and the other side keeps counting', async () => {
    const h = await harness();
    h.controller.startRound();
    const ws = h.fake.newest;
    h.fake.revoke(ws, 'channel.chat.message', B);
    await waitFor(() => h.controller.panelState().health.b.reauthorize, 2_000, 'revocation');
    expect(h.controller.panelState().health.b.error).toMatch(/Re-authorise channel B/);
    expect(h.controller.panelState().health.b.subscribed).toBe(false);
    expect(h.controller.panelState().health.a.subscribed).toBe(true);
    h.vote(ws, 'A', 'r1', 'Vienna');
    h.vote(ws, 'A', 'r2', 'Rome');
    await expectExact(h);
  });

  it('restart mid-round: votes and the real end time survive, and replayed notifications are not doubled', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tc-restart-'));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const fake = await FakeEventSub.start();
    cleanups.push(() => fake.close());
    const store = new SessionStore(join(dir, 'session.json'));
    const first = await harness({ fake, store });
    first.controller.setSettings({ roundLengthSeconds: 300 });
    const round = first.controller.startRound();
    const endsAt = round.endsAt!;
    const replay: Array<{ side: 'A' | 'B'; chatter: string; answer: string; id: string }> = [];
    for (let i = 0; i < 120; i++) {
      const side = i % 2 ? 'A' : 'B';
      const answer = ANSWERS[i % 4]!;
      replay.push({ side, chatter: `p${i}`, answer, id: first.vote(fake.newest, side, `p${i}`, answer) });
    }
    await expectExact(first);
    await store.now(first.controller.session);
    first.client.stop();
    first.controller.close();
    await waitFor(() => fake.live.length === 0, 2_000, 'old process gone');

    const session = await new SessionStore(join(dir, 'session.json')).load();
    const second = await harness({ fake, session });
    expect(second.controller.activeRound?.endsAt).toBe(endsAt);
    for (const item of replay.slice(0, 40)) second.vote(fake.newest, item.side, item.chatter, item.answer, item.id);
    for (const item of replay) second.expected[item.side].set(item.chatter, item.answer);
    spread(second, fake.newest, 'q', 30);
    await expectExact(second);
  });
});
