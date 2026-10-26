import 'dotenv/config';
import { z } from 'zod';
import { resolve } from 'node:path';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { puzzlePack } from './pack.js';
import { auditPack,BlindPuzzleAuditor,type PuzzleAuditResult,type AuditReport } from './audit.js';
import { LlmClient } from '../llm/client.js';

const Config=z.object({LLM_BASE_URL:z.string().url(),LLM_API_KEY:z.string().min(1),LLM_MODEL:z.string().min(1),AUDIT_MODEL:z.string().min(1)}).parse(process.env);
const reportPath=resolve('src/puzzle/audit-report.json');
const checkpointPath=resolve('data/audit-progress.json');
const client=new LlmClient({baseUrl:Config.LLM_BASE_URL,apiKey:Config.LLM_API_KEY,model:Config.AUDIT_MODEL,timeoutMs:60_000,retries:4,minimumIntervalMs:2100,maxCompletionTokens:128,reasoningEffort:'none',responseFormat:{type:'json_schema',json_schema:{name:'blind_answer',strict:true,schema:{type:'object',properties:{best_answer:{type:'string'},alternatives:{type:'array',items:{type:'string'},minItems:2,maxItems:2}},required:['best_answer','alternatives'],additionalProperties:false}}}});
const requestedIds=process.argv.find(argument=>argument.startsWith('--ids='))?.slice(6).split(',').filter(Boolean);
const puzzles=requestedIds?.length?puzzlePack.filter(puzzle=>requestedIds.includes(puzzle.id)):puzzlePack;
if(!puzzles.length)throw new Error('No pack puzzles matched the requested audit ids.');
let previous:AuditReport|undefined;
try{previous=JSON.parse(await readFile(reportPath,'utf8')) as AuditReport;}catch{}
let resume:PuzzleAuditResult[]=[];
try{const saved=JSON.parse(await readFile(checkpointPath,'utf8')) as {model?:string;results?:PuzzleAuditResult[]};if(saved.model===Config.AUDIT_MODEL)resume=saved.results??[];}catch{}
const partial=await auditPack(puzzles,new BlindPuzzleAuditor(client),{concurrency:1,model:Config.AUDIT_MODEL,checkpointPath,resume,onProgress:(done,total)=>{if(done%10===0||done===total)console.log(`Blind audit progress: ${done}/${total} puzzles.`);}});
const merged=new Map((previous?.results??[]).map(result=>[result.id,result]));for(const result of partial.results)merged.set(result.id,result);
const results=puzzlePack.map(puzzle=>merged.get(puzzle.id)).filter((result):result is PuzzleAuditResult=>result!==undefined);
if(results.length!==puzzlePack.length)throw new Error('Audit report is missing puzzle results.');
const passed=results.filter(result=>result.passed).length;
const rounds=previous?.rounds??[{round:1,puzzlesAudited:puzzlePack.length,passed:previous?.passed??passed}];
const roundNumber=rounds.length+1;
rounds.push({round:roundNumber,puzzlesAudited:puzzles.length,passed:partial.passed});
const report:AuditReport={generatedAt:new Date().toISOString(),model:Config.AUDIT_MODEL,total:results.length,passed,passRate:passed/results.length,results,rounds};
await mkdir(resolve('src/puzzle'),{recursive:true});
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
const readable=['# Twinclue Puzzle Pack Blind Audit','',`- Model: ${report.model}`,`- Latest run: ${report.generatedAt}`,`- Current result: ${report.passed}/${report.total} passed (${(report.passRate*100).toFixed(1)}%)`,'','The audit settings and three-request blind prompt stayed fixed for every round. A round only re-audits puzzles whose clues changed; earlier passes remain untouched.','', '## Audit rounds','','| Round | Puzzles audited | Passed |','| --- | ---: | ---: |',...report.rounds!.map(round=>`| ${round.round} | ${round.puzzlesAudited} | ${round.passed} |`),'','## Puzzle results',''];
for(const result of report.results){readable.push(`### ${result.id}: ${result.answer} (${result.passed?'PASS':'FAIL'})`,`- Half A alone: best answer **${result.halfA.best_answer}**; referee **${result.halfA.referee}**; alternatives: ${result.halfA.alternatives.join(', ')}.`,`- Half B alone: best answer **${result.halfB.best_answer}**; referee **${result.halfB.referee}**; alternatives: ${result.halfB.alternatives.join(', ')}.`,`- Both halves: best answer **${result.both.best_answer}**; referee **${result.both.referee}**; alternatives: ${result.both.alternatives.join(', ')}.`);for(const failure of result.failures)readable.push(`- Failure: ${failure}`);readable.push('');}
await mkdir(resolve('docs'),{recursive:true});await writeFile(resolve('docs/PUZZLE_AUDIT.md'),readable.join('\n'),'utf8');
console.log(`Blind puzzle audit: ${report.passed}/${report.total} passed (${(report.passRate*100).toFixed(1)}%) using ${report.model}.`);
console.log(`Round ${roundNumber}: ${puzzles.length} puzzle(s) audited, ${partial.passed} passed.`);
console.log('Report: src/puzzle/audit-report.json');
if(report.passed!==report.total)process.exitCode=1;
