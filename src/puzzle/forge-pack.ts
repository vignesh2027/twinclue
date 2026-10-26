import 'dotenv/config';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {z} from 'zod';
import {searchTables,type FactTable,type ForgeCandidate} from './forge.js';
import {validatePuzzle} from './validate.js';
import {PuzzleSchema,type Puzzle} from './types.js';
import {LlmClient,LlmQuotaError} from '../llm/client.js';
import {resolveModel,clientsForModels} from '../llm/providers.js';
import {BlindPuzzleAuditor,auditPack,AUDIT_VERSION,puzzleFingerprint,type AuditReport,type PuzzleAuditResult} from './audit.js';

const solverModels=(process.env.AUDIT_MODELS??'gemini:gemini-3.5-flash,gemini:gemini-2.5-flash,groq:openai/gpt-oss-20b').split(',').map(x=>x.trim()).filter(Boolean);
const factModel=process.env.FACT_MODEL?.trim()||'groq:openai/gpt-oss-20b';
const maxPack=Number(process.env.FORGE_TARGET??80);
const quotaPath=resolve('data/forge-progress.json');const reportPath=resolve('src/puzzle/audit-report.json');
const polishedSchema=z.object({items:z.array(z.object({id:z.string(),halfA:z.string(),halfB:z.string()}))});
async function loadTables():Promise<FactTable[]>{const custom=process.argv.find((x,i,a)=>a[i-1]==='--table');if(custom){if(!/^custom\/[A-Za-z0-9._/-]+\.csv$/.test(custom)||custom.split('/').includes('..'))throw new Error('Use a CSV path inside facts/custom/.');return [await readCustomCsv(resolve('facts',custom))];}const files=(await readdir('facts')).filter(f=>f.endsWith('.json'));return Promise.all(files.map(async file=>{const raw=JSON.parse(await readFile(resolve('facts',file),'utf8')) as {_meta:{category:string;sources:string[];license:string};entities:FactTable['entities']};return {category:raw._meta.category,entities:raw.entities,sources:raw._meta.sources,license:raw._meta.license};}));}
async function readCustomCsv(path:string):Promise<FactTable>{const text=await readFile(path,'utf8');const rows=parseCsv(text);if(rows.length<2)throw new Error('Custom fact table needs a header and at least one entity.');const [header,...data]=rows;if(!header||header[0]?.toLowerCase()!=='name'||header[1]?.toLowerCase()!=='aliases'||header[2]?.toLowerCase()!=='fame')throw new Error('CSV columns must start with name, aliases, fame, then attributes.');const entities=data.filter(row=>row.some(Boolean)).map(row=>{const values=Object.fromEntries(header.map((key,i)=>[key,row[i]??'']));const fame=Number(values.fame);if(!values.name?.trim()||![1,2,3].includes(fame))throw new Error('Every custom row needs a name and fame score of 1, 2, or 3.');const attributes:Record<string,string|string[]|number|boolean>={};for(const key of header.slice(3)){const raw=values[key]??'';if(raw)attributes[key]=raw.includes('|')?raw.split('|').map(v=>v.trim()).filter(Boolean):raw;}return {name:values.name??'',aliases:(values.aliases??'').split('|').filter(Boolean),fame:fame as 1|2|3,attributes};});return {category:basename(path,'.csv'),entities,sources:[`User supplied ${path}`],license:'User supplied; rights remain with the uploader'};}
function parseCsv(input:string):string[][]{return input.trim().split(/\r?\n/).map(line=>{const cells:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const char=line[i]!;if(char==='"'&&line[i+1]==='"'&&quoted){value+='"';i++;}else if(char==='"')quoted=!quoted;else if(char===','&&!quoted){cells.push(value);value='';}else value+=char;}cells.push(value);return cells;});}
function chooseCandidates(candidates:ForgeCandidate[],target:number):ForgeCandidate[]{const pools=new Map<string,ForgeCandidate[]>();for(const puzzle of candidates){const items=pools.get(puzzle.category)??[];items.push(puzzle);pools.set(puzzle.category,items);}for(const items of pools.values())items.sort((a,b)=>a.predicates.setSizeA+a.predicates.setSizeB-(b.predicates.setSizeA+b.predicates.setSizeB));const quotas:Record<string,number>={games:Math.ceil(target*.25),geography:Math.ceil(target*.15),science:Math.ceil(target*.15),music:Math.ceil(target*.15),food:Math.ceil(target*.15),sport:Math.ceil(target*.15)};const chosen:ForgeCandidate[]=[];for(const [category,quota] of Object.entries(quotas)){chosen.push(...(pools.get(category)??[]).splice(0,quota));}const rest=[...pools.values()].flat();for(const item of rest){if(chosen.length>=target)break;chosen.push(item);}return chosen.slice(0,target);}

async function polish(candidates:ForgeCandidate[]):Promise<{model:string;usage:Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>}>{const requested=process.env.LLM_MODEL?.trim();if(!requested)return {model:'attribute templates',usage:{}};const fallback='groq:openai/gpt-oss-20b';const modelNames=[requested,fallback];const clients=modelNames.map(model=>new LlmClient({...resolveModel(model),maxCompletionTokens:4096,reasoningEffort:'low',minimumIntervalMs:1800}));let active=0;for(let i=0;i<candidates.length;i+=8){const batch=candidates.slice(i,i+8);const messages=[{role:'system' as const,content:'Polish each pair of clue halves into natural, playful, concise English. Preserve every listed attribute predicate exactly. Do not add, remove, or strengthen any fact. Do not name the answer or aliases. Return JSON with items containing id, halfA, halfB.'},{role:'user' as const,content:JSON.stringify(batch.map(p=>({id:p.id,answer:p.answer,aliases:p.aliases,halfA:p.halfA,halfB:p.halfB,predicates:p.predicates})))}];let done=false;while(!done){try{const result=await clients[active]!.chatJsonWithUsage(messages,polishedSchema);for(const row of result.value.items){const item=batch.find(p=>p.id===row.id);if(item){const previousA=item.halfA,previousB=item.halfB;item.halfA=row.halfA;item.halfB=row.halfB;if(validatePuzzle(item).length){item.halfA=previousA;item.halfB=previousB;}}}done=true;}catch(error){if(error instanceof LlmQuotaError&&error.daily&&active===0&&modelNames.length>1){active=1;continue;}console.log(`Polishing unavailable at batch ${i/8+1}; remaining candidates keep the validated templates.`);return {model:active===0?requested:fallback,usage:Object.fromEntries(modelNames.slice(0,active+1).map((model,index)=>[model,clients[index]!.tokenUsage]))};}}}return {model:modelNames[active]!,usage:{[modelNames[active]!]:clients[active]!.tokenUsage}};}

interface ForgeCheckpoint {auditVersion:number;solverModels:string[];factModel:string;results:PuzzleAuditResult[];tokenUsage:Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>;candidatePuzzles?:ForgeCandidate[];generationModel?:string;polishingUsage?:Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>;}
function mergeUsage(...groups:Array<Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>>):Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>{const usage:Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>={};for(const group of groups)for(const [model,current] of Object.entries(group)){const previous=usage[model]??{promptTokens:0,completionTokens:0,totalTokens:0};usage[model]={promptTokens:previous.promptTokens+current.promptTokens,completionTokens:previous.completionTokens+current.completionTokens,totalTokens:previous.totalTokens+current.totalTokens};}return usage;}
async function main():Promise<void>{
 const tables=await loadTables();const found=searchTables(tables,5);const valid=found.filter(candidate=>PuzzleSchema.safeParse(candidate).success&&validatePuzzle(candidate).length===0);const chosen=chooseCandidates(valid,maxPack);console.log(`Constraint search produced ${found.length} candidates, ${found.length-valid.length} failed validation, ${chosen.length} selected.`);if(chosen.length<40)throw new Error(`Only ${chosen.length} valid candidates found. At least 40 are needed.`);
 let saved:ForgeCheckpoint|undefined;try{saved=JSON.parse(await readFile(quotaPath,'utf8')) as ForgeCheckpoint;}catch{}
 const checkpointMatches=saved?.auditVersion===AUDIT_VERSION&&JSON.stringify(saved.solverModels)===JSON.stringify(solverModels)&&saved.factModel===factModel;
 const priorCandidates=checkpointMatches&&saved?.candidatePuzzles?.length?saved.candidatePuzzles:undefined;
 const candidateRows=priorCandidates??chosen;
 const polishing=priorCandidates?{model:saved?.generationModel??'resumed polished templates',usage:saved?.polishingUsage??{}}:await polish(candidateRows);
 const generationModel=polishing.model;const puzzles=candidateRows.filter(p=>PuzzleSchema.safeParse(p).success&&validatePuzzle(p).length===0) as Puzzle[];
 const clients=clientsForModels([...new Set([...solverModels,factModel])]);const auditor=new BlindPuzzleAuditor(clients,{solverModels,factModel,batchSize:Number(process.env.AUDIT_BATCH??8)});
 let resume:PuzzleAuditResult[]=checkpointMatches?saved?.results??[]:[];if(checkpointMatches)for(const [model,usage] of Object.entries(saved?.tokenUsage??{}))clients[model]?.restoreTokenUsage(usage);
 const polishingUsage=polishing.usage;const progress=new Map(resume.map(result=>[result.id,result]));const checkpoint=async()=>{await mkdir('data',{recursive:true});await writeFile(quotaPath,JSON.stringify({auditVersion:AUDIT_VERSION,solverModels,factModel,results:[...progress.values()],tokenUsage:auditor.tokenUsage,candidatePuzzles:candidateRows,generationModel,polishingUsage},null,2)+'\n');};await checkpoint();
 let result:PuzzleAuditResult[]=[];let quotaStopped=false;let quotaMessage:string|undefined;
 try{const report=await auditPack(puzzles,auditor,{solverModels,factModel,batchSize:Number(process.env.AUDIT_BATCH??8),resume,onProgress:async(done,total,item)=>{progress.set(item.id,item);await checkpoint();if(done%4===0||done===total)console.log(`Blind audit v2.1: ${done}/${total}.`);}});result=report.results;}
 catch(error){const transient=error instanceof Error&&/LLM request failed \(5\d\d\)/.test(error.message);if(!(error instanceof LlmQuotaError)&&!transient)throw error;quotaStopped=true;quotaMessage=error instanceof Error?error.message:'Model quota exhausted.';result=[...progress.values()];await checkpoint();console.log(`${error instanceof LlmQuotaError?(error.daily?'Daily quota':'Per-minute quota'):'Model service'} stopped the audit. Resumable progress is saved at ${quotaPath}.`);}
 const passById=new Map(result.filter(r=>r.passed).map(r=>[r.id,r]));const kept=puzzles.filter(p=>passById.has(p.id)).slice(0,80);const failures=result.filter(r=>!r.passed).length;await mkdir('src/puzzle',{recursive:true});if(kept.length>=40)await writeFile('src/puzzle/forged-pack.ts',`import type { Puzzle } from './types.js';\nexport const forgedPack: Puzzle[]=${JSON.stringify(kept,null,2)};\n`);const usage=mergeUsage(auditor.tokenUsage,polishingUsage);const relevant=kept.map(p=>passById.get(p.id)!);const allSolverRows=relevant.flatMap(r=>[...r.solvers.halfA,...r.solvers.halfB,...r.solvers.both]);const singleRows=result.flatMap(r=>r.solvers.halfA.concat(r.solvers.halfB));const bothRows=result.flatMap(r=>r.solvers.both);const report:AuditReport={auditVersion:AUDIT_VERSION,generatedAt:new Date().toISOString(),solverModels,factModel,passRule:'A majority of solvers must reject each half alone; a majority must accept both halves; both facts must be verified true.',total:kept.length,passed:kept.length,passRate:kept.length?1:null,singleHalfHitRate:singleRows.length?singleRows.filter(r=>r.referee==='accepted').length/singleRows.length:null,bothHalvesHitRate:bothRows.length?bothRows.filter(r=>r.referee==='accepted').length/bothRows.length:null,tokenUsage:usage,results:relevant,rounds:[{round:1,puzzlesAudited:result.length,passed:result.filter(r=>r.passed).length}]};
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');const categories=Object.fromEntries([...new Set(kept.map(p=>p.category))].map(category=>[category,kept.filter(p=>p.category===category).length]));const selectedCategories=Object.fromEntries([...new Set(chosen.map(p=>p.category))].map(category=>[category,chosen.filter(p=>p.category===category).length]));await mkdir('docs',{recursive:true});await writeFile('docs/PUZZLE_AUDIT.md',`# Puzzle audit

## Version 1
The first audit used shallow free-text prompts and low reasoning. It let through single-half giveaways and false clues. Examples included the Fandango lyric for Bohemian Rhapsody, Taylor Swift's 1989 and Folklore albums, Sachin Tendulkar's Little Master nickname and century record, the King of Pop, the ruler of Hyrule, Serena Williams's 23 major singles titles, and the Venus Rosewater Dish.

## Version 2
The stricter blind audit improved reasoning and added a fact verifier. It still tested free-text model-written clues, which often pointed to the prototype of a set. The 8 audited v2 puzzles all failed. A timing aid pointed to hourglass from one half, and a clue about more than 100 known moons pointed to Saturn. The solver panel used low reasoning and only 128 completion tokens, and did not enforce clue truth. Review also found false Mysore Palace, Pav Bhaji, and biryani claims. The report included gen-042's Master Blaster clue, gen-160's Yamuna and Agra clue, gen-016's 10-rupee-note clue, plus the Lagaan, Dangal, Kilimanjaro, Beethoven, Jai Ho, Mumbai, and Miso giveaways. The v2 report is archived in docs/archive/slice-5.

## Version 2.1 Puzzle Forge
Candidates come from curated attribute tables and deterministic set intersections. Each side set must contain at least five members. Two other members in each set must be at least as famous as the answer. A majority of solvers must reject each half alone, a majority must solve both halves together, and both halves must pass fact verification.

- Solvers: ${solverModels.join(', ')}
- Fact model: ${factModel}
- Constraint candidates generated: ${found.length}
- Failed validation: ${found.length-valid.length}
- Passed validation: ${valid.length}
- Selected for blind audit: ${puzzles.length}
- Completed blind audits: ${result.length}
- Audit failures: ${result.length?failures:'not measured because no audit completed'}
- Kept: ${kept.length}
- Pass rate: ${result.length?`${(report.passRate??0)*100}%`:'not measured, 0 audited'}
- Aggregate single-half hit rate: ${report.singleHalfHitRate===null?'not measured':`${(report.singleHalfHitRate*100).toFixed(1)}%`}
- Aggregate both-halves hit rate: ${report.bothHalvesHitRate===null?'not measured':`${(report.bothHalvesHitRate*100).toFixed(1)}%`}
- Generation wording model: ${generationModel}
- Token usage by model: ${JSON.stringify(usage)}
- Quota state: ${quotaMessage??'no quota stop'}
- Resume checkpoint: data/forge-progress.json
- Final pack category counts: ${JSON.stringify(categories)}\n- Selected candidates by category before audit: ${JSON.stringify(selectedCategories)}

| Round | Puzzles audited | Passed |
|---:|---:|---:|
| 1 | ${result.length} | ${result.filter(r=>r.passed).length} |

| Puzzle | Category | Set A | Set B | Answer | Pass |
|---|---|---:|---:|---|---|
${kept.map(p=>`| ${p.id} | ${p.category} | ${p.predicates?.setSizeA??'?'} | ${p.predicates?.setSizeB??'?'} | ${p.answer} | yes |`).join('\n')}

## Audit failures

${result.filter(r=>!r.passed).map(r=>`- ${r.id} (${r.answer}): ${r.failures.join(' ')}`).join('\n')||'No completed audit results.'}
`);
 if(kept.length>=40)await writeFile('src/puzzle/pack.ts',"import { forgedPack } from './forged-pack.js';\nexport const puzzlePack=forgedPack;\n");const summary={generated:found.length,validationFailed:found.length-valid.length,selectedCandidatesByCategory:selectedCategories,auditFailed:result.length?failures:null,kept:kept.length,quotaStopped,quotaMessage,solverModels,factModel,generationModel,tokenUsage:usage};await writeFile('data/forge-stats.json',JSON.stringify(summary,null,2)+'\n');if(kept.length<40)console.log(`Only ${kept.length} puzzles passed v2.1 so far. The active pack was left unchanged until at least 40 audited puzzles are available.`);console.log(JSON.stringify(summary,null,2));if(!quotaStopped&&kept.length<40)process.exitCode=1;
}
await main();
