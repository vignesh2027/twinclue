import { describe,it,expect } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session } from './session.js';
import { Round } from './round.js';
import { puzzlePack } from '../puzzle/pack.js';
describe('session persistence',()=>{it('saves and loads session state',async()=>{const dir=await mkdtemp(join(tmpdir(),'twinclue-'));try{const path=join(dir,'session.json');const s=new Session();const r=new Round(puzzlePack[0]!);r.start(5);r.guess('A','alice',puzzlePack[0]!.answer,10);s.addRound(r);s.streak=2;await s.save(path);const loaded=await Session.load(path);expect(loaded.rounds).toHaveLength(1);expect(loaded.rounds[0]?.firstSolver.A).toBe('alice');expect(loaded.streak).toBe(2);}finally{await rm(dir,{recursive:true,force:true});}});});
