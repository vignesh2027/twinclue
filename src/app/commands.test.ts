import {describe,it,expect} from 'vitest';
import {parseCommand} from './commands.js';
describe('chat commands',()=>{
 it('allows guesses and public scores',()=>{expect(parseCommand({channel:'A',user:'viewer',text:'!g Paris'})).toMatchObject({type:'guess',text:'Paris'});expect(parseCommand({channel:'B',user:'viewer',text:'!tc score'}).type).toBe('score');});
 it('uses a configured guess prefix safely',()=>{expect(parseCommand({channel:'A',user:'viewer',text:'?guess Paris'}, {}, '?guess')).toMatchObject({type:'guess',text:'Paris'});});
 it('restricts start and skip to broadcaster or moderator badges',()=>{expect(parseCommand({channel:'A',user:'viewer',text:'!tc start'}).type).toBe('denied');expect(parseCommand({channel:'A',user:'helper',text:'!tc skip',badges:[{set_id:'moderator'}]}).type).toBe('skip');expect(parseCommand({channel:'B',user:'owner',text:'!tc start',badges:[{set_id:'broadcaster'}]}).type).toBe('start');});
});
