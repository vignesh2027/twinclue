import {describe,it,expect} from 'vitest';
import {readdir,readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {searchTables} from './forge.js';
import {chooseCandidates,FORGE_QUOTAS} from './forge-pack.js';
import type {FactTable} from './forge.js';

describe('quota-aware forge selection',()=>{
 it('keeps one answer and one predicate mirror per answer, within category quotas',async()=>{const tables:FactTable[]=[];for(const file of (await readdir('facts')).filter(name=>name.endsWith('.json'))){const raw=JSON.parse(await readFile(`facts/${file}`,'utf8'));tables.push({category:raw._meta.category,entities:raw.entities,sources:raw._meta.sources,license:raw._meta.license});}const selected=chooseCandidates(searchTables(tables),80);expect(new Set(selected.map(item=>item.answer.toLocaleLowerCase())).size).toBe(selected.length);for(const [table,quota] of Object.entries(FORGE_QUOTAS))expect(selected.filter(item=>item.sourceTable===table).length).toBeLessThanOrEqual(quota);for(const puzzle of selected){const pair=[...puzzle.predicates.halfA,...puzzle.predicates.halfB].map(row=>`${row.attribute}:${JSON.stringify(row.value)}`).sort().join('|');expect(selected.filter(other=>other.answer===puzzle.answer&&[...other.predicates.halfA,...other.predicates.halfB].map(row=>`${row.attribute}:${JSON.stringify(row.value)}`).sort().join('|')===pair)).toHaveLength(1);}});
 it('dry run reports availability and exits before any model call or file write',async()=>{const watched=['data/forge-progress.json','data/forge-stats.json','src/puzzle/forged-pack.ts','src/puzzle/audit-report.json','facts/verdicts.json'];const before=await Promise.all(watched.map(file=>stat(file).then(info=>info.mtimeMs,()=>null)));const output=execFileSync(process.execPath,['--import','tsx','src/puzzle/forge-pack.ts','--dry-run'],{encoding:'utf8'});expect(output).toMatch(/Dry run: no model calls/);for(const table of Object.keys(FORGE_QUOTAS))expect(output).toContain(`${table}: `);const after=await Promise.all(watched.map(file=>stat(file).then(info=>info.mtimeMs,()=>null)));expect(after).toEqual(before);},30000);
});
