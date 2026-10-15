import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cube,schoolsUnit,nationalHighlights} from '../scripts/lib/products/schools.mjs';
import {readRaw} from '../scripts/lib/util.mjs';
import {schoolModel} from '../src/dossiers/schools.model.js';
const options={label:'Enrolment',code:2,family:'udise',vintage:'2026-10-10',base:'Test instrument',rawFile:'fixture'};
test('Schools cube retains distinct management/gender cuts and rejects duplicate source cells',()=>{
 const rows=[{year:'2023-24',state:'Delhi',gender:'Girls',management:'Government',value:10},{year:'2023-24',state:'Delhi',gender:'Girls',management:'Private',value:20}];
 assert.equal(Object.keys(cube(rows,options).series).length,2);
 assert.throws(()=>cube([...rows,rows[0]],options),/duplicated source cell/);
});
test('Schools missing academic years are null with series-level disclosure',()=>{
 const b=cube([{year:'2022-23',state:'Delhi',value:10},{year:'2024-25',state:'Delhi',value:12}],options);
 assert.deepEqual(b.dates,['2022-04-01','2023-04-01','2024-04-01']);
 assert.deepEqual(b.series.delhi.data,[10,null,12]);assert.deepEqual(b.series.delhi.gaps,['2023-04-01']);
});
test('CMSE mixed subindicators preserve rupees versus percentages',()=>{
 assert.equal(schoolsUnit('Mixed expenses',42,{subindicator:'Average expenditure incurred'},'cmse'),'inr_per_year');
 assert.equal(schoolsUnit('Mixed expenses',42,{subindicator:'Percentage of households'},'cmse'),'pct');
});
test('GER source zero is missing; reported dropout zero is retained',()=>{
 const rows=[{year:'2024-25',state:'Delhi',value:0}];
 assert.equal(Object.values(cube(rows,{...options,label:'Gross Enrolment Ratio (GER)',code:31}).series)[0].data[0],null);
 assert.equal(Object.values(cube(rows,{...options,label:'Dropout rate',code:41}).series)[0].data[0],0);
});
test('National report table extraction covers both pages and rejects a wrong report',()=>{
 const raw=readRaw(process.cwd(),'data/raw/schools-udise-report-2024.json');
 assert.equal(Object.keys(nationalHighlights(raw.text)).length,86);
 assert.throws(()=>nationalHighlights('No national table'),/table missing/);
});
// The lens method (docs/briefs/launch-cleanup-2026-10-15.md): one plate per reader question; every
// other published cell stays in Every Cut and the downloads. Each row names the cells it comes from.
test('Each plate answers its own question; rows and facts recompute from their published cells',()=>{
 const m=schoolModel(),cache=new Map(),cell=x=>{const b=cache.get(x.bundle)??JSON.parse(fs.readFileSync(`data/series/${x.bundle}.json`));cache.set(x.bundle,b);return b.series[x.series].data[b.dates.indexOf(x.date)];};
 const recompute=r=>r.share?Math.round(1000*r.parts.slice(0,r.share.num).reduce((a,x)=>a+cell(x),0)/r.parts.slice(r.share.num).reduce((a,x)=>a+cell(x),0))/10:r.parts.reduce((a,x)=>a+cell(x),0);
 assert.equal(m.plates.length,19);assert.equal(new Set(m.plates.map(p=>p.title)).size,m.plates.length);
 for(const p of m.plates){assert.ok(p.rows.length>=2,p.id);assert.equal(new Set(p.rows.map(r=>r.unit)).size,1,p.id);for(const r of p.rows){assert.ok(Number.isFinite(r.value),p.id);assert.equal(r.value,recompute(r),`${p.id}: ${r.name}`);}}
 // management shares partition schools, pupils and teachers (within rounding)
 const mg=m.plates.find(p=>p.id==='management');for(const k of ['schools','pupils','teachers'])assert.ok(Math.abs(mg.rows.filter(r=>r.name.endsWith(k)).reduce((a,r)=>a+r.value,0)-100)<=0.3,k);
 for(const [id,f] of Object.entries(m.facts)){const src=m.factSources[id];if(src.derived){const n=src.parts.length/2;assert.equal(f.value,Math.round(1000*src.parts.slice(0,n).reduce((a,x)=>a+cell(x),0)/src.parts.slice(n).reduce((a,x)=>a+cell(x),0))/10,id);}else assert.equal(f.value,cell({...src,date:src.date??JSON.parse(fs.readFileSync(`data/series/${src.bundle}.json`)).dates.at(-1)}),id);}
});
