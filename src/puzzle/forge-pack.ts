import 'dotenv/config';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {searchTables,type FactTable,type ForgeCandidate} from './forge.js';
import {validatePuzzle} from './validate.js';
import {PuzzleSchema,type Puzzle} from './types.js';
import {clientsForModels} from '../llm/providers.js';
import {BlindPuzzleAuditor,AUDIT_VERSION,MIN_VALID_SOLVERS,buildReport,clueText,invalidAnswerReason,puzzleFingerprint,statusOf,type PuzzleAuditResult} from './audit.js';
import {DEFAULT_FACT_MODELS,factCheckCandidates} from './fact-check.js';
import {withHints} from './hints.js';
import {normaliseGuess} from '../game/referee.js';
import {parseCsv} from './csv.js';

const solverModels=(process.env.AUDIT_MODELS??'gemini:gemini-3.5-flash,gemini:gemini-2.5-flash,groq:openai/gpt-oss-20b').split(',').map(x=>x.trim()).filter(Boolean);
const factModels=(process.env.FACT_MODELS??DEFAULT_FACT_MODELS.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
const maxPack=Number(process.env.FORGE_TARGET??80);
// Auditing continues across runs until this many puzzles pass within the category quotas, or candidates run out.
const passTarget=Number(process.env.FORGE_PASS_TARGET??60);
// --dry-run stops after the deterministic search, validation and quota selection.
const dryRun=process.argv.includes('--dry-run');
// --hints adds hint lines to the shipped pack without auditing again; halves, ids and fingerprints do not change.
const hintsOnly=process.argv.includes('--hints');
const quotaPath=resolve('data/forge-progress.json');const reportPath=resolve('src/puzzle/audit-report.json');const verdictsPath=resolve('facts/verdicts.json');
async function loadTables():Promise<FactTable[]>{const custom=process.argv.find((x,i,a)=>a[i-1]==='--table');if(custom){if(!/^custom\/[A-Za-z0-9._/-]+\.csv$/.test(custom)||custom.split('/').includes('..'))throw new Error('Use a CSV path inside facts/custom/.');return [await readCustomCsv(resolve('facts',custom))];}const files=(await readdir('facts')).filter(f=>f.endsWith('.json')&&f!=='verdicts.json');return Promise.all(files.map(async file=>{const raw=JSON.parse(await readFile(resolve('facts',file),'utf8')) as {_meta:{category:string;sources:string[];license:string};entities:FactTable['entities']};return {category:raw._meta.category,entities:raw.entities,sources:raw._meta.sources,license:raw._meta.license};}));}
async function readCustomCsv(path:string):Promise<FactTable>{const text=await readFile(path,'utf8');const rows=parseCsv(text);if(rows.length<2)throw new Error('Custom fact table needs a header and at least one entity.');const [header,...data]=rows;if(!header||header[0]?.toLowerCase()!=='name'||header[1]?.toLowerCase()!=='aliases'||header[2]?.toLowerCase()!=='fame')throw new Error('CSV columns must start with name, aliases, fame, then attributes.');const entities=data.filter(row=>row.some(Boolean)).map(row=>{const values=Object.fromEntries(header.map((key,i)=>[key,row[i]??'']));const fame=Number(values.fame);if(!values.name?.trim()||![1,2,3].includes(fame))throw new Error('Every custom row needs a name and fame score of 1, 2, or 3.');const attributes:Record<string,string|string[]|number|boolean>={};for(const key of header.slice(3)){const raw=values[key]??'';if(raw)attributes[key]=raw.includes('|')?raw.split('|').map(v=>v.trim()).filter(Boolean):raw;}return {name:values.name??'',aliases:(values.aliases??'').split('|').filter(Boolean),fame:fame as 1|2|3,attributes};});return {category:basename(path,'.csv'),entities,sources:[`User supplied ${path}`],license:'User supplied; rights remain with the uploader'};}
export const FORGE_QUOTAS:Record<string,number>={
  'video game characters':18,countries:14,animals:12,'foods and dishes':12,
  'musical instruments':8,'space objects':8,sports:8,
};
export function chooseCandidates(candidates:ForgeCandidate[],target=80):ForgeCandidate[]{
 const pools=new Map<string,ForgeCandidate[]>();
 for(const puzzle of candidates){const items=pools.get(puzzle.sourceTable)??[];items.push(puzzle);pools.set(puzzle.sourceTable,items);}
 for(const items of pools.values())items.sort((a,b)=>score(a)-score(b)||a.answer.localeCompare(b.answer));
 const quotas=target===80?FORGE_QUOTAS:Object.fromEntries(Object.entries(FORGE_QUOTAS).map(([key,count])=>[key,Math.round(count*target/80)]));
 const chosen:ForgeCandidate[]=[];const answers=new Set<string>();const seenMirrors=new Set<string>();
 for(const [table,quota] of Object.entries(quotas))for(const puzzle of pools.get(table)??[]){if(chosen.filter(item=>item.sourceTable===table).length>=quota)break;const names=[puzzle.answer,...puzzle.aliases].map(name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase());const answer=names[0]!;const pair=[...puzzle.predicates.halfA,...puzzle.predicates.halfB].map(predicate=>`${predicate.attribute}:${JSON.stringify(predicate.value)}`).sort().join('|');const mirrorKey=`${table}:${answer}:${pair}`;if(names.some(name=>answers.has(name))||seenMirrors.has(mirrorKey))continue;for(const name of names)answers.add(name);seenMirrors.add(mirrorKey);chosen.push(puzzle);}
 for(const [table,items] of pools)if(!Object.hasOwn(quotas,table))for(const puzzle of items){if(chosen.length>=target)break;const names=[puzzle.answer,...puzzle.aliases].map(name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase());if(names.some(name=>answers.has(name)))continue;for(const name of names)answers.add(name);chosen.push(puzzle);}
 return chosen;
}
function score(puzzle:ForgeCandidate):number{return Math.abs(puzzle.predicates.setSizeA-9)+Math.abs(puzzle.predicates.setSizeB-9)+(puzzle.difficulty==='medium'?0:1);}


/**
 * Every valid candidate, ranked within its table, one puzzle per answer and per predicate pair. Unlike
 * chooseCandidates there is no quota cap: the audit works down these lists until enough puzzles pass.
 */
export function rankCandidates(candidates:ForgeCandidate[]):Map<string,ForgeCandidate[]>{
  const ranked=new Map<string,ForgeCandidate[]>();const answers=new Set<string>();
  const sorted=[...candidates].sort((a,b)=>score(a)-score(b)||a.answer.localeCompare(b.answer));
  for(const puzzle of sorted){const names=[puzzle.answer,...puzzle.aliases].map(name=>normaliseGuess(name));if(names.some(name=>answers.has(name)))continue;for(const name of names)answers.add(name);const list=ranked.get(puzzle.sourceTable)??[];list.push(puzzle);ranked.set(puzzle.sourceTable,list);}
  return ranked;
}

/** The next candidates to audit: round robin over the tables furthest below their quota. */
export function nextChunk(ranked:Map<string,ForgeCandidate[]>,quotas:Record<string,number>,passing:(table:string)=>number,eligible:(candidate:ForgeCandidate)=>boolean,size:number):ForgeCandidate[]{
  const queues=[...ranked].map(([table,list])=>({table,deficit:(quotas[table]??0)-passing(table),items:list.filter(eligible)})).filter(queue=>queue.deficit>0&&queue.items.length).sort((a,b)=>b.deficit-a.deficit);
  const chunk:ForgeCandidate[]=[];
  for(let round=0;chunk.length<size&&queues.some(queue=>queue.items.length>round);round++)for(const queue of queues){if(chunk.length>=size)break;const taken=chunk.filter(item=>item.sourceTable===queue.table).length;if(taken>=queue.deficit)continue;const item=queue.items[round];if(item)chunk.push(item);}
  return chunk;
}

interface ForgeCheckpoint {forgeVersion:number;auditVersion:number;solverModels:string[];factModels:string[];results:PuzzleAuditResult[];factRejected:Record<string,string[]>;factFlags:Record<string,string[]>;tokenUsage:Record<string,{promptTokens:number;completionTokens:number;totalTokens:number}>;}
const FORGE_VERSION=6;
const pct=(value:number|null)=>value===null?'not measured':`${(value*100).toFixed(1)}%`;

async function main():Promise<void>{
  const tables=await loadTables();
  if(hintsOnly){const {forgedPack}=await import('./forged-pack.js');const updated=forgedPack.map(puzzle=>withHints(puzzle,tables));await writeFile('src/puzzle/forged-pack.ts',`import type { Puzzle } from './types.js';\nexport const forgedPack: Puzzle[]=${JSON.stringify(updated,null,2)};\n`);console.log(`Hints added: ${updated.filter(p=>p.hintA).length} half A and ${updated.filter(p=>p.hintB).length} half B of ${updated.length} puzzles.`);return;}const found=searchTables(tables,5);const valid=found.filter(candidate=>PuzzleSchema.safeParse(candidate).success&&validatePuzzle(candidate).length===0);const chosen=chooseCandidates(valid,maxPack);
  const selectedCounts=Object.fromEntries(Object.entries(FORGE_QUOTAS).map(([table,quota])=>[table,{target:quota,available:valid.filter(candidate=>candidate.sourceTable===table).length,selected:chosen.filter(candidate=>candidate.sourceTable===table).length}]));
  console.log(`Constraint search produced ${found.length} unique-answer candidates, ${found.length-valid.length} failed validation, ${chosen.length} selected.`);console.log(`Category quota availability: ${JSON.stringify(selectedCounts)}`);
  if(dryRun){for(const [table,counts] of Object.entries(selectedCounts))console.log(`${table}: ${counts.available} available, ${counts.selected} selected of ${counts.target}`);console.log('Dry run: no model calls, audits, fact checks, pack files or checkpoints.');return;}
  const ranked=rankCandidates(valid);const candidates=[...ranked.values()].flat();const byId=new Map(candidates.map(candidate=>[candidate.id,candidate]));

  let saved:ForgeCheckpoint|undefined;try{saved=JSON.parse(await readFile(quotaPath,'utf8')) as ForgeCheckpoint;}catch{}
  const reusable=saved?.forgeVersion===FORGE_VERSION&&saved.auditVersion===AUDIT_VERSION&&JSON.stringify(saved.solverModels)===JSON.stringify(solverModels)&&JSON.stringify(saved.factModels)===JSON.stringify(factModels);
  if(saved&&!reusable)console.log(`Earlier forge results (audit version ${saved.auditVersion}) were made under the old rules and will be audited again.`);
  const factLabel=factModels.join(' + ');
  const knownShortNames=new Set(tables.flatMap(table=>table.entities.flatMap(entity=>[entity.name,...entity.aliases])).map(name=>normaliseGuess(name)).filter(name=>name&&name.length<=2));
  const results=new Map<string,PuzzleAuditResult>();
  // A saved result counts only if it matches the current clue text; pending results are always audited again.
  // A saved answer that the current validity rules reject (a sentence, a label, a copied clue) sends its puzzle back for audit.
  const stillValid=(result:PuzzleAuditResult,candidate:ForgeCandidate)=>(['halfA','halfB','both'] as const).every(kind=>result.solvers[kind].every(row=>!invalidAnswerReason(row,[],knownShortNames,clueText(candidate,kind))));
  if(reusable)for(const result of saved!.results){const candidate=byId.get(result.id);if(candidate&&result.fingerprint===puzzleFingerprint(candidate,solverModels,factLabel)&&stillValid(result,candidate))results.set(result.id,result);}
  const factRejected=new Map(Object.entries(reusable?saved!.factRejected:{}));const factFlags=new Map(Object.entries(reusable?saved!.factFlags:{}));
  const clients=clientsForModels([...solverModels,...factModels]);if(reusable)for(const [model,usage] of Object.entries(saved!.tokenUsage??{}))clients[model]?.restoreTokenUsage(usage);
  const auditor=new BlindPuzzleAuditor(clients,{solverModels,factModel:factLabel,batchSize:Number(process.env.AUDIT_BATCH??8),knownShortNames});
  const tokenUsage=()=>Object.fromEntries([...new Set([...solverModels,...factModels])].map(model=>[model,clients[model]!.tokenUsage]));
  const checkpoint=async()=>{await mkdir('data',{recursive:true});await writeFile(quotaPath,JSON.stringify({forgeVersion:FORGE_VERSION,auditVersion:AUDIT_VERSION,solverModels,factModels,results:[...results.values()],factRejected:Object.fromEntries(factRejected),factFlags:Object.fromEntries(factFlags),tokenUsage:tokenUsage()},null,2)+'\n');};

  const isPassing=(candidate:ForgeCandidate)=>results.has(candidate.id)&&statusOf(results.get(candidate.id)!)==='passed'&&!factRejected.has(candidate.id);
  const passing=(table:string)=>(ranked.get(table)??[]).filter(isPassing).length;
  const keptCount=()=>Object.entries(FORGE_QUOTAS).reduce((sum,[table,quota])=>sum+Math.min(quota,passing(table)),0);
  const attempted=new Set<string>();
  const eligible=(candidate:ForgeCandidate)=>!attempted.has(candidate.id)&&!factRejected.has(candidate.id)&&!(results.has(candidate.id)&&statusOf(results.get(candidate.id)!)!=='pending');
  let stopReason='candidates exhausted';
  for(;;){
    if(keptCount()>=passTarget){stopReason=`target of ${passTarget} passing puzzles reached`;break;}
    if(auditor.availableSolvers.length<MIN_VALID_SOLVERS){stopReason=`fewer than ${MIN_VALID_SOLVERS} solvers still have quota today; pending puzzles resume on the next run`;break;}
    const chunk=nextChunk(ranked,FORGE_QUOTAS,passing,eligible,Number(process.env.AUDIT_BATCH??8));
    if(!chunk.length)break;
    for(const candidate of chunk)attempted.add(candidate.id);
    const facts=await factCheckCandidates(chunk,tables,clients,factModels,verdictsPath);
    for(const removed of facts.removed)factRejected.set(removed.id,removed.reasons);
    for(const flagged of facts.flagged)factFlags.set(flagged.id,flagged.notes);
    if(facts.pending.length)console.log(`${facts.pending.length} candidates wait for a fact model with quota; they resume on the next run.`);
    if(facts.valid.length){const audits=await auditor.auditMany(facts.valid);for(const result of audits)results.set(result.id,result);}
    await checkpoint();
    const settled=[...results.values()].filter(result=>statusOf(result)!=='pending');
    console.log(`Audit v${AUDIT_VERSION}: ${settled.filter(result=>result.passed).length} passed, ${settled.filter(result=>!result.passed).length} failed, ${results.size-settled.length} pending, ${factRejected.size} fact-rejected; ${keptCount()} of ${passTarget} kept so far.`);
  }
  await checkpoint();
  console.log(`Forge stopped: ${stopReason}.`);

  // The final fact status of every passing puzzle comes from the panel cache, so a later rejection removes it.
  const passingCandidates=candidates.filter(isPassing);
  const finalFacts=passingCandidates.length?await factCheckCandidates(passingCandidates,tables,clients,factModels,verdictsPath):{valid:[],removed:[],flagged:[],pending:[],checked:0};
  for(const removed of finalFacts.removed)factRejected.set(removed.id,removed.reasons);
  const factOk=new Set(finalFacts.valid.map(candidate=>candidate.id));
  const kept:ForgeCandidate[]=[];
  for(const [table,quota] of Object.entries(FORGE_QUOTAS))kept.push(...(ranked.get(table)??[]).filter(candidate=>isPassing(candidate)&&factOk.has(candidate.id)).slice(0,quota));
  await checkpoint();

  await mkdir('src/puzzle',{recursive:true});
  // Each kept puzzle carries one !hint line per half, chosen from its own table and leak-checked.
  await writeFile('src/puzzle/forged-pack.ts',`import type { Puzzle } from './types.js';\nexport const forgedPack: Puzzle[]=${JSON.stringify(kept.map(puzzle=>withHints(puzzle as Puzzle,tables)),null,2)};\n`);
  await writeFile('src/puzzle/pack.ts',"import { forgedPack } from './forged-pack.js';\nexport const puzzlePack=forgedPack;\n");
  const audited=candidates.filter(candidate=>results.has(candidate.id)).map(candidate=>results.get(candidate.id)!);
  const categories=Object.fromEntries([...ranked].map(([table,list])=>{const rows=list.map(candidate=>results.get(candidate.id)).filter((row):row is PuzzleAuditResult=>Boolean(row));const passed=rows.filter(row=>statusOf(row)==='passed').length;const failed=rows.filter(row=>statusOf(row)==='failed').length;const pending=rows.filter(row=>statusOf(row)==='pending').length;return [table,{quota:FORGE_QUOTAS[table]??0,candidates:list.length,audited:passed+failed,passed,failed,pending,factRejected:list.filter(candidate=>factRejected.has(candidate.id)).length,passRate:passed+failed?passed/(passed+failed):null,kept:kept.filter(candidate=>candidate.sourceTable===table).length}];}));
  const report={...buildReport(audited,solverModels,factLabel,tokenUsage(),[{round:1,puzzlesAudited:audited.length,passed:audited.filter(row=>row.passed).length}]),categories,factFlags:Object.fromEntries(factFlags),factRejected:Object.fromEntries(factRejected)};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  await writeFile('docs/PUZZLE_AUDIT.md',renderAuditDoc(report,categories,kept,stopReason));
  const summary={generated:found.length,validationFailed:found.length-valid.length,ranked:candidates.length,audited:report.total,passed:report.passed,failed:report.failed,pending:report.pending,factRejected:factRejected.size,factFlagged:factFlags.size,kept:kept.length,passTarget,stopReason,categories,solverModels,factModels,tokenUsage:report.tokenUsage};
  await writeFile('data/forge-stats.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({kept:kept.length,passed:report.passed,failed:report.failed,pending:report.pending,factRejected:factRejected.size,stopReason},null,2));
}

function renderAuditDoc(report:ReturnType<typeof buildReport>,categories:Record<string,{quota:number;candidates:number;audited:number;passed:number;failed:number;pending:number;factRejected:number;passRate:number|null;kept:number}>,kept:ForgeCandidate[],stopReason:string):string{
  const solverLine=(rows:PuzzleAuditResult['solvers']['halfA'])=>rows.map(row=>`${row.model}: ${row.best_answer} (${row.referee})`).join('; ')||'none';
  return `# Puzzle audit

## History

- **Version 1** used shallow free-text prompts and let through single-half giveaways and false clues.
- **Version 2** added a stricter blind audit and a fact verifier, but tested free-text model-written clues. All 8 audited v2 puzzles failed; the report is archived in docs/archive/slice-5.
- **Version 2.1** moved to the Puzzle Forge: clues from curated attribute tables and deterministic set intersections.
- **Version 3** (this report) fixes four faults found in the 2.1 run. Clue prompts carried the labels "Half A alone" and "Half B alone", and one solver answered the label "B" for every half B. A puzzle failed when only one of three solvers answered, because the Gemini models were dropped on a per-minute quota. A single fact model rejected true facts ("2011 is not in the 2010s", "Bolivia is not landlocked"). And only the first 80 candidates were ever audited. Every 2.1 result is audited again under the new rules.

## Rules

${report.passRule}

- Solver prompts carry no labels. Clue ids are random 4 to 6 character strings, and the solver is told an id is only a label. An answer that repeats an id, has one or two characters (unless a fact table lists such a name, like Io), or puts the same value in all three fields is retried one clue at a time and otherwise ignored.
- A per-minute quota error waits and continues with the same model. Only a daily quota drops a model, and only for the rest of the run.
- Derived values (a debut decade, a discovery century) are computed in code from the table's raw year; the fact models are asked about the year itself.
- Auditing works through every ranked candidate across runs until enough puzzles pass within the category quotas, or the candidates run out.

## This run

- Solvers: ${report.solverModels.join(', ')}
- Fact panel: ${report.factModel}
- Audited: ${report.total} (passed ${report.passed}, failed ${report.failed}, pending ${report.pending})
- Pass rate of settled audits: ${pct(report.passRate)}
- Single-half hit rate: ${pct(report.singleHalfHitRate)}; both-halves hit rate: ${pct(report.bothHalvesHitRate)}
- Kept in the pack: ${kept.length}
- Stopped because: ${stopReason}
- Token usage: ${JSON.stringify(report.tokenUsage)}

| Category | Quota | Candidates | Audited | Passed | Failed | Pending | Fact rejected | Pass rate | Kept |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${Object.entries(categories).map(([table,row])=>`| ${table} | ${row.quota} | ${row.candidates} | ${row.audited} | ${row.passed} | ${row.failed} | ${row.pending} | ${row.factRejected} | ${pct(row.passRate)} | ${row.kept} |`).join('\n')}

## Kept puzzles

| Puzzle | Category | Set A | Set B | Answer |
| --- | --- | ---: | ---: | --- |
${kept.map(p=>`| ${p.id} | ${p.sourceTable} | ${p.predicates.setSizeA} | ${p.predicates.setSizeB} | ${p.answer} |`).join('\n')||'| none yet | | | | |'}

## Every audited puzzle

${report.results.map(result=>`### ${result.id}: ${result.answer} (${statusOf(result).toUpperCase()})\n- Half A alone: ${solverLine(result.solvers.halfA)}\n- Half B alone: ${solverLine(result.solvers.halfB)}\n- Both halves: ${solverLine(result.solvers.both)}${result.failures.length?`\n- Notes: ${result.failures.join(' ')}`:''}`).join('\n\n')||'No audits completed yet.'}
`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
