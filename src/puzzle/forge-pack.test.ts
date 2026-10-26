import {describe,it,expect} from 'vitest';
import {readdir,readFile} from 'node:fs/promises';
import {searchTables} from './forge.js';
import {chooseCandidates,FORGE_QUOTAS} from './forge-pack.js';
import type {FactTable} from './forge.js';

describe('quota-aware forge selection',()=>{
 it('keeps one answer and one predicate mirror per answer, within category quotas',async()=>{const tables:FactTable[]=[];for(const file of (await readdir('facts')).filter(name=>name.endsWith('.json'))){const raw=JSON.parse(await readFile(`facts/${file}`,'utf8'));tables.push({category:raw._meta.category,entities:raw.entities,sources:raw._meta.sources,license:raw._meta.license});}const selected=chooseCandidates(searchTables(tables),80);expect(new Set(selected.map(item=>item.answer.toLocaleLowerCase())).size).toBe(selected.length);for(const [table,quota] of Object.entries(FORGE_QUOTAS))expect(selected.filter(item=>item.sourceTable===table).length).toBeLessThanOrEqual(quota);for(const puzzle of selected){const pair=[...puzzle.predicates.halfA,...puzzle.predicates.halfB].map(row=>`${row.attribute}:${JSON.stringify(row.value)}`).sort().join('|');expect(selected.filter(other=>other.answer===puzzle.answer&&[...other.predicates.halfA,...other.predicates.halfB].map(row=>`${row.attribute}:${JSON.stringify(row.value)}`).sort().join('|')===pair)).toHaveLength(1);}});
});
