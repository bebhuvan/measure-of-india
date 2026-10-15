import fs from 'node:fs';
import YAML from 'yaml';
import {farmModel} from '../src/dossiers/farm-households.model.js';
const m=farmModel(),manifest=JSON.parse(fs.readFileSync('data/coverage/farm-households.manifest.json')),rules=[];
for(const it of manifest.bundles){const shown=m.used.get(it.slug);if(shown?.size)rules.push({match:[...shown].map(k=>it.slug+':'+k),status:'shown',bundle:it.slug,plate:'Farm household analytical plates: direct published observations'});rules.push({match:it.slug+':*',status:'baked',bundle:it.slug});}
fs.writeFileSync('data/coverage/farm-households.yml',YAML.stringify({family:'farm-households',guides:['farm-households'],catalogue:'data/coverage/farm-households.catalogue.json',rules}));
const plates=m.plates.map(({signature,...p})=>p);
fs.writeFileSync('pipeline/out/facts-farm-households.json',JSON.stringify({slug:'farm-households',facts:m.facts,sources:m.factSources,plates,provenance:m.provenance,coverage:m.summary},null,1)+'\n');
console.log(m.summary,m.facts);
