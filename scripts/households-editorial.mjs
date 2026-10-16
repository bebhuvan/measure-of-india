import fs from 'node:fs';
import YAML from 'yaml';
import {householdModel} from '../src/dossiers/households.model.js';
import {readCatalogue} from './lib/catalogue.mjs';
const m=householdModel(),rules=[];
// Every bundle on disk gets a decision: the cells a plate or fact uses are shown, the rest are baked
// (in Every Cut and the downloads). Unplotted bundles are baked whole.
// Cells the adapter withheld (shares of a nil amount) are excluded with the reason a reader sees.
const withheld=readCatalogue('data/coverage/households.catalogue.json',process.cwd()).items.filter(x=>x.withheld);
const slugs=fs.readdirSync('data/series').filter(f=>/^households-aidis-.*\.json$/.test(f)).map(f=>f.slice(0,-5)).sort();
for(const slug of slugs){
 const shown=m.used.get(slug)??new Set();
 if(shown.size)rules.push({match:[...shown].map(k=>slug+':'+k),status:'shown',bundle:slug,plate:'Household analytical plates, direct published observations'});
 const out=withheld.filter(x=>x.bundle===slug).map(x=>x.id);
 if(out.length)rules.push({match:out,status:'excluded',reason:'MoSPI prints every share of this amount as 0 for this state, sector and group: the amount was nil or not sampled, so the shares do not exist and are left blank.'});
 const count=Object.keys(JSON.parse(fs.readFileSync('data/series/'+slug+'.json','utf8')).series).length;
 if(shown.size<count)rules.push({match:slug+':*',status:'baked',bundle:slug});
}
fs.writeFileSync('data/coverage/households.yml',YAML.stringify({family:'households',guides:['households'],catalogue:'data/coverage/households.catalogue.json',rules}));
fs.writeFileSync('pipeline/out/facts-households.json',JSON.stringify({slug:'households',facts:m.facts,sources:m.factSources,plates:m.plates,coverage:m.summary},null,1)+'\n');
console.log(`${m.plates.length} household plates; ${m.summary.series} source cells; facts and ledger written`);
