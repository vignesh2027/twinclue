import { mkdir,writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Puzzle } from './types.js';
import { judgeGuess } from '../game/referee.js';
import { LlmClient } from '../llm/client.js';

const AnswerSchema=z.object({best_answer:z.string().min(1),alternatives:z.array(z.string().min(1)).length(2)});
export interface BlindAnswer {best_answer:string;alternatives:[string,string];}
export interface AuditPromptResult {best_answer:string;alternatives:[string,string];referee:'accepted'|'rejected'|'unclear';}
export interface PuzzleAuditResult {id:string;fingerprint:string;answer:string;passed:boolean;halfA:AuditPromptResult;halfB:AuditPromptResult;both:AuditPromptResult;failures:string[];}
export interface AuditReport {generatedAt:string;model:string;total:number;passed:number;passRate:number;results:PuzzleAuditResult[];}
export interface PuzzleAuditor { audit(puzzle:Puzzle):Promise<PuzzleAuditResult>; }
export function puzzleFingerprint(puzzle:Puzzle):string{return createHash('sha256').update(JSON.stringify([puzzle.id,puzzle.answer,puzzle.aliases,puzzle.halfA,puzzle.halfB])).digest('hex');}
export class BlindPuzzleAuditor implements PuzzleAuditor {
  constructor(private readonly client:LlmClient){}
  async audit(puzzle:Puzzle):Promise<PuzzleAuditResult>{
    const halfA=await this.ask(puzzle.id,'half A',`Half A alone: ${puzzle.halfA}`);
    const halfB=await this.ask(puzzle.id,'half B',`Half B alone: ${puzzle.halfB}`);
    const both=await this.ask(puzzle.id,'both halves',`Half A: ${puzzle.halfA}\nHalf B: ${puzzle.halfB}`);
    const a=this.judge(halfA,puzzle);const b=this.judge(halfB,puzzle);const together=this.judge(both,puzzle);const failures:string[]=[];
    if(a.referee==='accepted')failures.push(`Half A alone produced accepted answer "${a.best_answer}".`);
    if(b.referee==='accepted')failures.push(`Half B alone produced accepted answer "${b.best_answer}".`);
    if(together.referee!=='accepted')failures.push(`Both halves produced "${together.best_answer}", which referee marked ${together.referee} for "${puzzle.answer}".`);
    return {id:puzzle.id,fingerprint:puzzleFingerprint(puzzle),answer:puzzle.answer,passed:failures.length===0,halfA:a,halfB:b,both:together,failures};
  }
  private async ask(id:string,label:string,question:string):Promise<BlindAnswer>{const system='You are a blind puzzle solver. Do not assume any hidden answer. From only the provided clue, choose one best answer and then two different plausible answers that also fit. Output only a valid JSON object, no markdown, with this exact shape: {"best_answer":"answer","alternatives":["other answer one","other answer two"]}. If the clue is broad, choose the most likely common answer.';for(let attempt=0;attempt<3;attempt++){try{return await this.client.chatJson([{role:'system',content:attempt?`${system} Ensure the best answer and both alternatives are all different.`:system},{role:'user',content:question}],AnswerSchema) as BlindAnswer;}catch(error){if(error instanceof z.ZodError&&attempt<2)continue;throw new Error(`Blind audit failed for ${id} (${label}): ${error instanceof Error?error.message:'LLM error'}`);}}throw new Error(`Blind audit failed for ${id} (${label}): no valid structured answer.`);}
  private judge(reply:BlindAnswer,puzzle:Puzzle):AuditPromptResult{return {...reply,alternatives:[reply.alternatives[0],reply.alternatives[1]],referee:judgeGuess(reply.best_answer,puzzle.answer,puzzle.aliases)};}
}
export async function auditPack(pack:Puzzle[],auditor:PuzzleAuditor,options:{concurrency?:number;reportPath?:string;checkpointPath?:string;resume?:PuzzleAuditResult[];model:string;generatedAt?:string;onProgress?:(completed:number,total:number,result:PuzzleAuditResult)=>void}):Promise<AuditReport>{
  const results:PuzzleAuditResult[]=new Array(pack.length);const byId=new Map((options.resume??[]).map(result=>[result.id,result]));const pending:number[]=[];for(let i=0;i<pack.length;i++){const previous=byId.get(pack[i]!.id);if(previous?.fingerprint===puzzleFingerprint(pack[i]!))results[i]=previous;else pending.push(i);}let next=0;let completed=results.filter(Boolean).length;const workers=Array.from({length:Math.max(1,Math.min(options.concurrency??1,pending.length||1))},async()=>{while(true){const index=pending[next++];if(index===undefined)return;results[index]=await auditor.audit(pack[index]!);completed++;options.onProgress?.(completed,pack.length,results[index]!);if(options.checkpointPath){await mkdir(dirname(options.checkpointPath),{recursive:true});await writeFile(options.checkpointPath,JSON.stringify({model:options.model,results:results.filter(Boolean)},null,2)+'\n','utf8');}}});await Promise.all(workers);
  const passed=results.filter(result=>result.passed).length;const report:AuditReport={generatedAt:options.generatedAt??new Date().toISOString(),model:options.model,total:results.length,passed,passRate:results.length?passed/results.length:1,results};
  if(options.reportPath){await mkdir(dirname(options.reportPath),{recursive:true});await writeFile(options.reportPath,JSON.stringify(report,null,2)+'\n','utf8');}
  return report;
}
