import fs from 'node:fs';import YAML from 'yaml';import {readCatalogue} from './lib/catalogue.mjs';import {energyModel,energyBundles} from '../src/dossiers/energy.model.js';import {energyFactsSheet} from '../src/dossiers/energy.facts.js';const m=energyModel();
const items=readCatalogue('data/coverage/energy.catalogue.json',process.cwd()).items,rules=[];
for(const sl of energyBundles){if(items.some(i=>i.empty&&i.id.startsWith(sl+':')))rules.push({match:sl+':empty:*',status:'excluded',reason:'All published Value cells are blank; original rows remain archived, without inventing observations.'});
 const shown=new Set();for(const key of m.used.get(sl)??[]){const p=m.plates.find(p=>p.sourceBundles.includes(sl)&&p.rows.some(r=>r.bundle===sl&&r.series===key));if(p){shown.add(key);rules.push({match:sl+':'+key,status:'shown',bundle:sl,plate:'cb-'+p.id});}}
 // everything not drawn on a plate (fact-only cells included) is baked and in Every Cut
 if(items.some(i=>i.id.startsWith(sl+':')&&!i.empty&&!i.duplicate&&!shown.has(i.series)))rules.push({match:sl+':*',status:'baked',bundle:sl});}
for(const sl of new Set(items.filter(i=>i.duplicate).map(i=>i.id.split(':')[0])))rules.push({match:sl+':duplicate:*',status:'excluded',reason:'Ember prints these power-sector emissions a second time under the unit %; every row repeats the ktCO2 figure for the same state, period and fuel, so the copy is not baked.'});
fs.writeFileSync('data/coverage/energy.yml',YAML.stringify({family:'energy',guides:['energy'],catalogue:'data/coverage/energy.catalogue.json',rules}));
const text=JSON.stringify(energyFactsSheet(m),null,1)+'\n';for(const file of ['pipeline/out/facts-energy.json']){fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}console.log(m.summary);
