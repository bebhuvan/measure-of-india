import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {householdCube,householdUnit} from '../scripts/lib/products/households.mjs';
import {householdModel} from '../src/dossiers/households.model.js';
import {validateHouseholds} from '../scripts/lib/households-validation.mjs';
const fixture=rows=>({vintage:'2021-09-10',indicator:{code:11,label:'Asset means',expected:rows.length},rows});
test('AIDIS preserves joint cuts, missing values, and rejects duplicate cells',()=>{
 const r={state:'All-India',sector:'Rural',asset_holding_class:'1',sub_indicator:'Average value of assets (Rs.) - land',value:'-'};
 const b=householdCube(fixture([r,{...r,asset_holding_class:'2',value:'0'}]));
 assert.deepEqual(b.dates,['2018-06-30']);assert.equal(Object.keys(b.series).length,2);
 assert.deepEqual(Object.values(b.series).map(s=>s.data[0]),[null,0]);
 assert.throws(()=>householdCube(fixture([r,r])),/duplicate/);
});
test('AIDIS archive capture never becomes a source revision vintage',()=>{
 const raw=fixture([{state:'All-India',sector:'Rural',sub_indicator:'Average value of assets (Rs.) - land',value:'0'}]);
 raw.vintage='2026-10-10';const b=householdCube(raw);
 assert.equal(b.meta.vintage,null);assert.equal(b.meta.vintageStatus,'unknown');
 assert.equal(b.meta.archiveCapturedDate,'2026-10-10');
 assert.equal(b.meta.reportEditionDate,'2021-09-10');assert.equal(b.meta.apiRevisionDate,null);
 assert.ok(b.meta.vintageNote.includes('no publisher revision timestamp'));
});
test('AIDIS submeasure units override misleading aggregate table headings',()=>{
 assert.equal(householdUnit({sub_indicator:'Total value of assets (Rs. lakhs)'}),'inr_lakh');
 assert.equal(householdUnit({sub_indicator:'Average value of assets per household (Rs.)'}),'inr');
 assert.equal(householdUnit({sub_indicator:'Cash loan (Rs.) per Rs. 1000 of total cash loan outstanding'}),'per_1000');
});
test('AIDIS expenditure uses its flow endpoint, independently of stock date',()=>{
 const r={sub_indicator:'Fixed capital expenditure amount (Rs. lakhs)',value:10};
 const raw=fixture([r]);raw.indicator.code=16;const b=householdCube(raw);
 assert.deepEqual(b.dates,['2019-06-30']);assert.equal(b.meta.latestPeriod,'July 2018–June 2019');
});
test('All source cells replay and statistical identities hold; anomalies remain disclosed',()=>{
 const r=validateHouseholds(process.cwd());assert.deepEqual(r.errors,[]);assert.equal(r.stats.sourceCells,218824);assert.ok(r.stats.identities>3000);
 assert.equal(r.issues.filter(x=>x.value<0).length,2);
});
test('Each indicator has analytical plates; plate observations and facts match canonical cells',()=>{
 const m=householdModel(),slugs=new Set(m.plates.map(p=>p.bundle));
 assert.equal(slugs.size,23);assert.equal(m.plates.length,109);
 for(const p of m.plates){const b=JSON.parse(fs.readFileSync(`data/series/${p.bundle}.json`));for(const r of p.rows){assert.equal(r.value,b.series[r.series].data[0]);assert.equal(r.unit,b.series[r.series].unit);}}
 for(const [id,f] of Object.entries(m.facts)){const src=m.factSources[id],b=JSON.parse(fs.readFileSync(`data/series/${src.bundle}.json`));assert.equal(f.value,b.series[src.series].data[0]);}
});

import {isWageRate} from '../scripts/lib/measure-semantics.mjs';
test('Investment by wage-earning households is not a wage rate; actual wages still reject zero',()=>{
 const s={label:'Regular wage/salary earning households, fixed capital expenditure',dims:{household_type:'Regular wage/salary earning',sub_indicator:'Fixed capital expenditure - average amount (Rs.) per household'}};
 assert.equal(isWageRate(s,'inr'),false);
 assert.equal(isWageRate({...s,dims:{sub_indicator:'Average wage earnings per person'}},'inr'),true);
 assert.equal(isWageRate({label:'Daily wage earnings'},'inr_per_day'),true);
 assert.equal(isWageRate({label:'Total wage bill'},'inr_crore'),false);
});
