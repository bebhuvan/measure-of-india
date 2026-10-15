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
test('Analytical components exclude overlapping disability totals; management totals reconcile',()=>{
 const m=schoolModel(),find=id=>m.plates.find(p=>p.id===id);
 assert.equal(find('cwsn').rows.length,5);
 assert.equal(find('management').rows.reduce((a,r)=>a+r.value,0),m.facts.schools.value);
 assert.equal(find('teacher-management').rows.reduce((a,r)=>a+r.value,0),m.facts.teachers.value);
 assert.equal(m.plates.length,66);
});
