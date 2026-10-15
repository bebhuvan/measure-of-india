import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {farmModel} from '../src/dossiers/farm-households.model.js';
test('Farm snapshot cache refreshes same-size canonical changes and definition archive changes',()=>{
 const original=process.cwd(),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-farm-cache-'));
 const manifest=JSON.parse(fs.readFileSync('data/coverage/farm-households.manifest.json'));
 const files=['data/coverage/farm-households.manifest.json','data/raw/farm-households-report.json.gz',...manifest.bundles.map(x=>`data/series/${x.slug}.json`)];
 try{
  for(const file of files){fs.mkdirSync(path.dirname(path.join(fixture,file)),{recursive:true});fs.linkSync(path.join(original,file),path.join(fixture,file));}
  process.chdir(fixture);
  const first=farmModel();assert.strictEqual(farmModel(),first);assert.equal(first.summary.series,491284);
  const file='data/series/farm-households-nss77-24-03.json',before=fs.readFileSync(file,'utf8'),b=JSON.parse(before);
  b.series[first.factSources.paid_income.series].data[0]=10219;
  const after=JSON.stringify(b,null,1)+'\n';assert.equal(Buffer.byteLength(after),Buffer.byteLength(before),'fixture change must retain byte length');
  // Atomic replacement leaves the hard-linked real source untouched.
  fs.writeFileSync(file+'.fixture',after);fs.renameSync(file+'.fixture',file);fs.utimesSync(file,new Date(),new Date(Date.now()+2000));
  const revised=farmModel();assert.notStrictEqual(revised,first);assert.equal(revised.facts.paid_income.value,10219);assert.equal(revised.summary.series,491284);assert.strictEqual(farmModel(),revised);
  const archive='data/raw/farm-households-report.json.gz',raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(archive)));
  const definition=raw.text.match(/An agricultural household for 77th Round survey was defined as[\s\S]*?value of produce more than Rs\. ([\d,]+)[\s\S]*?during last (\d+)\s+days/);
  assert.ok(definition);const altered=definition[0].replace('Rs. '+definition[1],'Rs. 4,001');assert.notEqual(altered,definition[0]);raw.text=raw.text.replace(definition[0],altered);raw.fixtureLabel='Definition archive changed';
  fs.writeFileSync(archive+'.fixture',zlib.gzipSync(JSON.stringify(raw)));fs.renameSync(archive+'.fixture',archive);
  const redefined=farmModel();assert.notStrictEqual(redefined,revised);assert.equal(redefined.facts.qualifying_produce.value,4001);assert.equal(redefined.facts.paid_income.value,10219);assert.equal(redefined.summary.series,491284);assert.strictEqual(farmModel(),redefined);
 }finally{process.chdir(original);fs.rmSync(fixture,{recursive:true,force:true});}
});
