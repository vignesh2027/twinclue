import 'dotenv/config';
import { z } from 'zod';
import { resolve } from 'node:path';
import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import { puzzlePack } from './pack.js';
import { auditPack,BlindPuzzleAuditor,type PuzzleAuditResult } from './audit.js';
import { LlmClient } from '../llm/client.js';

const Config=z.object({LLM_BASE_URL:z.string().url(),LLM_API_KEY:z.string().min(1),LLM_MODEL:z.string().min(1),AUDIT_MODEL:z.string().min(1)}).parse(process.env);
async function run(model:string){const client=new LlmClient({baseUrl:Config.LLM_BASE_URL,apiKey:Config.LLM_API_KEY,model,timeoutMs:60_000,retries:4,minimumIntervalMs:2100,maxCompletionTokens:128,reasoningEffort:'none',responseFormat:{type:'json_schema',json_schema:{name:'blind_answer',strict:true,schema:{type:'object',properties:{best_answer:{type:'string'},alternatives:{type:'array',items:{type:'string'},minItems:2,maxItems:2}},required:['best_answer','alternatives'],additionalProperties:false}}}});const checkpointPath=resolve('data/audit-progress.json');let resume:PuzzleAuditResult[]=[];try{const saved=JSON.parse(await readFile(checkpointPath,'utf8')) as {model?:string;results?:PuzzleAuditResult[]};if(saved.model===model)resume=saved.results??[];}catch{}const report=await auditPack(puzzlePack,new BlindPuzzleAuditor(client),{concurrency:1,model,reportPath:resolve('src/puzzle/audit-report.json'),checkpointPath,resume,onProgress:(done,total)=>{if(done%10===0||done===total)console.log(`Blind audit progress: ${done}/${total} puzzles.`);}});if(report.passRate===1)await unlink(checkpointPath).catch(()=>undefined);return report;}
let model=Config.AUDIT_MODEL;let report;
try{report=await run(model);}catch(error){if(!(error instanceof Error&&error.message.includes('(404)'))||model===Config.LLM_MODEL)throw error;console.log('Configured AUDIT_MODEL is unavailable; retrying with configured LLM_MODEL.');model=Config.LLM_MODEL;report=await run(model);}
console.log(`Blind puzzle audit: ${report.passed}/${report.total} passed (${(report.passRate*100).toFixed(1)}%) using ${model}.`);
console.log(`Report: src/puzzle/audit-report.json`);
const readable=['# Twinclue Puzzle Pack Blind Audit','',`- Run: ${report.generatedAt}`,`- Model: ${report.model}`,`- Result: ${report.passed}/${report.total} passed (${(report.passRate*100).toFixed(1)}%)`,'','Each clue half and each paired clue were sent in separate requests. The blind solver was not shown the stored answer. Results are judged with Twinclue’s exact referee rules.','','## Puzzle results',''];
for(const result of report.results){readable.push(`### ${result.id}: ${result.answer} (${result.passed?'PASS':'FAIL'})`,`- Half A alone: best answer **${result.halfA.best_answer}**; referee **${result.halfA.referee}**; alternatives: ${result.halfA.alternatives.join(', ')}.`,`- Half B alone: best answer **${result.halfB.best_answer}**; referee **${result.halfB.referee}**; alternatives: ${result.halfB.alternatives.join(', ')}.`,`- Both halves: best answer **${result.both.best_answer}**; referee **${result.both.referee}**; alternatives: ${result.both.alternatives.join(', ')}.`);if(result.failures.length)for(const failure of result.failures)readable.push(`- Failure: ${failure}`);readable.push('');}
await mkdir(resolve('docs'),{recursive:true});await writeFile(resolve('docs/PUZZLE_AUDIT.md'),readable.join('\n'),'utf8');
if(report.passed!==report.total)process.exitCode=1;
