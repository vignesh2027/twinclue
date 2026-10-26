import {describe,it,expect} from 'vitest';
import {Round} from './round.js';
import {puzzleFixture} from '../test/puzzle-fixture.js';
describe('community lock-in votes',()=>{
 it('does not win until both community plurality leaders are correct',()=>{const r=new Round(puzzleFixture);r.start(0);r.vote('A','alice',r.puzzle.answer,100);r.timeout(200);expect(r.status).toBe('timed-out');const s=new Round(r.puzzle);s.start(0);s.vote('A','alice',s.puzzle.answer,100);s.vote('B','bob',s.puzzle.aliases[0]??s.puzzle.answer,200);s.timeout(300);expect(s.status).toBe('won');});
 it('moves a viewer vote in O(1), tracks plurality and handles tiny chats',()=>{const r=new Round(puzzleFixture);r.start(0);r.vote('A','alice','Paris',1);r.vote('A','alice','Rome',3001);expect(r.voterCount('A')).toBe(1);expect(r.topBuckets('A')[0]?.answer).toBe('rome');r.vote('A','alice',r.puzzle.answer,6001);expect(r.topBuckets('A')[0]?.key).toBe('__answer__');});
 it('rate limits vote changes and blocks unsafe text',()=>{const r=new Round(puzzleFixture);r.start(0);expect(r.vote('A','unsafe','shit',0)).toBe('blocked');expect(r.vote('A','alice','wrong',1)).toBe('voted');expect(r.vote('A','alice','wrong two',2999)).toBe('rate-limited');expect(r.vote('A','alice','wrong two',3001)).toBe('voted');});
 it('requires a five second hold for early finish and allows lock',()=>{const r=new Round(puzzleFixture);r.start(0);r.vote('A','alice',r.puzzle.answer,15000);r.vote('B','bob',r.puzzle.answer,15000);expect(r.updateEarlyFinish(15000)).toBe(20000);r.lock(16000);expect(r.status).toBe('won');});
});
