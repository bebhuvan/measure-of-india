#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {timeUseModel} from '../src/dossiers/time-use.model.js';
import {readCatalogue} from './lib/catalogue.mjs';
const root=process.cwd(),model=timeUseModel(root),catalogue=readCatalogue('data/coverage/time-use.catalogue.json',root),rules=[],review=[];
for(const b of model.manifest.bundles){
 const items=catalogue.items.filter(i=>i.bundle===b.slug),shown=model.used.get(b.slug)??new Set();
 const withheld=items.filter(i=>i.withheld).map(i=>i.id);
 if(withheld.length)rules.push({match:withheld,status:'excluded',reason:'The original report prints a dash for the exact cut because there is no sample observation. The source cell and its marker remain archived; no value is invented.'});
 if(shown.size)rules.push({match:[...shown].map(k=>b.slug+':'+k),status:'shown',bundle:b.slug,plate:'Time-use analytical plates and source-traced headline figures'});
 if(items.some(i=>!i.withheld&&!shown.has(i.series)))rules.push({match:b.slug+':*',status:'baked',bundle:b.slug});
 review.push({bundle:b.slug,sourceItems:items.length,lead:0,show:shown.size,summarize:items.filter(i=>!i.withheld&&!shown.has(i.series)).length,skip:withheld.length,skipReason:withheld.length?'Exact source dash: no sample observation; not a zero.':null,access:'Every finite observation is accessible through EveryCut and downloads; analytical selection is separate.'});
}
// Every number in guide prose/charts is in this deterministic sheet, with its
// complete source identity. No LLM arithmetic or freely typed current values.
const sourceBundles=new Map();
for(const p of model.plates)for(const r of p.rows){
 if(!sourceBundles.has(r.bundle))sourceBundles.set(r.bundle,JSON.parse(fs.readFileSync(path.join(root,'data/series/'+r.bundle+'.json'))));
 const b=sourceBundles.get(r.bundle);
 if(b.series[r.series]?.data[0]!==r.value||b.series[r.series]?.sourceCell.cell!==r.cell)throw Error('Untraced chart cell '+p.id);
}
const facts={slug:'time-use',period:model.plates[0].period,facts:model.facts,plateFacts:model.plateFacts,plateSources:model.plates.map(p=>({id:p.id,sourceBundles:p.sourceBundles,sourceUrl:p.sourceUrl,rows:p.rows.map(r=>({bundle:r.bundle,series:r.series,cell:r.cell}))})),coverage:model.summary,remaining:['Full preceding-survey history, with its own instrument and methodological review.','Additional chapter state statements, beyond the appendix measures and RSE tables.'],methodology:'Original report workbook cells; observed cuts only, no fabricated cross-tabs. Separate participation, per-participant time and per-person time. All-activities time equally allocates each recorded slot. No causal effects or unmatched-household sharing claims.'};
fs.writeFileSync(path.join(root,'data/coverage/time-use.yml'),JSON.stringify({family:'time-use',guides:['time-use'],catalogue:'data/coverage/time-use.catalogue.json',rules},null,1)+'\n');
fs.writeFileSync(path.join(root,'pipeline/out/facts-time-use.json'),JSON.stringify(facts,null,1)+'\n');
fs.writeFileSync(path.join(root,'docs/reference/time-use-census-review.json'),JSON.stringify({methodology:'Every canonical series is assigned from the source census; shown includes facts and analytical plates, summarize is accessible through EveryCut, skip is only an exact unpublished source marker. This is the appendix-edition scope, not completion of all TUS history or report chapter statements.',bundles:review},null,1)+'\n');
console.log(model.summary);
