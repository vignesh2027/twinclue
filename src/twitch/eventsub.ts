import WebSocket from 'ws';
import { silentLog, type Log } from '../obs/log.js';
import type { Metrics } from '../obs/metrics.js';
import type { HelixApi } from './helix.js';

export type Side = 'a' | 'b';
export interface ParsedChat {
  side: Side; userId: string; userLogin: string; userName: string; text: string; badges: Array<{ set_id: string }>;
  /** source_message_id ?? message_id: identical for every copy of one Shared Chat message. */
  dedupeKey: string; sourceChannel: string; receivingChannel: string; receivedAt: number;
}
export interface SocketLike {
  on(event: string, listener: (...args: any[]) => void): this;
  send(data: string): void;
  close(code?: number): void;
  terminate?(): void;
}
export type SocketFactory = (url: string) => SocketLike;
export type SubscriptionStatus = 'pending' | 'enabled' | 'failed' | 'revoked';
export interface SubscriptionState { type: string; side: Side; status: SubscriptionStatus; error?: string; reauthorize?: boolean }
export interface EventSubStatus { connected: boolean; subscriptions: SubscriptionState[]; lastError: string | null; lastCloseCode: number | null; reconnecting: boolean }

export interface EventSubConfig {
  /** Broadcaster user ids. A missing side is simply not subscribed; it never blocks the other side. */
  channels: Partial<Record<Side, string>>;
  botUserId: string;
  helix: HelixApi;
  url?: string;
  socketFactory?: SocketFactory;
  onChat?: (chat: ParsedChat) => void;
  onShared?: (type: string, event: any) => void;
  onStatus?: (status: EventSubStatus) => void;
  log?: Log;
  metrics?: Metrics;
  random?: () => number;
  backoffBaseMs?: number;
  backoffCapMs?: number;
  keepaliveGraceMs?: number;
  welcomeTimeoutMs?: number;
  dedupeCapacity?: number;
  dedupeTtlMs?: number;
  maxAgeMs?: number;
}

export const DEFAULT_EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws';
export const CLOSE_CODES: Record<number, string> = {
  4000: 'Twitch internal server error', 4001: 'client sent inbound traffic', 4002: 'client failed ping-pong', 4003: 'connection unused (no subscription within 10 seconds)',
  4004: 'reconnect grace time expired', 4005: 'network timeout', 4006: 'network error', 4007: 'invalid reconnect URL',
};

/**
 * Bounded set of recently seen ids with expiry. A ring buffer holds ids in arrival order (which is also expiry
 * order, since the window is fixed) and a Map answers lookups, so every operation is O(1) and nothing iterates
 * the Map.
 */
export class DedupeCache {
  private readonly expiries = new Map<string, number>();
  private readonly ringKeys: string[];
  private readonly ringExpiry: Float64Array;
  private head = 0;
  private count = 0;
  constructor(private readonly capacity = 50_000, private readonly ttlMs = 10 * 60_000) {
    this.ringKeys = new Array<string>(capacity);
    this.ringExpiry = new Float64Array(capacity);
  }
  /** True when the key was already seen within the window; otherwise records it. */
  seen(key: string, now = Date.now()): boolean {
    while (this.count && this.ringExpiry[this.head]! <= now) this.evictHead();
    const expiry = this.expiries.get(key);
    if (expiry !== undefined && expiry > now) return true;
    if (this.count === this.capacity) this.evictHead();
    const slot = (this.head + this.count) % this.capacity;
    this.ringKeys[slot] = key;
    this.ringExpiry[slot] = now + this.ttlMs;
    this.count++;
    this.expiries.set(key, now + this.ttlMs);
    return false;
  }
  private evictHead(): void {
    const key = this.ringKeys[this.head]!;
    if (this.expiries.get(key) === this.ringExpiry[this.head]) this.expiries.delete(key);
    this.head = (this.head + 1) % this.capacity;
    this.count--;
  }
  get size(): number { return this.count; }
}

/** Maps a channel.chat.message event to a side by its SOURCE channel, so Shared Chat messages count for their own community. */
export function parseChatEvent(event: any, channels: Partial<Record<Side, string>>, receivedAt = 0): ParsedChat | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const source = String(event.source_broadcaster_user_id ?? event.broadcaster_user_id ?? '');
  const side: Side | undefined = source && source === channels.a ? 'a' : source && source === channels.b ? 'b' : undefined;
  const messageId = event.source_message_id ?? event.message_id;
  if (!side || !event.chatter_user_id || !messageId) return undefined;
  const badges = (event.source_broadcaster_user_id ? event.source_badges : event.badges) ?? [];
  return {
    side, userId: String(event.chatter_user_id), userLogin: String(event.chatter_user_login ?? ''), userName: String(event.chatter_user_name ?? event.chatter_user_login ?? 'viewer'),
    text: typeof event.message?.text === 'string' ? event.message.text : '', badges: Array.isArray(badges) ? badges : [],
    dedupeKey: String(messageId), sourceChannel: source, receivingChannel: String(event.broadcaster_user_id ?? ''), receivedAt,
  };
}

interface Connection { socket: SocketLike; kind: 'fresh' | 'handoff'; welcomed: boolean; retired: boolean; sessionId?: string; keepaliveMs: number; timer?: ReturnType<typeof setTimeout> }

/**
 * One bot-token WebSocket carrying chat and Shared Chat for both channels. Twitch refuses subscriptions from
 * different users on one session, so no broadcaster token is ever used here.
 */
export class EventSubClient {
  private current?: Connection;
  private handoff?: Connection;
  private stopped = true;
  private attempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly subscriptions = new Map<string, SubscriptionState>();
  private readonly dedupe: DedupeCache;
  private lastError: string | null = null;
  private lastCloseCode: number | null = null;
  private readonly log: Log;

  constructor(private readonly config: EventSubConfig) {
    this.dedupe = new DedupeCache(config.dedupeCapacity, config.dedupeTtlMs);
    this.log = config.log ?? silentLog;
    for (const spec of this.specs()) this.subscriptions.set(this.subKey(spec.type, spec.side), { type: spec.type, side: spec.side, status: 'pending' });
  }

  connect(): void {
    this.stopped = false;
    this.current = this.open(this.config.url ?? DEFAULT_EVENTSUB_URL, 'fresh');
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    for (const connection of [this.current, this.handoff]) if (connection) this.retire(connection);
    this.current = this.handoff = undefined;
    this.emitStatus();
  }

  status(): EventSubStatus {
    return { connected: Boolean(this.current?.welcomed), subscriptions: [...this.subscriptions.values()].map(sub => ({ ...sub })), lastError: this.lastError,
      lastCloseCode: this.lastCloseCode, reconnecting: Boolean(this.reconnectTimer || this.handoff || (this.current && !this.current.welcomed)) };
  }

  /** Test and diagnostics hook: how many sockets this client currently holds open. */
  get openSockets(): number { return [this.current, this.handoff].filter(Boolean).length; }

  private specs(): Array<{ type: string; side: Side; condition: Record<string, string> }> {
    const out: Array<{ type: string; side: Side; condition: Record<string, string> }> = [];
    for (const side of ['a', 'b'] as const) {
      const id = this.config.channels[side];
      if (!id) continue;
      out.push({ type: 'channel.chat.message', side, condition: { broadcaster_user_id: id, user_id: this.config.botUserId } });
      for (const type of ['channel.shared_chat.begin', 'channel.shared_chat.update', 'channel.shared_chat.end']) out.push({ type, side, condition: { broadcaster_user_id: id } });
    }
    return out;
  }
  private subKey(type: string, side: Side): string { return `${type}|${side}`; }

  private open(url: string, kind: Connection['kind']): Connection {
    const factory = this.config.socketFactory ?? ((address: string) => new WebSocket(address) as unknown as SocketLike);
    const connection: Connection = { socket: factory(url), kind, welcomed: false, retired: false, keepaliveMs: 0 };
    connection.socket.on('message', (data: unknown) => this.onMessage(connection, data));
    connection.socket.on('close', (code?: number) => this.onClose(connection, typeof code === 'number' ? code : 1006));
    connection.socket.on('error', (error: unknown) => {
      this.lastError = `EventSub socket error: ${error instanceof Error ? error.message : String(error)}`;
      this.log.warn({ event: 'eventsub_socket_error', kind, reason: this.lastError }, 'EventSub socket error.');
    });
    this.armTimer(connection, this.config.welcomeTimeoutMs ?? 15_000, 'welcome_timeout');
    return connection;
  }

  private armTimer(connection: Connection, ms: number, reason: string): void {
    if (connection.timer) clearTimeout(connection.timer);
    connection.timer = setTimeout(() => this.onSilence(connection, reason), ms);
  }

  /** No welcome, keepalive or notification within the keepalive window: the connection is dead even if TCP has not noticed. */
  private onSilence(connection: Connection, reason: string): void {
    if (connection.retired) return;
    this.lastError = reason === 'keepalive_timeout' ? 'EventSub keepalive timed out; reconnecting.' : 'EventSub did not send a welcome in time; reconnecting.';
    this.log.warn({ event: 'eventsub_silence', reason, kind: connection.kind }, this.lastError);
    this.retire(connection);
    if (connection === this.handoff) { this.handoff = undefined; if (!this.current) this.scheduleReconnect(reason); return; }
    if (connection === this.current) { this.current = undefined; this.emitStatus(); if (!this.handoff) this.scheduleReconnect(reason); }
  }

  private retire(connection: Connection): void {
    connection.retired = true;
    if (connection.timer) clearTimeout(connection.timer);
    try { if (connection.socket.terminate) connection.socket.terminate(); else connection.socket.close(); } catch { /* already closed */ }
  }

  private onClose(connection: Connection, code: number): void {
    if (connection.timer) clearTimeout(connection.timer);
    if (connection.retired) return;
    connection.retired = true;
    this.lastCloseCode = code;
    const meaning = CLOSE_CODES[code] ?? (code === 1000 ? 'normal closure' : code === 1006 ? 'connection dropped' : 'unexpected close');
    this.lastError = `EventSub closed (${code}: ${meaning}).`;
    this.log.warn({ event: 'eventsub_closed', code, meaning, kind: connection.kind }, this.lastError);
    if (connection === this.handoff) { this.handoff = undefined; if (!this.current) this.scheduleReconnect(`close_${code}`); return; }
    if (connection !== this.current) return;
    this.current = undefined;
    this.emitStatus();
    // During a handoff the new socket takes over when its welcome arrives; only reconnect if nothing is pending.
    if (!this.handoff) this.scheduleReconnect(`close_${code}`);
  }

  /** Exponential backoff with jitter, capped at 30 seconds; the attempt counter resets on every welcome. */
  backoffDelay(attempt: number): number {
    const cap = this.config.backoffCapMs ?? 30_000;
    const exponential = Math.min(cap, (this.config.backoffBaseMs ?? 1_000) * 2 ** attempt);
    return Math.round(exponential / 2 + (this.config.random ?? Math.random)() * exponential / 2);
  }

  private scheduleReconnect(reason: string): void {
    if (this.stopped || this.reconnectTimer) return;
    this.config.metrics?.reconnects.inc({ reason });
    const delay = this.backoffDelay(this.attempt++);
    this.log.info({ event: 'eventsub_reconnect_scheduled', reason, delayMs: delay, attempt: this.attempt }, 'EventSub reconnect scheduled.');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.stopped) return;
      // A fresh session always starts from the default URL; a reconnect_url is single use.
      this.current = this.open(this.config.url ?? DEFAULT_EVENTSUB_URL, 'fresh');
    }, delay);
    this.emitStatus();
  }

  private onMessage(connection: Connection, data: unknown): void {
    if (connection.retired) return;
    const receivedAt = performance.now();
    let message: any;
    try { message = JSON.parse(typeof data === 'string' ? data : String(data)); } catch {
      this.log.warn({ event: 'eventsub_bad_json' }, 'EventSub sent a message that is not JSON.');
      return;
    }
    const type = message?.metadata?.message_type;
    if (connection.keepaliveMs) this.armTimer(connection, connection.keepaliveMs + (this.config.keepaliveGraceMs ?? 2_000), 'keepalive_timeout');
    switch (type) {
      case 'session_welcome': return this.onWelcome(connection, message);
      case 'session_keepalive': return;
      case 'session_reconnect': return this.onReconnect(connection, message);
      case 'notification': return this.onNotification(message, receivedAt);
      case 'revocation': return this.onRevocation(message);
      default: return;
    }
  }

  private onWelcome(connection: Connection, message: any): void {
    const session = message?.payload?.session;
    connection.welcomed = true;
    connection.sessionId = session?.id;
    connection.keepaliveMs = Math.max(1, Number(session?.keepalive_timeout_seconds ?? 10)) * 1000;
    this.armTimer(connection, connection.keepaliveMs + (this.config.keepaliveGraceMs ?? 2_000), 'keepalive_timeout');
    this.attempt = 0;
    this.lastError = null;
    if (connection === this.handoff) {
      // Handoff complete: subscriptions carried over, so only now is the old socket closed.
      const old = this.current;
      this.current = connection;
      this.handoff = undefined;
      if (old) this.retire(old);
      this.config.metrics?.reconnects.inc({ reason: 'session_reconnect' });
      this.log.info({ event: 'eventsub_handoff_complete' }, 'EventSub reconnect handoff complete.');
      this.emitStatus();
      return;
    }
    if (connection !== this.current) { this.retire(connection); return; }
    this.log.info({ event: 'eventsub_welcome' }, 'EventSub session started.');
    this.emitStatus();
    void this.subscribeAll(connection);
  }

  private onReconnect(connection: Connection, message: any): void {
    const url = message?.payload?.session?.reconnect_url;
    if (connection !== this.current || this.handoff || typeof url !== 'string') return;
    this.log.info({ event: 'eventsub_reconnect_requested' }, 'Twitch asked for an EventSub reconnect; opening the new socket before closing the old one.');
    this.handoff = this.open(url, 'handoff');
    this.emitStatus();
  }

  private onNotification(message: any, receivedAt: number): void {
    const subscriptionType = message?.payload?.subscription?.type;
    const event = message?.payload?.event;
    const timestamp = Date.parse(message?.metadata?.message_timestamp ?? '');
    if (Number.isFinite(timestamp) && Date.now() - timestamp > (this.config.maxAgeMs ?? 10 * 60_000)) {
      this.config.metrics?.duplicates.inc({ reason: 'stale' });
      return;
    }
    if (subscriptionType === 'channel.chat.message') {
      const chat = parseChatEvent(event, this.config.channels, receivedAt);
      if (!chat) { this.config.metrics?.duplicates.inc({ reason: 'foreign_channel' }); return; }
      if (this.dedupe.seen(`chat:${chat.dedupeKey}`)) {
        this.config.metrics?.duplicates.inc({ reason: chat.sourceChannel !== chat.receivingChannel ? 'shared_chat_copy' : 'duplicate' });
        return;
      }
      this.config.onChat?.(chat);
      return;
    }
    const id = message?.metadata?.message_id;
    if (id && this.dedupe.seen(`meta:${id}`)) { this.config.metrics?.duplicates.inc({ reason: 'duplicate' }); return; }
    if (typeof subscriptionType === 'string' && subscriptionType.startsWith('channel.shared_chat.')) this.config.onShared?.(subscriptionType, event);
  }

  private onRevocation(message: any): void {
    const subscription = message?.payload?.subscription;
    const broadcaster = String(subscription?.condition?.broadcaster_user_id ?? '');
    const side: Side | undefined = broadcaster === this.config.channels.a ? 'a' : broadcaster === this.config.channels.b ? 'b' : undefined;
    if (!side || typeof subscription?.type !== 'string') return;
    const error = `Twitch revoked ${subscription.type} for channel ${side.toUpperCase()} (${subscription.status ?? 'revoked'}). Re-authorise channel ${side.toUpperCase()}.`;
    this.subscriptions.set(this.subKey(subscription.type, side), { type: subscription.type, side, status: 'revoked', error, reauthorize: true });
    this.lastError = error;
    this.log.warn({ event: 'eventsub_revoked', type: subscription.type, side, status: subscription.status }, error);
    this.emitStatus();
  }

  /** All subscriptions go out in parallel right after the welcome, well inside Twitch's 10 second window. */
  private async subscribeAll(connection: Connection): Promise<void> {
    await Promise.allSettled(this.specs().map(spec => this.subscribeOne(connection, spec)));
    this.emitStatus();
  }

  private async subscribeOne(connection: Connection, spec: { type: string; side: Side; condition: Record<string, string> }): Promise<void> {
    const key = this.subKey(spec.type, spec.side);
    this.subscriptions.set(key, { type: spec.type, side: spec.side, status: 'pending' });
    let state: SubscriptionState;
    try {
      const response = await this.config.helix.call('POST', '/eventsub/subscriptions', 'bot', { type: spec.type, version: '1', condition: spec.condition, transport: { method: 'websocket', session_id: connection.sessionId } });
      if (response.status === 202 || response.status === 409) state = { type: spec.type, side: spec.side, status: 'enabled' };
      else {
        const detail = (response.body as { message?: string } | undefined)?.message ?? 'no detail';
        const auth = response.status === 401 || response.status === 403;
        state = { type: spec.type, side: spec.side, status: 'failed', reauthorize: auth,
          error: auth ? `Twitch refused ${spec.type} for channel ${spec.side.toUpperCase()} (${response.status}: ${detail}). Re-authorise the bot account.` : `Twitch rejected ${spec.type} for channel ${spec.side.toUpperCase()} (${response.status}: ${detail}).` };
      }
    } catch (error) {
      state = { type: spec.type, side: spec.side, status: 'failed', error: `Could not subscribe to ${spec.type} for channel ${spec.side.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (connection.retired) return;
    this.subscriptions.set(key, state);
    if (state.status === 'failed') { this.lastError = state.error ?? null; this.log.warn({ event: 'eventsub_subscribe_failed', type: spec.type, side: spec.side }, state.error ?? 'Subscription failed.'); }
  }

  private emitStatus(): void {
    this.config.metrics?.eventsubConnected.set({}, this.current?.welcomed ? 1 : 0);
    this.config.onStatus?.(this.status());
  }
}

/** True when a Shared Chat begin or update event lists both of our channels. */
export function sharedChatJoinsBoth(type: string, event: any, channels: Partial<Record<Side, string>>): boolean {
  if (type === 'channel.shared_chat.end' || !channels.a || !channels.b) return false;
  const ids = new Set((event?.participants ?? []).map((participant: any) => String(participant?.broadcaster_user_id)));
  return ids.has(channels.a) && ids.has(channels.b);
}
