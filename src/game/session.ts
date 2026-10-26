import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { PuzzleSchema } from '../puzzle/types.js';
import { guessBucketKey,normaliseGuess } from './referee.js';
import { Round,type Community,type RoundStatus,type VoteEntry,type VoteSample,type SideReveal } from './round.js';

const CommunitySchema=z.enum(['A','B']);const VoteEntrySchema=z.tuple([z.string(),z.object({bucket:z.string(),display:z.string()})]);
const SessionRoundSchema=z.object({puzzle:PuzzleSchema,status:z.enum(['pending','active','won','timed-out']),startedAt:z.number().optional(),endedAt:z.number().optional(),earlyFinishAt:z.number().optional(),votesA:z.array(VoteEntrySchema).optional(),votesB:z.array(VoteEntrySchema).optional(),recentSamples:z.array(z.object({community:CommunitySchema,user:z.string(),text:z.string(),at:z.number()})).optional(),result:z.object({A:z.object({topAnswer:z.string().nullable(),correct:z.boolean(),voters:z.number()}),B:z.object({topAnswer:z.string().nullable(),correct:z.boolean(),voters:z.number()})}).nullable().optional(),history:z.array(z.object({community:CommunitySchema,user:z.string(),text:z.string(),at:z.number()})).optional()});
const SessionSchema=z.object({rounds:z.array(SessionRoundSchema),streak:z.number().int().nonnegative()});
export class Session {
  readonly rounds:Round[]=[];streak=0;
  addRound(round:Round):void{this.rounds.push(round);}
  get scoreboard():{rounds:number;wins:number;streak:number}{return {rounds:this.rounds.length,wins:this.rounds.filter(round=>round.status==='won').length,streak:this.streak};}
  recordResult(round:Round):void{if(round.status==='won')this.streak++;else if(round.status==='timed-out')this.streak=0;}
  async save(path='data/session.json'):Promise<void>{await mkdir(dirname(path),{recursive:true});const rounds=this.rounds.map(round=>({puzzle:round.puzzle,status:round.status,startedAt:round.startedAt,endedAt:round.endedAt,earlyFinishAt:round.earlyFinishAt,votesA:[...round.votes.A],votesB:[...round.votes.B],recentSamples:round.recentSamples,result:round.result}));await writeFile(path,JSON.stringify({rounds,streak:this.streak},null,2),'utf8');}
  static async load(path='data/session.json'):Promise<Session>{const parsed=SessionSchema.parse(JSON.parse(await readFile(path,'utf8')));const session=new Session();session.streak=parsed.streak;for(const saved of parsed.rounds){const round=new Round(saved.puzzle);round.status=saved.status as RoundStatus;round.startedAt=saved.startedAt;round.endedAt=saved.endedAt;round.earlyFinishAt=saved.earlyFinishAt;if(saved.votesA)round.restoreVotes('A',saved.votesA as Array<[string,VoteEntry]>);if(saved.votesB)round.restoreVotes('B',saved.votesB as Array<[string,VoteEntry]>);if(saved.recentSamples)round.recentSamples.push(...saved.recentSamples as VoteSample[]);round.result=saved.result as Record<Community,SideReveal>|null??null;if(!saved.votesA&&!saved.votesB&&saved.history){const latest=new Map<Community,Map<string,string>>();for(const item of saved.history){const map=latest.get(item.community)??new Map<string,string>();map.set(item.user.toLocaleLowerCase(),item.text);latest.set(item.community,map);}for(const community of ['A','B'] as const){const votes:Array<[string,VoteEntry]>=[];for(const [user,text] of latest.get(community)??[]){const bucket=guessBucketKey(text,round.puzzle.answer,round.puzzle.aliases);votes.push([user,{bucket,display:bucket==='__answer__'?round.puzzle.answer:normaliseGuess(text)}]);}round.restoreVotes(community,votes);}}session.rounds.push(round);}return session;}
}
