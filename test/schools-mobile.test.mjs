import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {schoolModel} from '../src/dossiers/schools.model.js';
import {schoolPlot,schoolLabelLines} from '../src/dossiers/schools.plot.js';
import {schoolFormat} from '../src/dossiers/schools.format.js';

const dom=new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window=dom.window;
globalThis.document=dom.window.document;
const model=schoolModel();
for(const width of [284,354,509,680]){
 test(`all Schools charts show dots, full labels and values within ${width}px`,()=>{
  for(const p of model.plates){
   const rows=p.rows.map((r,index)=>({...r,index}));
   const svg=schoolPlot(p,rows,width);
   assert.equal(+svg.getAttribute('width'),width,p.id);
   assert.equal(svg.getAttribute('data-compact'),'schools',p.id);
   const dots=[...svg.querySelectorAll('[aria-label="dot"] circle')];
   assert.equal(dots.length,rows.length,p.id);
   for(const dot of dots){
    assert.ok(+dot.getAttribute('cx')>=12 && +dot.getAttribute('cx')<=width-100,`${p.id}: dot fits beside value column`);
   }
   const texts=[...svg.querySelectorAll('text')].map(t=>t.textContent);
   for(const row of rows){
    for(const line of schoolLabelLines(row.name,width))assert.ok(texts.includes(line),`${p.id}: ${line}`);
    assert.ok(texts.includes(schoolFormat(row.value,row.unit)),`${p.id}: full value`);
   }
   assert.ok(!svg.textContent.includes('…'),`${p.id}: no truncated names`);
  }
 });
}
test('desktop retains the established wide chart and labels',()=>{
 const p=model.plates[0];const svg=schoolPlot(p,p.rows,1000);
 assert.equal(+svg.getAttribute('width'),1120);
 assert.equal(svg.getAttribute('data-compact'),null);
 assert.ok(svg.querySelector('[aria-label="y-axis tick label"]'));
});
