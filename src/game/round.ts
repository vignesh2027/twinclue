import type { Puzzle } from '../puzzle/types.js';
import { guessBucketKey,normaliseGuess } from './referee.js';

export type Community='A'|'B';export type RoundStatus='pending'|'active'|'won'|'timed-out';
export interface VoteSample {community:Community;user:string;text:string;at:number;}
export interface VoteEntry {bucket:string;display:string;}
export interface VoteBucket {key:string;answer:string;count:number;}
export interface SideReveal {topAnswer:string|null;correct:boolean;voters:number;}
const blockedWords=['fuck','shit','bitch','cunt','nigger','faggot'];
export function isBlockedGuess(value:string):boolean {const normalized=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();return blockedWords.some(word=>new RegExp(`\\b${word}\\b`,'i').test(normalized));}
export function cleanVoteText(value:string,maxLength=80):string {return value.replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,maxLength);}
export class Round {
  status:RoundStatus='pending';startedAt?:number;endedAt?:number;earlyFinishAt?:number;
  readonly votes:Record<Community,Map<string,VoteEntry>>={A:new Map(),B:new Map()};
  readonly bucketCounts:Record<Community,Map<string,number>>={A:new Map(),B:new Map()};
  readonly bucketLabels:Record<Community,Map<string,string>>={A:new Map(),B:new Map()};
  readonly recentSamples:VoteSample[]=[];readonly sampleLimit=80;
  result:Record<Community,SideReveal>|null=null;
  private readonly lastVote=new Map<string,number>();
  constructor(readonly puzzle:Puzzle){}
  start(at=Date.now()):void {if(this.status!=='pending')throw new Error('Round has already started.');this.status='active';this.startedAt=at;}
  vote(community:Community,user:string,text:string,at=Date.now()):'voted'|'unchanged'|'blocked'|'rate-limited'|'inactive' {
    if(this.status!=='active')return 'inactive';const clean=cleanVoteText(text);if(!clean||isBlockedGuess(clean))return 'blocked';const userKey=user.toLocaleLowerCase();const rateKey=`${community}:${userKey}`;const previousAt=this.lastVote.get(rateKey);if(previousAt!==undefined&&at-previousAt<3000)return 'rate-limited';
    const bucket=guessBucketKey(clean,this.puzzle.answer,this.puzzle.aliases);if(!bucket)return 'blocked';const current=this.votes[community].get(userKey);this.lastVote.set(rateKey,at);if(current?.bucket===bucket){this.sample(community,user,clean,at);return 'unchanged';}
    if(current)this.decrement(community,current.bucket);const display=bucket==='__answer__'?this.puzzle.answer:normaliseGuess(clean);this.votes[community].set(userKey,{bucket,display});this.bucketCounts[community].set(bucket,(this.bucketCounts[community].get(bucket)??0)+1);this.bucketLabels[community].set(bucket,display);this.sample(community,user,clean,at);this.refreshEarlyFinish(at);return 'voted';
  }
  private decrement(community:Community,bucket:string):void {const count=this.bucketCounts[community].get(bucket)??0;if(count<=1){this.bucketCounts[community].delete(bucket);this.bucketLabels[community].delete(bucket);}else this.bucketCounts[community].set(bucket,count-1);}
  private sample(community:Community,user:string,text:string,at:number):void {this.recentSamples.push({community,user:cleanVoteText(user,24),text,at});if(this.recentSamples.length>this.sampleLimit)this.recentSamples.splice(0,this.recentSamples.length-this.sampleLimit);}
  private answerKey():string{return '__answer__';}
  topBuckets(community:Community,limit=3):VoteBucket[]{return [...this.bucketCounts[community]].map(([key,count])=>({key,answer:this.bucketLabels[community].get(key)??key,count})).sort((a,b)=>b.count-a.count||a.answer.localeCompare(b.answer)).slice(0,limit);}
  voterCount(community:Community):number{return this.votes[community].size;}
  get totalVoters():Record<Community,number>{return {A:this.voterCount('A'),B:this.voterCount('B')};}
  private uniqueLeader(community:Community):VoteBucket|null {const ranked=this.topBuckets(community,2);if(!ranked.length||ranked[0]!.count===ranked[1]?.count)return null;return ranked[0]!;}
  isLeadingCorrect(community:Community):boolean{return this.uniqueLeader(community)?.key===this.answerKey();}
  private earlyCondition(at:number):boolean {if(this.startedAt===undefined||at-this.startedAt<15_000)return false;for(const community of ['A','B'] as const){const leader=this.uniqueLeader(community);if(!leader||leader.key!==this.answerKey()||leader.count/this.voterCount(community)<0.5)return false;}return true;}
  private refreshEarlyFinish(at:number):void {if(this.earlyCondition(at)){this.earlyFinishAt??=at+5_000;}else this.earlyFinishAt=undefined;}
  updateEarlyFinish(at=Date.now()):number|undefined {if(this.status!=='active')return undefined;this.refreshEarlyFinish(at);return this.earlyFinishAt;}
  lock(at=Date.now()):void {if(this.status==='active')this.finish(at);}
  timeout(at=Date.now()):void {if(this.status==='active')this.finish(at);}
  finish(at=Date.now()):void {if(this.status!=='active')return;const a=this.uniqueLeader('A'),b=this.uniqueLeader('B');const correct=Boolean(a&&b&&a.key===this.answerKey()&&b.key===this.answerKey());this.status=correct?'won':'timed-out';this.endedAt=at;this.earlyFinishAt=undefined;this.result={A:{topAnswer:a?.answer??null,correct:Boolean(a&&a.key===this.answerKey()),voters:this.voterCount('A')},B:{topAnswer:b?.answer??null,correct:Boolean(b&&b.key===this.answerKey()),voters:this.voterCount('B')}};}
  restoreVotes(community:Community,votes:Array<[string,VoteEntry]>):void {this.votes[community].clear();this.bucketCounts[community].clear();this.bucketLabels[community].clear();for(const [user,entry] of votes){this.votes[community].set(user,entry);this.bucketCounts[community].set(entry.bucket,(this.bucketCounts[community].get(entry.bucket)??0)+1);this.bucketLabels[community].set(entry.bucket,entry.display);}}
  get solveTimeMs():number|undefined{return this.startedAt===undefined||this.endedAt===undefined?undefined:this.endedAt-this.startedAt;}
}
