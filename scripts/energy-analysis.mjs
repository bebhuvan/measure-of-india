import fs from 'node:fs';import YAML from 'yaml';import {energyModel,energyBundles} from '../src/dossiers/energy.model.js';import {energyFactsSheet} from '../src/dossiers/energy.facts.js';const m=energyModel();
const items=JSON.parse(fs.readFileSync('data/coverage/energy.catalogue.json')).items,rules=[];
for(const sl of energyBundles){if(items.some(i=>i.empty&&i.id.startsWith(sl+':')))rules.push({match:sl+':empty:*',status:'excluded',reason:'All published Value cells are blank; original rows remain archived, without inventing observations.'});
 for(const key of m.used.get(sl)??[]){const p=m.plates.find(p=>p.bundle===sl&&p.rows.some(r=>r.series===key));if(p)rules.push({match:sl+':'+key,status:'shown',bundle:sl,plate:'cb-'+p.id});}
 if(items.some(i=>i.id.startsWith(sl+':')&&!i.empty&&!m.used.get(sl)?.has(i.series)))rules.push({match:sl+':*',status:'baked',bundle:sl});}
fs.writeFileSync('data/coverage/energy.yml',YAML.stringify({family:'energy',guides:['energy'],catalogue:'data/coverage/energy.catalogue.json',rules}));
const text=JSON.stringify(energyFactsSheet(m),null,1)+'\n';for(const file of ['pipeline/out/facts-energy.json']){fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}console.log(m.summary);
