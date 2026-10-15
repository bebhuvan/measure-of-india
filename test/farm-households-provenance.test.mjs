import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {vintageText,vintageError,UNKNOWN_VINTAGE_TEXT} from '../scripts/lib/vintage.mjs';
import {farmModel} from '../src/dossiers/farm-households.model.js';
import {readRaw} from '../scripts/lib/util.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('all 83 bundles distinguish report edition, unknown API revision and archive capture',()=>{
 const manifest=JSON.parse(fs.readFileSync('data/coverage/farm-households.manifest.json'));
 let api=0,report=0,cells=0;
 for(const {slug} of manifest.bundles){
  const b=JSON.parse(fs.readFileSync(`data/series/${slug}.json`)),m=b.meta;
  assert.equal(vintageError(m),null,slug);assert.equal(m.reportEditionDate,'2021-09-10',slug);
  assert.match(m.archiveSha256,/^[a-f0-9]{64}$/);
  if(slug.includes('-nss77-')){
   api++;assert.equal(m.vintage,null,slug);assert.equal(m.vintageStatus,'unknown',slug);
   assert.equal(m.apiRevisionDate,null,slug);assert.ok(m.vintageNote.length>20);
   assert.equal(vintageText(m),UNKNOWN_VINTAGE_TEXT,slug);
   const raw=readRaw(process.cwd(),m.rawFile);
   assert.equal(m.archiveCapturedDate,raw.archiveCapturedDate??raw.vintage,slug);
  }else{
   report++;assert.equal(m.vintage,'2021-09-10',slug);assert.equal(m.vintageBasis,'report-edition',slug);
   assert.equal(m.archiveCapturedDate,null,slug);assert.equal(m.sourceRevisionDate,null,slug);
   assert.ok(m.archiveCaptureNote.includes('not recorded'));
  }
  cells+=Object.keys(b.series).length;
 }
 assert.equal(api,78);assert.equal(report,5);assert.equal(cells,501008);
});
test('published archive checksums identify the preserved source bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync('data/coverage/farm-households.manifest.json'));
 for(const {slug} of manifest.bundles){
  const b=JSON.parse(fs.readFileSync(`data/series/${slug}.json`));
  assert.equal(b.meta.archiveSha256,hash(fs.readFileSync(b.meta.rawFile+'.gz')),slug);
 }
});
test('all 229 analytical plates retain source provenance and use the shared unknown-friendly text',()=>{
 const m=farmModel();assert.equal(m.plates.length,229);
 assert.equal(Object.keys(m.provenance).length,83);
 for(const p of m.plates){
  assert.equal(p.vintageText,vintageText(p),p.id);
  assert.equal(p.reportEditionDate,'2021-09-10');assert.ok(p.vintageNote.length>20);
  assert.equal(p.apiRevisionDate,null);assert.equal(p.sourceRevisionDate,null);
 }
 assert.equal(m.plates[0].vintage,null);
 assert.equal(m.plates[0].vintageText,UNKNOWN_VINTAGE_TEXT);
});
