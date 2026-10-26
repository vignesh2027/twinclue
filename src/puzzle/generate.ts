import { z } from 'zod';
import type { Puzzle, PuzzleCategory, PuzzleDifficulty } from './types.js';
import { PuzzleSchema } from './types.js';
import { validatePuzzle } from './validate.js';
import type { PuzzleAuditor } from './audit.js';
import type { LlmClient } from '../llm/client.js';
import { judgeGuess } from '../game/referee.js';

export const PuzzleCandidateSchema=PuzzleSchema.omit({id:true});
export type PuzzleCandidate=z.infer<typeof PuzzleCandidateSchema>;
const CandidateBatchSchema=z.object({candidates:z.array(PuzzleCandidateSchema).min(1).max(8)});
export interface CandidatePlan {count:number;categoryFocus:PuzzleCategory[];indiaFriendlyCount:number;difficultyFocus:PuzzleDifficulty[];avoidAuditFailures?:string[];}
export interface CandidateFilterResult {generated:number;validationFailed:number;auditFailed:number;kept:Puzzle[];auditResults:Awaited<ReturnType<PuzzleAuditor['audit']>>[];validationReasons:string[];}

export async function generatePuzzleCandidates(client:LlmClient,plan:CandidatePlan):Promise<PuzzleCandidate[]>{
  const system='You write family-friendly cooperative two-half trivia puzzles. Each half must give a broad category plus a property shared by several well-known things. A half alone must plausibly suggest at least two answers. Only the intersection of both halves may point to exactly one well-known answer. Never put a unique name, lyric, record, nickname, or defining shape in just one half. The also-fits lists must be honest, distinct, well-known answers that plausibly fit that half alone and are ruled out by the other half. Do not put the answer or any alias in either half. Also-fits answers must not be alternate spellings or near-typos of the answer. Keep answers short and globally recognisable. Return only JSON.';
  const feedback=plan.avoidAuditFailures?.length?` Recent blind-audit failures to avoid: ${plan.avoidAuditFailures.join(' | ')}.`:'';
  const user=`Generate ${plan.count} distinct candidates. Favor these categories across the batch: ${plan.categoryFocus.join(', ')}. Use a genuine mix of easy, medium and hard difficulty: ${plan.difficultyFocus.join(', ')}. At least ${plan.indiaFriendlyCount} candidates should be recognisable to viewers in India, using cricket, Hindi or regional cinema, Indian food, music or places; keep them family-friendly and globally explainable. Good structure example (do not reuse it): half A says a landmark is tall and beside water, half B says it is one of several visual cues boats use to find land after dark. The first half fits a water tower or bridge; the second fits a beacon or buoy; together they suggest one answer. For each candidate, first list two or more real alternatives that fit each half alone, then write the halves so the other half rules those alternatives out. Reject your own candidate if either half still singles out the answer.${feedback} Return this JSON shape: {"candidates":[{"category":"general|games|music|science|sport|food|geography|movies","difficulty":"easy|medium|hard","answer":"...","aliases":["..."],"halfA":"...","halfB":"...","halfAAlsoFits":["...","..."],"halfBAlsoFits":["...","..."]}]}. Include at least two also-fits answers for each half.`;
  const parsed=await client.chatJson([{role:'system',content:system},{role:'user',content:user}],CandidateBatchSchema);
  return parsed.candidates;
}

export async function filterPuzzleCandidates(candidates:PuzzleCandidate[],auditor:PuzzleAuditor,options:{existing:Puzzle[];idForCandidate:(index:number)=>string}):Promise<CandidateFilterResult>{
  const normalise=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const existingAnswers=new Set(options.existing.flatMap(puzzle=>[puzzle.answer,...puzzle.aliases]).map(normalise));
  let validationFailed=0;let auditFailed=0;const validationReasons:string[]=[];const kept:Puzzle[]=[];const auditResults:CandidateFilterResult['auditResults']=[];
  for(const [index,candidate] of candidates.entries()){
    const answerKey=normalise(candidate.answer);
    const candidateTerms=[candidate.answer,...candidate.aliases].map(normalise);
    const puzzle=PuzzleSchema.safeParse({...candidate,id:options.idForCandidate(index)});
    if(!puzzle.success){validationFailed++;validationReasons.push(...puzzle.error.issues.map(issue=>issue.message));continue;}
    const reasons=validatePuzzle(puzzle.data);
    for(const [label,alternatives] of [['Half A',puzzle.data.halfAAlsoFits],['Half B',puzzle.data.halfBAlsoFits]] as const)if(alternatives.some(alternative=>judgeGuess(alternative,puzzle.data.answer,puzzle.data.aliases)!=='rejected'))reasons.push(`${label} also-fits entries must be clearly distinct from the answer under referee rules.`);
    if(candidateTerms.some(term=>existingAnswers.has(term))||kept.some(item=>[item.answer,...item.aliases].some(term=>candidateTerms.includes(normalise(term)))))reasons.push('Answer or alias duplicates an existing puzzle.');
    if(reasons.length){validationFailed++;validationReasons.push(...reasons);continue;}
    const result=await auditor.audit(puzzle.data);auditResults.push(result);
    if(!result.passed){auditFailed++;continue;}
    existingAnswers.add(answerKey);for(const alias of puzzle.data.aliases)existingAnswers.add(normalise(alias));kept.push(puzzle.data);
  }
  return {generated:candidates.length,validationFailed,auditFailed,kept,auditResults,validationReasons};
}
