import fs from 'node:fs';
import YAML from 'yaml';
import {householdModel} from '../src/dossiers/households.model.js';
const m=householdModel(),rules=[];
// Every bundle on disk gets a decision: the cells a plate or fact uses are shown, the rest are baked
// (in Every Cut and the downloads). Unplotted bundles are baked whole.
const slugs=fs.readdirSync('data/series').filter(f=>/^households-aidis-.*\.json$/.test(f)).map(f=>f.slice(0,-5)).sort();
for(const slug of slugs){
 const shown=m.used.get(slug)??new Set();
 if(shown.size)rules.push({match:[...shown].map(k=>slug+':'+k),status:'shown',bundle:slug,plate:'Household analytical plates, direct published observations'});
 const count=Object.keys(JSON.parse(fs.readFileSync('data/series/'+slug+'.json','utf8')).series).length;
 if(shown.size<count)rules.push({match:slug+':*',status:'baked',bundle:slug});
}
fs.writeFileSync('data/coverage/households.yml',YAML.stringify({family:'households',guides:['households'],catalogue:'data/coverage/households.catalogue.json',rules}));
fs.writeFileSync('pipeline/out/facts-households.json',JSON.stringify({slug:'households',facts:m.facts,sources:m.factSources,plates:m.plates,coverage:m.summary},null,1)+'\n');
console.log(`${m.plates.length} household plates; ${m.summary.series} source cells; facts and ledger written`);
