import type { Community } from '../game/round.js';

export interface ChatCommandEvent { channel: Community; userId: string; user: string; text: string; badges?: Array<{ set_id: string }> }
export type CommandResult =
  | { type: 'guess'; channel: Community; userId: string; user: string; text: string }
  | { type: 'start' | 'skip' | 'lock'; channel: Community; userId: string; user: string }
  | { type: 'ignored' | 'denied' };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prefixCache = new Map<string, RegExp>();
function prefixPattern(prefix: string): RegExp {
  let pattern = prefixCache.get(prefix);
  if (!pattern) { pattern = new RegExp(`^${escapeRegex(prefix)}\\s+(.+)$`, 'is'); prefixCache.set(prefix, pattern); }
  return pattern;
}

/**
 * Parses one chat message. Moderator commands are allowed for a moderator or broadcaster badge, or when the
 * chatter's Twitch user id is the broadcaster id of their own side. Ids are compared with ids, never with names.
 */
export function parseCommand(event: ChatCommandEvent, broadcasterUserIds: Partial<Record<Community, string>> = {}, guessPrefix = process.env.COMMAND_PREFIX?.trim() || '!g'): CommandResult {
  const text = event.text.trim();
  const guess = prefixPattern(guessPrefix).exec(text);
  if (guess) return { type: 'guess', channel: event.channel, userId: event.userId, user: event.user, text: guess[1]! };
  const command = /^!tc\s+(start|skip|lock)\s*$/i.exec(text);
  if (!command) return { type: 'ignored' };
  const action = command[1]!.toLowerCase() as 'start' | 'skip' | 'lock';
  const privileged = (event.badges ?? []).some(badge => badge.set_id === 'moderator' || badge.set_id === 'broadcaster');
  const isOwner = Boolean(broadcasterUserIds[event.channel]) && event.userId === broadcasterUserIds[event.channel];
  if (!privileged && !isOwner) return { type: 'denied' };
  return { type: action, channel: event.channel, userId: event.userId, user: event.user };
}
