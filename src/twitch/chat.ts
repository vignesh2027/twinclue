import { silentLog, type Log } from '../obs/log.js';
import type { Metrics } from '../obs/metrics.js';
import type { HelixApi } from './helix.js';
import { rateLimitWaitMs } from './helix.js';

export type ChatTarget = 'a' | 'b' | 'both';
export interface ChatSenderConfig {
  helix: HelixApi; botUserId: string; channels: Partial<Record<'a' | 'b', string>>;
  /** True while a Shared Chat session joins both channels: one message then reaches both chats, so it is sent once. */
  sharedChat: () => boolean;
  metrics?: Metrics; log?: Log; now?: () => number; sleep?: (ms: number) => Promise<void>;
  globalLimit?: number; globalWindowMs?: number; perChannelGapMs?: number; maxQueue?: number;
}
interface QueueItem { channel: 'a' | 'b'; text: string; resolve: (sent: boolean) => void; attempts: number }

/**
 * Posts the bot's few messages (round start, round result, recap). Twitch allows a bot user that is not a mod
 * or VIP 20 messages per 30 seconds across all channels and 1 per second per channel, and ignores a bot for an
 * hour when it exceeds that, so this stays under both: a sliding window for the user and a gap per channel.
 */
export class ChatSender {
  private readonly queue: QueueItem[] = [];
  private readonly sentAt: number[] = [];
  private readonly lastByChannel: Record<'a' | 'b', number> = { a: -Infinity, b: -Infinity };
  private draining = false;
  private pausedUntil = 0;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: Log;

  constructor(private readonly config: ChatSenderConfig) {
    this.now = config.now ?? Date.now;
    this.sleep = config.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.log = config.log ?? silentLog;
  }

  /** Resolves true when Twitch confirmed every copy was sent, false when anything was dropped. Never rejects. */
  async send(target: ChatTarget, text: string): Promise<boolean> {
    const channels: Array<'a' | 'b'> = target === 'both' ? (['a', 'b'] as const).filter(side => this.config.channels[side]) : [target];
    const once = target === 'both' && channels.length === 2 && this.config.sharedChat() ? [channels[0]!] : channels;
    const results = await Promise.all(once.filter(side => this.config.channels[side]).map(channel => this.enqueue(channel, text)));
    return results.length > 0 && results.every(Boolean);
  }

  get queued(): number { return this.queue.length; }

  private enqueue(channel: 'a' | 'b', text: string): Promise<boolean> {
    if (this.queue.length >= (this.config.maxQueue ?? 20)) {
      this.config.metrics?.chatSends.inc({ result: 'dropped' });
      this.log.warn({ event: 'chat_queue_full', channel }, 'Chat queue full; message dropped.');
      return Promise.resolve(false);
    }
    return new Promise(resolve => { this.queue.push({ channel, text: text.slice(0, 500), resolve, attempts: 0 }); void this.drain(); });
  }

  /** How long until the next message to this channel is allowed by both limits. */
  waitFor(channel: 'a' | 'b', now = this.now()): number {
    const window = this.config.globalWindowMs ?? 30_000;
    while (this.sentAt.length && this.sentAt[0]! <= now - window) this.sentAt.shift();
    const globalWait = this.sentAt.length >= (this.config.globalLimit ?? 20) ? this.sentAt[0]! + window - now : 0;
    const channelWait = this.lastByChannel[channel] + (this.config.perChannelGapMs ?? 1_000) - now;
    return Math.max(0, globalWait, channelWait, this.pausedUntil - now);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0]!;
        const wait = this.waitFor(item.channel);
        if (wait > 0) { await this.sleep(wait); continue; }
        this.queue.shift();
        const stamp = this.now();
        this.sentAt.push(stamp);
        this.lastByChannel[item.channel] = stamp;
        const result = await this.post(item);
        if (result === 'retry') { this.queue.unshift(item); continue; }
        item.resolve(result);
      }
    } finally {
      this.draining = false;
    }
  }

  private async post(item: QueueItem): Promise<boolean | 'retry'> {
    const metrics = this.config.metrics;
    try {
      // The sender owns 429 handling (its window and pause), so Helix must not retry a rate-limited send on its own.
      const response = await this.config.helix.call('POST', '/chat/messages', 'bot', { broadcaster_id: this.config.channels[item.channel], sender_id: this.config.botUserId, message: item.text }, { retryRateLimit: false });
      if (response.status === 429) {
        metrics?.chatSends.inc({ result: 'rate_limited' });
        this.pausedUntil = this.now() + rateLimitWaitMs(response.headers, this.now());
        if (++item.attempts <= 2) return 'retry';
        metrics?.chatSends.inc({ result: 'failed' });
        return false;
      }
      if (response.status !== 200) {
        metrics?.chatSends.inc({ result: 'failed' });
        this.log.warn({ event: 'chat_send_failed', channel: item.channel, status: response.status }, 'Twitch did not accept the chat message.');
        return false;
      }
      const result = (response.body as { data?: Array<{ is_sent?: boolean; drop_reason?: { code?: string; message?: string } | null }> }).data?.[0];
      if (!result?.is_sent) {
        metrics?.chatSends.inc({ result: 'dropped' });
        this.log.warn({ event: 'chat_send_dropped', channel: item.channel, code: result?.drop_reason?.code, reason: result?.drop_reason?.message }, 'Twitch dropped the chat message.');
        return false;
      }
      metrics?.chatSends.inc({ result: 'sent' });
      return true;
    } catch (error) {
      metrics?.chatSends.inc({ result: 'failed' });
      this.log.warn({ event: 'chat_send_error', channel: item.channel, reason: error instanceof Error ? error.message : String(error) }, 'Chat send failed.');
      return false;
    }
  }
}
