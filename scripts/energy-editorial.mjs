import fs from 'node:fs';import {energyModel,energyBundle} from '../src/dossiers/energy.model.js';import {energyFactsSheet} from '../src/dossiers/energy.facts.js';
const m=energyModel(),fail=[];const facts=energyFactsSheet(m);
for(const [id,f] of Object.entries(m.facts)){const q=m.factSources[id],b=energyBundle(q.bundle);if(f.value!==b.series[q.series].data[b.dates.indexOf(q.date)]||facts.facts[id].value!==f.value)fail.push(id+' untraced headline');}
for(const p of m.plates){if(p.unit==='source_scaled_gwh')fail.push('Audit-only branch plotted '+p.id);for(const r of p.rows)if(energyBundle(r.bundle??p.bundle).series[r.series]?.data[energyBundle(r.bundle??p.bundle).dates.indexOf(r.date)]!==r.value)fail.push('Untraced chart cell '+p.id);if(!p.explain||!p.sub||!p.sourceUrl)fail.push('Missing explanation/provenance '+p.id);}
const page=fs.readFileSync('src/pages/guides/energy.astro','utf8');if(/\b\d+(?:\.\d+)?(?:%|\s*(?:KToE|PJ|GWh|TWh|MW))\b/.test(page))fail.push('Literal physical figure in page prose');
if(fail.length){console.error(fail);process.exit(1)}
fs.mkdirSync('pipeline/out',{recursive:true});const text=JSON.stringify(facts,null,1)+'\n';for(const file of ['pipeline/out/facts-energy.json']){fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}
console.log('energy editorial: '+Object.keys(m.facts).length+' headlines and '+m.plates.length+' explained plates trace to source-backed facts; audit-only values absent');
