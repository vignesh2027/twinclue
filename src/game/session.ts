import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { PuzzleSchema } from '../puzzle/types.js';
import { Round } from './round.js';

const SessionSchema=z.object({rounds:z.array(z.object({puzzle:PuzzleSchema,status:z.enum(['pending','active','won','timed-out']),startedAt:z.number().optional(),solvedAt:z.number().optional(),firstSolver:z.object({A:z.string().optional(),B:z.string().optional()}),guesses:z.object({A:z.number(),B:z.number()}),history:z.array(z.object({community:z.enum(['A','B']),user:z.string(),text:z.string(),at:z.number(),result:z.enum(['accepted','rejected','unclear'])}))})),streak:z.number().int().nonnegative()});
export class Session {
  readonly rounds: Round[]=[];
  streak=0;
  addRound(round: Round): void { this.rounds.push(round); }
  get scoreboard(): { rounds:number; wins:number; streak:number } { return {rounds:this.rounds.length,wins:this.rounds.filter(r=>r.status==='won').length,streak:this.streak}; }
  recordResult(round: Round): void { if(round.status==='won') this.streak++; else if(round.status==='timed-out') this.streak=0; }
  async save(path='data/session.json'): Promise<void> {
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path,JSON.stringify({rounds:this.rounds.map(r=>({puzzle:r.puzzle,status:r.status,startedAt:r.startedAt,solvedAt:r.solvedAt,firstSolver:r.firstSolver,guesses:r.guesses,history:r.history})),streak:this.streak},null,2),'utf8');
  }
  static async load(path='data/session.json'): Promise<Session> {
    const parsed=SessionSchema.parse(JSON.parse(await readFile(path,'utf8')));
    const session=new Session(); session.streak=parsed.streak;
    for(const saved of parsed.rounds){const round=new Round(saved.puzzle);round.status=saved.status;round.startedAt=saved.startedAt;round.solvedAt=saved.solvedAt;Object.assign(round.firstSolver,saved.firstSolver);Object.assign(round.guesses,saved.guesses);round.history.push(...saved.history);session.rounds.push(round);}
    return session;
  }
}
