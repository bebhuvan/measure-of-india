import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import YAML from 'yaml';
import {rowsOf} from '../src/dossiers/everycut.js';
import {pensionsModel} from '../src/dossiers/pensions.model.js';import {governedPensionPayload,unpackGovernedPensionPayload} from '../src/dossiers/pensions.payload.js';import {pensionClientCSV} from '../src/dossiers/pensions.client-record.js';
import {loadPensionDownloadContract} from '../src/dossiers/governed-downloads.js';
const contract=loadPensionDownloadContract(),present=Object.keys(contract.bundles).every(b=>fs.existsSync('data/series/'+b+'.json')),registered=Boolean(YAML.parse(fs.readFileSync('data/sources.yml','utf8')).dossiers?.pensions);
test('actual governed reader preserves all278 source histories, expected class and observed headline while accounting for pending/held records',{skip:!registered&&!present},()=>{
 assert(present,'Registered pension reader must include all37 publication bundles');const bundles=new Map(Object.keys(contract.bundles).map(b=>[b,JSON.parse(fs.readFileSync('data/series/'+b+'.json'))])),model=pensionsModel({bundles}),packed=governedPensionPayload(model.records),decoded=unpackGovernedPensionPayload(JSON.parse(JSON.stringify(packed)));
 assert.equal(model.records.length,278);assert.equal(model.pending.length,2072);assert.equal(model.heldLedger.heldRecords,314);assert.equal(model.headline.observationKind,'observed-stock');assert.equal(model.headline.bundle,'pensions-m3');assert.deepEqual(decoded,JSON.parse(JSON.stringify(model.records)));
 let values=0;for(const p of decoded){const s=bundles.get(p.bundle).series[p.lines[0].key];assert.deepEqual(p.lines[0].points.map(r=>r.value),s.data);assert(pensionClientCSV(p).includes(p.period));values+=s.data.filter(Number.isFinite).length;}assert.equal(values,4283);
 for(const bundle of bundles.keys())for(const row of rowsOf(bundle)){assert.equal(row.change,null);assert.equal(row.changeText,'—');assert.equal(row.changeEstimated,false);}
 const expected=decoded.filter(p=>p.observationKind==='expected-schedule');assert.equal(expected.length,5);for(const p of expected){assert.equal(p.meta.forecastAsOfStatus,'unknown');assert.equal(p.meta.forecastAsOfDate,null);assert(p.meta.forecastWindowNote);assert(p.meta.note);}
});

// The guide plots one reviewed record per reader question (the lens method); the rest stay in Every
// Cut. Its titles are statements about the data, checked here against the values.
test('guide plates are reviewed records, one per question, and their titles hold',{skip:!registered&&!present},()=>{
 const model=pensionsModel(),records=new Map(model.records.map(p=>[p.id,p])),last=(b,t)=>{const p=model.records.find(p=>p.bundle===b&&p.title===t);return p.lines[0].points.filter(x=>x.value!=null);};
 assert.ok(model.plates.length>=10&&model.plates.length<=18);assert.equal(new Set(model.plates.map(p=>p.title)).size,model.plates.length);assert.equal(new Set(model.plates.map(p=>p.id)).size,model.plates.length);
 for(const p of model.plates){const r=records.get(p.id);assert.ok(r,p.id);assert.deepEqual(p.lines,r.lines);assert.equal(p.sourceQuality.canInterpret,true);assert.ok(p.explain&&p.group);}
 const decoded=unpackGovernedPensionPayload(JSON.parse(JSON.stringify(governedPensionPayload(model.plates))));assert.deepEqual(decoded.map(p=>[p.id,p.title,p.rows[0].value]),model.plates.map(p=>[p.id,p.title,p.rows[0].value]));
 assert.equal(model.plates.filter(p=>p.observationKind==='expected-schedule').length,1);
 const end=(b,t)=>last(b,t).at(-1).value,start=(b,t)=>last(b,t)[0].value;
 const m3=['ALL CITIZEN','CG','CORPORATE','NPS LITE','NPS VATSLYA','SG'];
 assert.ok(m3.every(t=>end('pensions-m3','APY')>end('pensions-m3',t)),'APY has far more members');
 assert.ok(m3.filter(t=>t!=='SG').every(t=>end('pensions-m3','SG')>end('pensions-m3',t)),'SG largest within the NPS');
 assert.ok(end('pensions-m3','CG')/start('pensions-m3','CG')<end('pensions-m3','SG')/start('pensions-m3','SG'),'CG grew more slowly than SG');
 assert.ok(end('pensions-m3','NPS LITE')<Math.max(...last('pensions-m3','NPS LITE').map(x=>x.value)),'NPS Lite has shrunk');
 const aum=['APY','ALL CITIZEN','CORPORATE','NPS LITE','CG'];assert.ok(aum.every(t=>end('pensions-m2','SG')>end('pensions-m2',t)),'SG largest pool');assert.ok(aum.filter(t=>t!=='CG').every(t=>end('pensions-m2','CG')>end('pensions-m2',t)),'CG second');
 const a15=model.records.filter(p=>p.bundle==='pensions-a15');assert.ok(a15.every(p=>end('pensions-a15','Purchase or construction of a residential house')>=p.rows[0].value),'housing is the main early-withdrawal reason');
 const ann=last('pensions-a13','Total');assert.equal(ann.at(-1).value,Math.max(...ann.map(x=>x.value)),'annuities at their highest');
 const emp=last('pensions-a19','TOTAL NUMBER OF CORPORATES REGISTERED IN NPS AS ON THE END OF YEAR');assert.equal(emp.at(-1).value,Math.max(...emp.map(x=>x.value)));
 for(const [name,f] of Object.entries(model.readerFacts)){const r=records.get(f.record);assert.ok(r,name);assert.equal(f.value,r.lines[0].points.find(x=>x.date===f.date).value,name);}
});
