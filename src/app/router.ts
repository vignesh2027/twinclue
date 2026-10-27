import type { ParsedChat } from '../twitch/eventsub.js';
import type { Metrics } from '../obs/metrics.js';
import { parseCommand } from './commands.js';
import type { GameController } from './controller.js';

export interface RouterConfig { controller: GameController; broadcasterIds: Partial<Record<'a' | 'b', string>>; prefix?: string; metrics?: Metrics }

/** The hot path from one parsed chat message to the game. O(1) per message and never replies in chat. */
export function createChatRouter(config: RouterConfig): (chat: ParsedChat) => void {
  const ids = { A: config.broadcasterIds.a, B: config.broadcasterIds.b };
  return chat => {
    const community = chat.side === 'a' ? 'A' : 'B';
    config.metrics?.messagesIn.inc({ side: chat.side });
    config.controller.noteIngest();
    const command = parseCommand({ channel: community, userId: chat.userId, user: chat.userName, text: chat.text, badges: chat.badges }, ids, config.prefix);
    switch (command.type) {
      case 'guess': config.controller.vote(community, chat.userId, command.text, { displayName: chat.userName, receivedAt: chat.receivedAt }); return;
      case 'start': try { config.controller.startRound(); } catch { /* already running or no puzzles; the panel shows why */ } return;
      case 'lock': config.controller.lockRound(); return;
      case 'skip': config.controller.skipRound(); return;
      default: return;
    }
  };
}
