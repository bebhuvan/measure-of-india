import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {farmCell,farmUnit,sourceValue} from '../scripts/lib/products/farm-households.mjs';
import {farmModel} from '../src/dossiers/farm-households.model.js';
import {validateFarmHouseholds} from '../scripts/lib/farm-households-validation.mjs';
import {extractFarmReport} from '../scripts/farm-households-report.mjs';
import {readRaw} from '../scripts/lib/util.mjs';
test('survey column headings cannot become negative estimates; zeros and negative net incomes survive',()=>{
 assert.equal(sourceValue('(2)'),null);assert.equal(sourceValue('-'),null);assert.equal(sourceValue('0'),0);assert.equal(sourceValue('-125'),-125);
});
test('missing land-class count rows are counts even with an employment category',()=>{
 assert.equal(farmUnit(18,{'Land_Possessed(hectares)':null,household_employment:'Self-employment in'}),'hundreds');
 assert.equal(farmUnit(18,{'Land_Possessed(hectares)':'All Size',household_employment:'Self-employment in'}),'per_1000');
});
test('incorrect API vectors and MSP labels are quarantined without losing source strings',()=>{
 for(const code of [33,47]){const [,s]=farmCell(code,{state:'All India',indicator:'Survey',value:'245554'},['state']);assert.deepEqual(s.data,[null]);assert.equal(s.sourceValue,'245554');assert.ok(s.note);}
});
test('full API and report replay, arithmetic and duplicated-vector checks pass',()=>{
 const r=validateFarmHouseholds(process.cwd());assert.deepEqual(r.errors,[]);assert.equal(r.stats.sourceCells,501008);assert.ok(r.stats.identities>20000);assert.equal(r.stats.withheld,78);assert.deepEqual(r.issues.filter(x=>x.states).map(x=>x.code),[33]);
});
test('report extraction retains complete land-class grids and distinguishes conditional populations',()=>{
 const r=extractFarmReport(readRaw(process.cwd(),'data/raw/farm-households-report.json'));
 assert.equal(Object.keys(r.seriesByTable['29']).length,31*8*25);assert.equal(Object.keys(r.seriesByTable['27A']).length,31*8*3*16);
 const national=Object.values(r.seriesByTable['29']).find(s=>s.dims.state==='All India'&&s.dims['Land_Possessed(hectares)']==='All Size'&&s.dims.sub_indicator==='Mean outstanding loan per agricultural household');assert.equal(national.data[0],74121);assert.ok(national.source.pdfPage>0);
});
test('analytical values and headline figures trace to their actual canonical cells',()=>{
 const m=farmModel(),cache=new Map(),load=slug=>cache.get(slug)??(cache.set(slug,JSON.parse(fs.readFileSync('data/series/'+slug+'.json'))),cache.get(slug));
 assert.equal(m.facts.paid_income.value,10218);assert.equal(m.facts.imputed_income.value,8337);assert.equal(m.facts.debt.value,74121);assert.equal(m.facts.indebted.value,502);
 for(const p of m.plates){assert.equal(new Set(p.rows.map(r=>r.unit)).size,1);for(const r of p.rows)assert.equal(r.value,load(r.bundle).series[r.series].data[0]);}
 for(const [id,f]of Object.entries(m.facts)){const s=m.factSources[id];if(s.bundle)assert.equal(f.value,load(s.bundle).series[s.series].data[0]);else assert.ok(s.sourceText.includes(String(f.value)),id);}
});
