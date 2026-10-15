import fs from 'node:fs';import {energyModel,energyBundle} from '../src/dossiers/energy.model.js';import {energyFactsSheet} from '../src/dossiers/energy.facts.js';
const m=energyModel(),fail=[];const facts=energyFactsSheet(m);
const cellOf=q=>{const b=energyBundle(q.bundle);return b.series[q.series].data[b.dates.indexOf(q.date)];};
for(const [id,f] of Object.entries(m.facts)){const q=m.factSources[id];if(facts.facts[id].value!==f.value){fail.push(id+' facts sheet differs');continue;}
 // a derived fact is the recorded formula on the recorded cells; a scaled fact is its cell over the scale
 if(q.derived){if(Math.round((0,eval)(q.formula)(...q.parts.map(cellOf)))!==f.value)fail.push(id+' untraced derived fact');}
 else if(f.value!==cellOf(q)/(q.scale??1))fail.push(id+' untraced headline');}
for(const p of m.plates){if(p.unit==='source_scaled_gwh')fail.push('Audit-only branch plotted '+p.id);for(const r of p.rows){const c=energyBundle(r.bundle??p.bundle).series[r.series]?.data[energyBundle(r.bundle??p.bundle).dates.indexOf(r.date)];if(c!==(r.sourceValue??r.value)||(r.scale&&c/r.scale!==r.value))fail.push('Untraced chart cell '+p.id);}if(!p.explain||!p.sub||!p.sourceUrl)fail.push('Missing explanation/provenance '+p.id);}
const page=fs.readFileSync('src/pages/guides/energy.astro','utf8');if(/\b\d+(?:\.\d+)?(?:%|\s*(?:KToE|Mtoe|PJ|GWh|TWh|MW))\b/.test(page.replace(/<style[\s\S]*?<\/style>/g,'')))fail.push('Literal physical figure in page prose');
if(fail.length){console.error(fail);process.exit(1)}
fs.mkdirSync('pipeline/out',{recursive:true});const text=JSON.stringify(facts,null,1)+'\n';for(const file of ['pipeline/out/facts-energy.json']){fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);}
console.log('energy editorial: '+Object.keys(m.facts).length+' headlines and '+m.plates.length+' explained plates trace to source-backed facts; audit-only values absent');
