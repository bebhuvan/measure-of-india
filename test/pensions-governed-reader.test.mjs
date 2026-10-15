import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import YAML from 'yaml';
import {rowsOf} from '../src/dossiers/everycut.js';
import {pensionsModel} from '../src/dossiers/pensions.model.js';import {governedPensionPayload,unpackGovernedPensionPayload} from '../src/dossiers/pensions.payload.js';import {pensionClientCSV} from '../src/dossiers/pensions.client-record.js';
import {loadPensionDownloadContract} from '../src/dossiers/governed-downloads.js';
const contract=loadPensionDownloadContract(),present=Object.keys(contract.bundles).every(b=>fs.existsSync('data/series/'+b+'.json')),registered=Boolean(YAML.parse(fs.readFileSync('data/sources.yml','utf8')).dossiers?.pensions);
test('actual governed reader preserves all278 source histories, expected class and observed headline while accounting for pending/held records',{skip:!registered&&!present},()=>{
 assert(present,'Registered pension reader must include all37 publication bundles');const bundles=new Map(Object.keys(contract.bundles).map(b=>[b,JSON.parse(fs.readFileSync('data/series/'+b+'.json'))])),model=pensionsModel({bundles}),packed=governedPensionPayload(model.plates),decoded=unpackGovernedPensionPayload(JSON.parse(JSON.stringify(packed)));
 assert.equal(model.plates.length,278);assert.equal(model.pending.length,2072);assert.equal(model.heldLedger.heldRecords,314);assert.equal(model.headline.observationKind,'observed-stock');assert.equal(model.headline.bundle,'pensions-m3');assert.deepEqual(decoded,JSON.parse(JSON.stringify(model.plates)));
 let values=0;for(const p of decoded){const s=bundles.get(p.bundle).series[p.lines[0].key];assert.deepEqual(p.lines[0].points.map(r=>r.value),s.data);assert(pensionClientCSV(p).includes(p.period));values+=s.data.filter(Number.isFinite).length;}assert.equal(values,4283);
 for(const bundle of bundles.keys())for(const row of rowsOf(bundle)){assert.equal(row.change,null);assert.equal(row.changeText,'—');assert.equal(row.changeEstimated,false);}
 const expected=decoded.filter(p=>p.observationKind==='expected-schedule');assert.equal(expected.length,5);for(const p of expected){assert.equal(p.meta.forecastAsOfStatus,'unknown');assert.equal(p.meta.forecastAsOfDate,null);assert(p.meta.forecastWindowNote);assert(p.meta.note);}
});
