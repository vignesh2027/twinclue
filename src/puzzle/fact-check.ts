import { readFile, writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { LlmClient, TokenUsage } from '../llm/client.js';
import type { ForgeCandidate, FactTable } from './forge.js';

const VerdictSchema=z.object({checks:z.array(z.object({key:z.string(),verdict:z.enum(['true','false','unsure']),reason:z.string()}))});
export interface FactVerdict {key:string;entity:string;attribute:string;value:unknown;verdict:'true'|'false'|'unsure';reason:string;}
export interface FactCheckSummary {valid:ForgeCandidate[];removed:Array<{id:string;reasons:string[]}>;checked:number;tokenUsage:TokenUsage;}
export function factKey(entity:string,attribute:string,value:unknown):string{return JSON.stringify([entity,attribute,value]);}

export async function factCheckCandidates(candidates:ForgeCandidate[],tables:FactTable[],client:LlmClient,path='facts/verdicts.json',batchSize=24):Promise<FactCheckSummary>{
 const tableByName=new Map(tables.map(table=>[table.category,table]));
 let cache:FactVerdict[]=[];try{cache=JSON.parse(await readFile(path,'utf8')) as FactVerdict[];}catch{}
 const byKey=new Map(cache.map(item=>[item.key,item]));
 const needed=new Map<string,Omit<FactVerdict,'verdict'|'reason'>>();
 for(const puzzle of candidates){const table=tableByName.get(puzzle.sourceTable);const answer=table?.entities.find(entity=>entity.name===puzzle.answer);if(!answer)continue;for(const predicate of [...puzzle.predicates.halfA,...puzzle.predicates.halfB]){const key=factKey(answer.name,predicate.attribute,predicate.value);if(!byKey.has(key))needed.set(key,{key,entity:answer.name,attribute:predicate.attribute,value:predicate.value});}}
 const pending=[...needed.values()];
 for(let offset=0;offset<pending.length;offset+=batchSize){const batch=pending.slice(offset,offset+batchSize);const prompt=batch.map(item=>({key:item.key,entity:item.entity,attribute:item.attribute,expected_value:item.value}));const response=await client.chatJsonWithUsage([{role:'system',content:'Check whether each expected attribute value is factually correct for the named entity. Use established, checkable facts only. Return true, false, or unsure with a short reason. Return JSON {"checks":[{"key":"exact key","verdict":"true|false|unsure","reason":"short reason"}]}. Do not omit keys.'},{role:'user',content:JSON.stringify(prompt)}],VerdictSchema);
  const rows=new Map(response.value.checks.map(row=>[row.key,row]));for(const item of batch){const row=rows.get(item.key);if(!row)throw new Error(`Fact checker omitted ${item.entity} ${item.attribute}.`);byKey.set(item.key,{...item,verdict:row.verdict,reason:row.reason});}
  await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify([...byKey.values()],null,2)+'\n');
 }
 const valid:ForgeCandidate[]=[];const removed:Array<{id:string;reasons:string[]}>=[];
 for(const puzzle of candidates){const table=tableByName.get(puzzle.sourceTable);const answer=table?.entities.find(entity=>entity.name===puzzle.answer);const reasons:string[]=[];if(!answer)reasons.push('Answer is missing from its fact table.');for(const predicate of [...puzzle.predicates.halfA,...puzzle.predicates.halfB]){const key=factKey(puzzle.answer,predicate.attribute,predicate.value);const verdict=byKey.get(key);if(!verdict||verdict.verdict!=='true')reasons.push(`${predicate.attribute} ${JSON.stringify(predicate.value)}: ${verdict?.verdict??'missing'}${verdict?.reason?` (${verdict.reason})`:''}`);}if(reasons.length)removed.push({id:puzzle.id,reasons});else valid.push(puzzle);}
 return {valid,removed,checked:needed.size,tokenUsage:client.tokenUsage};
}
