import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * A local stand-in for wss://eventsub.wss.twitch.tv: real WebSockets, Twitch's message envelope, keepalives,
 * session_reconnect with a one-time URL, revocations, and the failure modes we inject on purpose.
 * Test and benchmark use only.
 */
export interface FakeChat {
  broadcaster: string; source?: string | null; chatterId: string; login?: string; text: string;
  messageId?: string; sourceMessageId?: string | null; badges?: Array<{ set_id: string }>; timestamp?: string;
}

export class FakeEventSub {
  readonly sockets = new Set<WebSocket>();
  readonly sessions = new Map<WebSocket, string>();
  readonly connections: Array<{ path: string; at: number }> = [];
  private readonly silenced = new Set<WebSocket>();
  private keepaliveTimer?: ReturnType<typeof setInterval>;
  /** Delay before welcoming a socket opened from a reconnect URL; lets a test send on the old socket meanwhile. */
  reconnectWelcomeDelayMs = 0;
  private readonly usedReconnectTokens = new Set<string>();

  private constructor(private readonly wss: WebSocketServer, readonly port: number, readonly keepaliveSeconds: number) {}

  static async start(keepaliveSeconds = 10): Promise<FakeEventSub> {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>(resolve => wss.once('listening', () => resolve()));
    const fake = new FakeEventSub(wss, (wss.address() as AddressInfo).port, keepaliveSeconds);
    wss.on('connection', (ws, request) => fake.accept(ws, request.url ?? '/ws'));
    fake.keepaliveTimer = setInterval(() => { for (const ws of fake.sockets) if (fake.sessions.has(ws) && !fake.silenced.has(ws)) fake.envelope(ws, 'session_keepalive', {}); }, Math.max(100, keepaliveSeconds * 1000 / 3));
    return fake;
  }

  get url(): string { return `ws://127.0.0.1:${this.port}/ws`; }

  private accept(ws: WebSocket, path: string): void {
    this.connections.push({ path, at: Date.now() });
    const token = new URL(path, 'http://x').searchParams.get('reconnect');
    if (token && this.usedReconnectTokens.has(token)) { ws.close(4007, 'invalid reconnect'); return; }
    if (token) this.usedReconnectTokens.add(token);
    this.sockets.add(ws);
    ws.on('close', () => { this.sockets.delete(ws); this.sessions.delete(ws); this.silenced.delete(ws); });
    const welcome = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const id = randomUUID();
      this.sessions.set(ws, id);
      this.envelope(ws, 'session_welcome', { session: { id, status: 'connected', keepalive_timeout_seconds: this.keepaliveSeconds, reconnect_url: null, connected_at: new Date().toISOString() } });
    };
    if (token && this.reconnectWelcomeDelayMs) setTimeout(welcome, this.reconnectWelcomeDelayMs); else welcome();
  }

  /** Sockets that received a welcome and are still open, oldest first. */
  get live(): WebSocket[] { return [...this.sockets].filter(ws => this.sessions.has(ws) && ws.readyState === WebSocket.OPEN); }
  get newest(): WebSocket { const live = this.live; return live[live.length - 1]!; }

  envelope(ws: WebSocket, type: string, payload: unknown, messageId: string = randomUUID(), timestamp = new Date().toISOString(), subscriptionType?: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ metadata: { message_id: messageId, message_type: type, message_timestamp: timestamp, ...(subscriptionType ? { subscription_type: subscriptionType, subscription_version: '1' } : {}) }, payload }));
  }

  static chatEvent(chat: FakeChat): Record<string, unknown> {
    return {
      broadcaster_user_id: chat.broadcaster, broadcaster_user_login: `b${chat.broadcaster}`, broadcaster_user_name: `B${chat.broadcaster}`,
      chatter_user_id: chat.chatterId, chatter_user_login: chat.login ?? `user${chat.chatterId}`, chatter_user_name: chat.login ?? `User${chat.chatterId}`,
      message_id: chat.messageId ?? randomUUID(), message: { text: chat.text, fragments: [{ type: 'text', text: chat.text }] }, color: '', badges: chat.source ? [] : chat.badges ?? [],
      message_type: 'text', cheer: null, reply: null, channel_points_custom_reward_id: null,
      source_broadcaster_user_id: chat.source ?? null, source_message_id: chat.source ? chat.sourceMessageId ?? null : null, source_badges: chat.source ? chat.badges ?? [] : null,
    };
  }

  /** Serialised chat notification, so the benchmark can pre-build its traffic. */
  static chatFrame(chat: FakeChat, envelopeId: string = randomUUID()): string {
    return JSON.stringify({ metadata: { message_id: envelopeId, message_type: 'notification', message_timestamp: chat.timestamp ?? new Date().toISOString(), subscription_type: 'channel.chat.message', subscription_version: '1' },
      payload: { subscription: { id: 'sub', type: 'channel.chat.message', version: '1', status: 'enabled', cost: 0, condition: { broadcaster_user_id: chat.broadcaster }, transport: { method: 'websocket' } }, event: FakeEventSub.chatEvent(chat) } });
  }

  chat(ws: WebSocket, chat: FakeChat, envelopeId?: string): void { if (ws.readyState === WebSocket.OPEN) ws.send(FakeEventSub.chatFrame(chat, envelopeId)); }

  notify(ws: WebSocket, type: string, event: unknown, condition: Record<string, string> = {}): void {
    this.envelope(ws, 'notification', { subscription: { id: randomUUID(), type, version: '1', status: 'enabled', cost: 0, condition, transport: { method: 'websocket' } }, event }, undefined, undefined, type);
  }

  /** Twitch's session_reconnect: a one-time URL; the old socket keeps delivering until the client leaves it. */
  reconnect(ws: WebSocket): string {
    const url = `ws://127.0.0.1:${this.port}/ws?reconnect=${randomUUID()}`;
    this.envelope(ws, 'session_reconnect', { session: { id: this.sessions.get(ws), status: 'reconnecting', keepalive_timeout_seconds: null, reconnect_url: url, connected_at: new Date().toISOString() } });
    return url;
  }

  revoke(ws: WebSocket, type: string, broadcaster: string, status = 'authorization_revoked'): void {
    this.envelope(ws, 'revocation', { subscription: { id: randomUUID(), type, version: '1', status, cost: 0, condition: { broadcaster_user_id: broadcaster }, transport: { method: 'websocket' } } });
  }

  /** Kill the TCP connection without a close frame. */
  abrupt(ws: WebSocket): void { ws.terminate(); }
  /** Stop keepalives on one socket while keeping it open, as a stalled network path would. */
  silence(ws: WebSocket): void { this.silenced.add(ws); }

  async close(): Promise<void> {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    for (const ws of this.sockets) ws.terminate();
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
  }
}

export async function waitFor(condition: () => boolean, timeoutMs = 5_000, label = 'condition'): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
