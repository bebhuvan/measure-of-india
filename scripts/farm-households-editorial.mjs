import fs from 'node:fs';
import YAML from 'yaml';
import {readCatalogue} from './lib/catalogue.mjs';
import {farmModel} from '../src/dossiers/farm-households.model.js';
import {WITHHELD} from './lib/products/farm-households.mjs';
const m=farmModel(),manifest=JSON.parse(fs.readFileSync('data/coverage/farm-households.manifest.json')),rules=[];
for(const it of manifest.bundles){const shown=m.used.get(it.slug);if(shown?.size)rules.push({match:[...shown].map(k=>it.slug+':'+k),status:'shown',bundle:it.slug,plate:'Farm household analytical plates: direct published observations'});rules.push({match:it.slug+':*',status:'baked',bundle:it.slug});}
// Source cells with no usable figure are catalogued as withheld (scripts/lib/products/farm-households.mjs).
const REASONS={'API repeats Andhra Pradesh cells under every state':'The API repeats Andhra Pradesh debt cells under every state, so none can be read as that state; the guide uses the official report tables instead.','API category labels conflict with the report':'The API labels these MSP awareness categories differently from the official report, so the cells cannot be read reliably.','rate exceeds its per-thousand base':'The published rate exceeds its own per-thousand base, a source inconsistency confirmed in the report.','parenthesised source cell':'The source prints this cell in parentheses, which the report does not explain, so it is not read as a figure.','no figure published':'The source lists this cut but publishes no figure for it.'};
const held=new Set(readCatalogue('data/coverage/farm-households.catalogue.json',process.cwd()).items.filter(x=>x.withheld).map(x=>x.withheld));
for(const [why,reason] of Object.entries(REASONS))if(held.has(why))rules.push({match:`farm-households-nss77-*:withheld:${WITHHELD[why]}:*`,status:'excluded',reason});
fs.writeFileSync('data/coverage/farm-households.yml',YAML.stringify({family:'farm-households',guides:['farm-households'],catalogue:'data/coverage/farm-households.catalogue.json',rules}));
const plates=m.plates.map(({signature,...p})=>p);
fs.writeFileSync('pipeline/out/facts-farm-households.json',JSON.stringify({slug:'farm-households',facts:m.facts,sources:m.factSources,plates,provenance:m.provenance,coverage:m.summary},null,1)+'\n');
console.log(m.summary,m.facts);
