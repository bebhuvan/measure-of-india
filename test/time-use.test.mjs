import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {timeUseBundles,timeUseKey} from '../scripts/lib/products/time-use.mjs';
import {validateTimeUse} from '../scripts/lib/time-use-validation.mjs';
import {timeUseModel} from '../src/dossiers/time-use.model.js';
import {bySlug} from '../src/dossiers/registry.js';
const fixture=(records)=>({activityLabels:{'311':'Preparing meals'},tables:[{id:'t8',records,title:'Minutes per person',rawFile:'fixture.json',sourceUrl:'https://example.test/t8.xlsx',sourceSha256:'fixture',documentSha256:'report'}]});
const cell=(value,extra={})=>({sheet:'Table',cell:'B6',raw:value,value,unit:'minutes',dims:{state:'All India',sector:'Rural',gender:'Female',source_row:'311',source_column:'6-14 years',measure:'Minutes per person'},...extra});
test('time-use retains true zero and accounts for source dashes without baking a zero',()=>{
 const result=timeUseBundles(fixture([cell(0),cell(null,{cell:'C6',dims:{...cell(0).dims,gender:'Male'}})]));
 assert.equal(result.items.length,2);assert.equal(result.items.filter(i=>i.withheld).length,1);
 const s=Object.values(result.bundles[0].bundle.series);assert.equal(s.length,1);assert.deepEqual(s[0].data,[0]);assert.match(s[0].label,/Preparing meals/);
});
test('time-use rejects duplicate cuts, including repeated unavailable source cells',()=>{
 assert.throws(()=>timeUseBundles(fixture([cell(2),cell(3,{cell:'C6'})])),/Duplicate source dimensions/);
 assert.throws(()=>timeUseBundles(fixture([cell(null),cell(null,{cell:'C6'})])),/Duplicate source dimensions/);
});
test('time-use percentages and RSEs have distinct statistical envelopes',()=>{
 assert.throws(()=>timeUseBundles(fixture([cell(101,{unit:'pct'})])),/range\/unit conflict/);
 const x=timeUseBundles(fixture([cell(108.38,{unit:'pct_rse'})]));assert.equal(Object.values(x.bundles[0].bundle.series)[0].data[0],108.38);
});
test('time-use identities do not depend on the order of source dimension fields',()=>{
 assert.equal(timeUseKey({a:1,b:2}),timeUseKey({b:2,a:1}));
});
test('time-use source replay covers the complete appendix edition and its day-budget identities',()=>{
 const r=validateTimeUse(process.cwd());assert.equal(r.workbooks,62);assert.equal(r.canonicalCells+r.withheld,r.sourceCells);assert.ok(r.identities>9000);
});
test('time-use registry conserves the whole canonical family and no duplicate partitions',()=>{
 const m=JSON.parse(fs.readFileSync('data/coverage/time-use.manifest.json'));
 assert.deepEqual(new Set(bySlug['time-use'].bundles),new Set(m.bundles.map(b=>b.slug)));
 assert.ok(!fs.existsSync('data/series/time-use-2024-t4-pct.json'));
 assert.ok(!fs.existsSync('data/series/time-use-2024-t5-minutes.json'));
 for(const entry of m.bundles){const b=JSON.parse(fs.readFileSync('data/series/'+entry.slug+'.json'));const names=Object.values(b.series).map(s=>s.name);assert.equal(new Set(names).size,names.length,'CSV column identity '+entry.slug);assert.ok(names.every(Boolean));}
});
test('time-use activity names use the complete original report classification',()=>{
 const labels=JSON.parse(fs.readFileSync('data/coverage/time-use.labels.json'));
 assert.equal(Object.keys(labels).length,230);
 assert.equal(labels['490'],'Other activities related to unpaid caregiving services for household members');
});

// The guide's charts: every drawn number is a traced row, every row is drawn, and the page
// carries every headline fact.
const indices=(x,out=[])=>{if(typeof x==='number')out.push(x);else if(Array.isArray(x))x.forEach(y=>indices(y,out));else if(x&&typeof x==='object')for(const [k,v]of Object.entries(x))if(!['name','title','unit','sortBy','kind','iso','keys','parts'].includes(k)||k==='parts'&&Array.isArray(v)&&typeof v[0]==='number')indices(v,out);return out;};
test('time-use plates trace every row to its source cell and draw every row',()=>{
 const m=timeUseModel(),bundles=new Map();
 assert.ok(m.plates.length>=15&&m.plates.length<=30,'a curated guide, not one plate per cell');
 for(const p of m.plates){
  assert.ok(p.title&&p.sub&&p.explain&&p.sourceUrl&&p.lead,p.id);
  for(const r of p.rows){
   if(!bundles.has(r.bundle))bundles.set(r.bundle,JSON.parse(fs.readFileSync('data/series/'+r.bundle+'.json')));
   const s=bundles.get(r.bundle).series[r.series];
   assert.equal(s.data[0],r.value,p.id+' '+r.name);assert.equal(s.sourceCell.cell,r.cell,p.id+' '+r.name);
  }
  const used=new Set(indices(p.shape));
  for(const i of used)assert.ok(i>=0&&i<p.rows.length,p.id+' index '+i);
  assert.equal(used.size,p.rows.length,p.id+': every row is drawn');
 }
});
test('time-use headline facts and day budgets hold',()=>{
 const m=timeUseModel();
 assert.equal(m.facts.domestic_female.value,236);assert.equal(m.facts.domestic_female_participant.value,289);assert.equal(m.facts.domestic_female_participation.value,81.5);
 assert.equal(m.facts.domestic_gap.value,m.facts.domestic_female.value-m.facts.domestic_male.value);
 assert.equal(m.facts.working_age_work_female.value,442);assert.equal(m.facts.working_age_work_male.value,375);
 const page=fs.readFileSync('src/pages/guides/time-use.astro','utf8');for(const id of Object.keys(m.facts))assert.ok(page.includes('id="n-'+id+'"'),'Ungated or unused prose fact '+id);
 for(const id of ['day','day-age']){const p=m.plates.find(p=>p.id===id);for(const r of p.shape.rows){const t=r.parts.reduce((a,i)=>a+p.rows[i].value,0);assert.ok(Math.abs(t-1440)<=2,id+' '+r.name+' sums to '+t);}}
 const w=m.plates.find(p=>p.id==='where');assert.match(w.explain,/more than 100%/);
 const paid=w.shape.panels[0].items.reduce((a,it)=>a+w.rows[it.b].value,0);assert.ok(paid>100,'paid-work locations overlap for females');
});
test('time-use state ranges come from the published relative standard errors',()=>{
 const p=timeUseModel().plates.find(p=>p.id==='state-range');
 assert.equal(p.shape.items.length,36);
 for(const it of p.shape.items){assert.equal(p.rows[it.rse].unit,'pct_rse');assert.ok(p.rows[it.rse].value>0&&p.rows[it.rse].value<10);}
 assert.match(p.title,/^In \d+ of 35 pairs/);
});
