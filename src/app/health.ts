import type { EventSubStatus, Side } from '../twitch/eventsub.js';

/** Per-side connection health for the panel and /readyz, from one EventSub status snapshot. */
export function sideHealth(status: EventSubStatus, channels: Partial<Record<Side, string>>) {
  const health = (side: Side) => {
    const subs = status.subscriptions.filter(sub => sub.side === side);
    const chat = subs.find(sub => sub.type === 'channel.chat.message');
    const failing = subs.find(sub => sub.status === 'failed' || sub.status === 'revoked');
    return { configured: Boolean(channels[side]), connected: status.connected, subscribed: chat?.status === 'enabled',
      error: failing?.error ?? (status.connected ? null : status.lastError), reauthorize: Boolean(failing?.reauthorize) };
  };
  return { a: health('a'), b: health('b'), lastError: status.lastError };
}
