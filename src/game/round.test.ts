import { describe,it,expect } from 'vitest';
import { Round } from './round.js';
import { puzzlePack } from '../puzzle/pack.js';
describe('Round',()=>{
 it('requires both communities to solve',()=>{const r=new Round(puzzlePack[0]!);r.start(0);r.guess('A','alice','Eiffel Tower',100);expect(r.status).toBe('active');r.guess('B','bob','Eiffel Tower',200);expect(r.status).toBe('won');expect(r.solveTimeMs).toBe(200);});
 it('limits each viewer to one guess every three seconds',()=>{const r=new Round(puzzlePack[0]!);r.start(0);expect(r.guess('A','alice','bad',1)).toBe('rejected');expect(r.guess('A','alice','bad',3000)).toBe('rate-limited');expect(r.guess('A','alice','bad',3001)).toBe('rejected');});
});
