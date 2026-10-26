import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {LlmClient} from '../llm/client.js';
import {factCheckCandidates} from './fact-check.js';
import type {FactTable,ForgeCandidate} from './forge.js';

describe('table fact verification',()=>{
 it('checks each unique answer and attribute pair once and caches true verdicts',async()=>{const table:FactTable={category:'countries',sources:['fixture'],license:'CC0',entities:[{name:'Paris',aliases:[],fame:2,attributes:{region:'Europe',river:'Seine'}}]};const puzzle:ForgeCandidate={id:'fixture',sourceTable:'countries',category:'geography',difficulty:'medium',answer:'Paris',aliases:[],halfA:'A city in Europe.',halfB:'A city on the Seine.',halfAAlsoFits:['Rome','Berlin'],halfBAlsoFits:['Rouen','Melun'],alsoFitsA:['Rome','Berlin'],alsoFitsB:['Rouen','Melun'],predicates:{halfA:[{attribute:'region',operator:'eq',value:'Europe'}],halfB:[{attribute:'river',operator:'eq',value:'Seine'}],setSizeA:5,setSizeB:5}};let calls=0;const client={tokenUsage:{promptTokens:2,completionTokens:2,totalTokens:4},chatJsonWithUsage:async(messages:Array<{content:string}>)=>{calls++;const rows=JSON.parse(messages[1]!.content) as Array<{key:string}>;return {value:{checks:rows.map(row=>({key:row.key,verdict:'true',reason:'Matches the curated table.'}))}};}} as unknown as LlmClient;const dir=await mkdtemp(join(tmpdir(),'twinclue-facts-'));const path=join(dir,'verdicts.json');try{const first=await factCheckCandidates([puzzle,puzzle],[table],client,path,10);expect(first.valid).toHaveLength(2);expect(first.checked).toBe(2);expect(calls).toBe(1);const second=await factCheckCandidates([puzzle],[table],client,path,10);expect(second.checked).toBe(0);expect(calls).toBe(1);expect(JSON.parse(await readFile(path,'utf8'))).toHaveLength(2);}finally{await rm(dir,{recursive:true,force:true});}});
});
