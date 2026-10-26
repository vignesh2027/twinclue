import type { Community } from '../game/round.js';
export interface ChatCommandEvent {channel:Community;user:string;text:string;badges?:Record<string,string>|Array<{set_id:string}>;}
export type CommandResult={type:'guess';channel:Community;user:string;text:string}|{type:'start'|'skip'|'score';channel:Community;user:string}|{type:'ignored'|'denied'};
export function parseCommand(event:ChatCommandEvent,broadcasterUserIds:Partial<Record<Community,string>>={},guessPrefix=process.env.COMMAND_PREFIX?.trim()||'!g'):CommandResult {
  const text=event.text.trim();const escaped=guessPrefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const guess=new RegExp(`^${escaped}\\s+(.+)$`,'i').exec(text);if(guess)return {type:'guess',channel:event.channel,user:event.user,text:guess[1]!};
  const command=/^!tc\s+(start|skip|score)\s*$/i.exec(text);if(!command)return {type:'ignored'};
  const action=command[1]!.toLowerCase() as 'start'|'skip'|'score';if(action==='score')return {type:'score',channel:event.channel,user:event.user};
  const badges=event.badges;const moderator=Array.isArray(badges)?badges.some(b=>b.set_id==='moderator'||b.set_id==='broadcaster'):Boolean(badges&&('moderator'in badges||'broadcaster'in badges));
  if(!moderator && event.user.toLowerCase()!==broadcasterUserIds[event.channel]?.toLowerCase())return {type:'denied'};
  return {type:action,channel:event.channel,user:event.user};
}
