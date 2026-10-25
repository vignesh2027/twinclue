import type { Puzzle } from '../puzzle/types.js';
import { judgeGuess, type RefereeResult } from './referee.js';

export type Community = 'A' | 'B';
export type RoundStatus = 'pending' | 'active' | 'won' | 'timed-out';
export interface RoundGuess { community: Community; user: string; text: string; at: number; result: RefereeResult; }
export class Round {
  status: RoundStatus = 'pending';
  startedAt?: number;
  solvedAt?: number;
  readonly firstSolver: Partial<Record<Community,string>> = {};
  readonly guesses: Record<Community,number> = {A:0,B:0};
  readonly history: RoundGuess[] = [];
  private readonly lastGuess = new Map<string,number>();
  constructor(readonly puzzle: Puzzle) {}
  start(at = Date.now()): void { if(this.status!=='pending') throw new Error('Round has already started.'); this.status='active'; this.startedAt=at; }
  guess(community: Community, user: string, text: string, at = Date.now()): RefereeResult | 'rate-limited' | 'inactive' {
    if(this.status!=='active') return 'inactive';
    const key=`${community}:${user.toLocaleLowerCase()}`;
    const previous=this.lastGuess.get(key);
    if(previous!==undefined && at-previous<3000) return 'rate-limited';
    this.lastGuess.set(key,at); this.guesses[community]++;
    const result=judgeGuess(text,this.puzzle.answer,this.puzzle.aliases);
    this.history.push({community,user,text,at,result});
    if(result==='accepted' && !this.firstSolver[community]) this.firstSolver[community]=user;
    if(this.firstSolver.A && this.firstSolver.B){this.status='won';this.solvedAt=at;}
    return result;
  }
  timeout(): void { if(this.status==='active') this.status='timed-out'; }
  get solveTimeMs(): number | undefined { return this.startedAt===undefined||this.solvedAt===undefined?undefined:this.solvedAt-this.startedAt; }
}
