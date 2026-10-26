import 'dotenv/config';
import { z } from 'zod';
import { resolve } from 'node:path';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { puzzlePack } from './pack.js';
import { PuzzleSchema,type Puzzle,type PuzzleCategory,type PuzzleDifficulty } from './types.js';
import { puzzleFingerprint,type AuditReport,type PuzzleAuditResult,BlindPuzzleAuditor } from './audit.js';
import { generatePuzzleCandidates,filterPuzzleCandidates,type CandidatePlan } from './generate.js';
import { LlmClient } from '../llm/client.js';

const Config=z.object({LLM_BASE_URL:z.string().url(),LLM_API_KEY:z.string().min(1),LLM_MODEL:z.string().min(1),AUDIT_MODEL:z.string().min(1)}).parse(process.env);
const outputPath=resolve('src/puzzle/generated-pack.ts');
const reportPath=resolve('src/puzzle/audit-report.json');
const generationReportPath=resolve('src/puzzle/generation-report.json');
const progressPath=resolve('data/generate-progress.json');
const report=JSON.parse(await readFile(reportPath,'utf8')) as AuditReport;
if(puzzlePack.length===60&&report.total===60&&report.passRate===1&&puzzlePack.every(puzzle=>{const result=report.results.find(item=>item.id===puzzle.id);return result?.passed&&result.fingerprint===puzzleFingerprint(puzzle);})){console.log('The built-in pack already contains 60 fingerprint-verified blind-audit passes.');process.exit(0);}
const retained=puzzlePack;
const retainedResults=retained.map(puzzle=>report.results.find(result=>result.id===puzzle.id));
if(retained.length!==32||retainedResults.some((result,index)=>!result?.passed||result.fingerprint!==puzzleFingerprint(retained[index]!)))throw new Error('Expected exactly 32 unchanged, fingerprint-verified handwritten passes before generation.');
const target=60-retained.length;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const generationClient=new LlmClient({baseUrl:Config.LLM_BASE_URL,apiKey:Config.LLM_API_KEY,model:Config.LLM_MODEL,timeoutMs:90_000,retries:4,minimumIntervalMs:2500,maxCompletionTokens:4096,reasoningEffort:'low'});
const auditClient=new LlmClient({baseUrl:Config.LLM_BASE_URL,apiKey:Config.LLM_API_KEY,model:Config.AUDIT_MODEL,timeoutMs:60_000,retries:4,minimumIntervalMs:2100,maxCompletionTokens:128,reasoningEffort:'none',responseFormat:{type:'json_schema',json_schema:{name:'blind_answer',strict:true,schema:{type:'object',properties:{best_answer:{type:'string'},alternatives:{type:'array',items:{type:'string'},minItems:2,maxItems:2}},required:['best_answer','alternatives'],additionalProperties:false}}}});
const auditor=new BlindPuzzleAuditor(auditClient);
const indianPattern=/india|indian|bollywood|hindi|cricket|biryani|dosa|puri|gulab jamun|jalebi|mumbai|delhi|agra|tendulkar|kolkata|chennai|diwali|sitar|tabla/i;
const isIndiaFriendly=(puzzle:Puzzle)=>indianPattern.test([puzzle.answer,puzzle.halfA,puzzle.halfB].join(' '));
const categories:PuzzleCategory[]=['general','games','music','science','sport','food','geography','movies'];
const difficulties:PuzzleDifficulty[]=['easy','medium','hard'];
const generatedPool:Array<{puzzle:Puzzle;audit:PuzzleAuditResult;india:boolean}>=[];
const auditResults:PuzzleAuditResult[]=[];
let generated=0;let validationFailed=0;let auditFailed=0;const validationReasons:string[]=[];
const avoidAuditFailures:string[]=[];
try{const saved=JSON.parse(await readFile(progressPath,'utf8')) as {generationModel?:string;auditModel?:string;generatedPool?:typeof generatedPool;auditResults?:PuzzleAuditResult[];generated?:number;validationFailed?:number;auditFailed?:number;validationReasons?:string[];avoidAuditFailures?:string[]};if(saved.generationModel===Config.LLM_MODEL&&saved.auditModel===Config.AUDIT_MODEL){generatedPool.push(...(saved.generatedPool??[]));auditResults.push(...(saved.auditResults??[]));generated=saved.generated??0;validationFailed=saved.validationFailed??0;auditFailed=saved.auditFailed??0;validationReasons.push(...(saved.validationReasons??[]));avoidAuditFailures.push(...(saved.avoidAuditFailures??[]));}}catch{}
while(generated<800&&(generatedPool.length<target||generatedPool.filter(item=>item.india).length<5)){
  const indiaStillNeeded=Math.max(0,5-generatedPool.filter(item=>item.india).length);
  const count=Math.min(4,Math.max(target-generatedPool.length,indiaStillNeeded,1));
  const ordered=[...retained,...generatedPool.map(item=>item.puzzle)];
  const categoryCounts=new Map(categories.map(category=>[category,ordered.filter(puzzle=>puzzle.category===category).length]));
  const categoryFocus=[...categories].sort((a,b)=>categoryCounts.get(a)!-categoryCounts.get(b)!);
  const plan:CandidatePlan={count,categoryFocus,indiaFriendlyCount:indiaStillNeeded?Math.min(count,indiaStillNeeded+2):0,difficultyFocus:[...difficulties],avoidAuditFailures:avoidAuditFailures.slice(-8)};
  const candidates=await generatePuzzleCandidates(generationClient,plan);
  const batchOffset=generated;generated+=candidates.length;
  const filtered=await filterPuzzleCandidates(candidates,auditor,{existing:ordered,idForCandidate:index=>`gen-${String(batchOffset+index+1).padStart(3,'0')}`});
  validationFailed+=filtered.validationFailed;auditFailed+=filtered.auditFailed;validationReasons.push(...filtered.validationReasons);auditResults.push(...filtered.auditResults);
  const candidateById=new Map(candidates.map((candidate,index)=>[`gen-${String(batchOffset+index+1).padStart(3,'0')}`,candidate]));
  for(const failure of filtered.auditResults.filter(result=>!result.passed)){const candidate=candidateById.get(failure.id);const detail=`${candidate?.answer??failure.id}: A=${failure.halfA.best_answer}; B=${failure.halfB.best_answer}; pair=${failure.both.best_answer}.`;avoidAuditFailures.push(detail);console.log(`Blind-audit reject ${detail}`);}
  const auditById=new Map(filtered.auditResults.map(result=>[result.id,result]));
  for(const puzzle of filtered.kept){const audit=auditById.get(puzzle.id);if(audit)generatedPool.push({puzzle,audit,india:isIndiaFriendly(puzzle)});}
  await mkdir(resolve('data'),{recursive:true});await writeFile(progressPath,JSON.stringify({generationModel:Config.LLM_MODEL,auditModel:Config.AUDIT_MODEL,generatedPool,auditResults,generated,validationFailed,auditFailed,validationReasons,avoidAuditFailures:avoidAuditFailures.slice(-16)},null,2)+'\n','utf8');
  console.log(`Generated ${generated}; validation failures ${validationFailed}; audit failures ${auditFailed}; blind passes ${generatedPool.length}; India-friendly passes ${generatedPool.filter(item=>item.india).length}.`);
  if(!candidates.length)await pause(2500);
}
if(generatedPool.length<target||generatedPool.filter(item=>item.india).length<5)throw new Error(`Could not generate enough passing puzzles within 800 candidates. Kept ${generatedPool.length}; India-friendly ${generatedPool.filter(item=>item.india).length}.`);

const selected:typeof generatedPool=[];
const categoryTally=new Map(categories.map(category=>[category,retained.filter(puzzle=>puzzle.category===category).length]));
const difficultyTally=new Map(difficulties.map(difficulty=>[difficulty,retained.filter(puzzle=>puzzle.difficulty===difficulty).length]));
function take(item:typeof generatedPool[number]){selected.push(item);categoryTally.set(item.puzzle.category,(categoryTally.get(item.puzzle.category)??0)+1);difficultyTally.set(item.puzzle.difficulty,(difficultyTally.get(item.puzzle.difficulty)??0)+1);}
for(const item of generatedPool.filter(item=>item.india))if(selected.filter(choice=>choice.india).length<5&&selected.length<target)take(item);
while(selected.length<target){const remaining=generatedPool.filter(item=>!selected.includes(item)).sort((a,b)=>{const score=(item:typeof a)=>((categoryTally.get(item.puzzle.category)??0)*3)+(difficultyTally.get(item.puzzle.difficulty)??0);return score(a)-score(b);});const next=remaining[0];if(!next)break;take(next);}
if(selected.length!==target||selected.filter(item=>item.india).length<5)throw new Error('The audited candidate pool did not meet pack size and India-friendly targets.');
const generatedPuzzles=selected.map(item=>item.puzzle);
const finalPack=[...retained,...generatedPuzzles];
const finalResults=[...retainedResults as PuzzleAuditResult[],...selected.map(item=>item.audit)];
const passed=finalResults.filter(result=>result.passed).length;
const generatedPassed=auditResults.filter(result=>result.passed).length;
const rounds=[...(report.rounds??[]),{round:(report.rounds?.length??0)+1,puzzlesAudited:auditResults.length,passed:generatedPassed}];
const finalReport:AuditReport={generatedAt:new Date().toISOString(),model:Config.AUDIT_MODEL,total:finalPack.length,passed,passRate:passed/finalPack.length,results:finalResults,rounds};
if(finalReport.total!==60||finalReport.passRate!==1)throw new Error('Refusing to write a non-passing pack or blind audit report.');
const source=`import type { Puzzle } from './types.js';\nexport const generatedPack: Puzzle[]=${JSON.stringify(generatedPuzzles,null,2)};\n`;
await writeFile(outputPath,source,'utf8');
await writeFile(reportPath,JSON.stringify(finalReport,null,2)+'\n','utf8');
await writeFile(generationReportPath,JSON.stringify({generated,validationFailed,auditFailed,blindPassed:generatedPassed,kept:generatedPuzzles.length,indiaFriendlyKept:generatedPool.filter(item=>selected.includes(item)&&item.india).length,auditModel:Config.AUDIT_MODEL,generationModel:Config.LLM_MODEL,generatedAt:finalReport.generatedAt,validationReasons},null,2)+'\n','utf8');
const readable=['# Twinclue Puzzle Pack Blind Audit','',`- Date: ${finalReport.generatedAt}`,`- Audit model: ${finalReport.model}`,`- Current result: ${finalReport.passed}/${finalReport.total} passed (${(finalReport.passRate*100).toFixed(1)}%)`,'','Each round uses the same three-request blind prompt, referee, model and low-concurrency audit settings. Only changed or generated puzzles are queried; earlier passed puzzles are kept by fingerprint.','', '## Audit rounds','','| Round | Puzzles audited | Passed |','| --- | ---: | ---: |',...rounds.map(round=>`| ${round.round} | ${round.puzzlesAudited} | ${round.passed} |`),'','## Generated candidate batch','','- Candidates generated: '+generated,`- Failed validation: ${validationFailed}`,`- Passed validation and failed blind audit: ${auditFailed}`,`- Blind-audit passes generated: ${generatedPassed}`,`- Generated puzzles kept: ${generatedPuzzles.length}`,`- India-friendly puzzles in final pack: ${finalPack.filter(isIndiaFriendly).length}`,'',`Candidates were generated with ${Config.LLM_MODEL}, structurally checked by validatePuzzle, then judged by the unchanged blind auditor using ${Config.AUDIT_MODEL}. The final pack retains ${retained.length} earlier passes and adds ${generatedPuzzles.length} generated passes.`,'','## Puzzle results',''];
for(const result of finalResults){readable.push(`### ${result.id}: ${result.answer} (${result.passed?'PASS':'FAIL'})`,`- Half A alone: best answer **${result.halfA.best_answer}**; referee **${result.halfA.referee}**; alternatives: ${result.halfA.alternatives.join(', ')}.`,`- Half B alone: best answer **${result.halfB.best_answer}**; referee **${result.halfB.referee}**; alternatives: ${result.halfB.alternatives.join(', ')}.`,`- Both halves: best answer **${result.both.best_answer}**; referee **${result.both.referee}**; alternatives: ${result.both.alternatives.join(', ')}.`);readable.push('');}
await writeFile(resolve('docs/PUZZLE_AUDIT.md'),readable.join('\n'),'utf8');
console.log(`Generated ${generated} candidates. ${validationFailed} failed validation; ${auditFailed} failed the blind audit. Kept ${generatedPuzzles.length}; final pack ${passed}/60.`);
