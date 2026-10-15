import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash,webcrypto}from'node:crypto';import {JSDOM}from'jsdom';
import {verifyInvestorPayload,investorFingerprintText}from'../src/dossiers/investor-participation.guard.js';
import {investorCertificate}from'../src/dossiers/investor-participation.certificate.js';
import {qualityRegistryVersion}from'../src/explore/source-quality.js';
import {investorPlot,prepareInvestorGeometry}from'../src/dossiers/investor-participation.plot.js';
import {exportInvestorPlate}from'../src/dossiers/investor-participation.client.js';
import {investorCSV}from'../src/dossiers/investor-participation.export.js';
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/investor-reviewed-payload.json',import.meta.url)));
function fixture(){const p=structuredClone(source);p.qualityVersion=qualityRegistryVersion;for(const r of p.plates)r.qualityVersion=qualityRegistryVersion;return p;}
test('independent browser certificate admits only literal reviewed source records',async()=>{
 assert.equal(investorCertificate.qualityVersion,qualityRegistryVersion);const p=await verifyInvestorPayload(fixture(),{crypto:webcrypto});assert.equal(p.plates.length,3);assert.equal(p.coverage.total,7657);assert.ok(Object.isFrozen(p.plates[0].source.record.data));
});
test('paired source+binding forgeries, changed meaning and missing reviewed scope fail closed',async()=>{
 const mutations=[p=>{const r=p.plates[0];r.source.record.data[0]++;r.rows[0].points[0].value++;r.sourceQuality.binding.records[r.key]=createHash('sha256').update(investorFingerprintText(r.source)).digest('hex');},p=>{p.plates[0].sourceQuality.definition+=' forged meaning';p.plates[0].sourceQuality.review.sourceVersion='new-review';},p=>{p.plates[0].key='not-reviewed';p.plates[0].rows[0].key='not-reviewed';},p=>{p.plates.pop();p.coverage.reviewed--;p.coverage.pending++;p.facts=p.facts.filter(f=>p.plates.some(r=>r.id===f.plate));},p=>{p.facts[0].value++;},p=>{[p.facts[0].id,p.facts[1].id]=[p.facts[1].id,p.facts[0].id];},p=>{p.facts.pop();},p=>{p.facts[0].label='Other measure';},p=>{p.plates[0].unit='lakh';p.plates[0].source.record.unit='lakh';},p=>{p.plates[0].derived='sum of other records';},p=>{p.qualityVersion='wrong-version';}];
 for(const mutate of mutations){const p=fixture();mutate(p);await assert.rejects(verifyInvestorPayload(p,{crypto:webcrypto}));}
});
test('compact marker, actual width, source fallback and exports preserve exact record binding',async()=>{
 const p=await verifyInvestorPayload(fixture(),{crypto:webcrypto}),doc=new JSDOM('<!doctype html><html><body></body></html>').window.document;
 for(const width of[180,280,350,505,728,1080,1184]){const geometry=prepareInvestorGeometry(p.plates,()=>width,{document:doc});for(const plate of p.plates){const g=geometry.get(plate.id),result=investorPlot(plate,g,{document:doc});assert.equal(Number(result.svg.getAttribute('width')),width);assert.equal(result.svg.dataset.compact,'true');if(width===180){assert.equal(result.element.tagName,'TABLE');assert.equal(result.element.querySelectorAll('tbody tr').length,2);}const csv=investorCSV(plate);assert.equal(csv.split('\n').filter(Boolean).length,3);assert.ok(csv.includes(plate.key));assert.ok(csv.includes('policy_anchor_sha256'));assert.ok(!csv.includes('raw_source_sha256'));
  const saved=[],actions={downloadSVG:()=>saved.push('svg'),downloadPNG:()=>saved.push('png'),saveBlob:()=>saved.push('csv')};for(const kind of['svg','png','csv'])exportInvestorPlate(plate,result.svg,kind,{actions,meta:{title:plate.title}});assert.deepEqual(saved,['svg','png','csv']);assert.throws(()=>exportInvestorPlate(plate,result.svg.cloneNode(true),'svg',{actions}),/graphic/);const other=p.plates.find(o=>o!==plate);assert.throws(()=>exportInvestorPlate(other,result.svg,'csv',{actions}),/graphic/);
 }}assert.throws(()=>prepareInvestorGeometry(p.plates,()=>0,{document:doc}),/positive/);
});
