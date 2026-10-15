// PROPOSED production tests. Source-corpus checks run after family promotion;
// review-only full-corpus evidence is retained separately in the review packet.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {loadPensionDownloadContract,governedDownloadResponse,pensionOriginalResponse,pensionSourceCoverageResponse,verifyGovernedDownloadArtifacts,verifyPensionOriginalArtifacts} from '../src/dossiers/governed-downloads.js';
import {parseCsv} from '../scripts/lib/tabular.mjs';import {getSourceQuality} from '../src/explore/source-quality.js';
import {selectedJSON} from '../src/explore/model.js';
import YAML from 'yaml';
import {pathToFileURL} from 'node:url';
test('native source route serves every pinned original and refuses unknown file requests',async()=>{
 const c=loadPensionDownloadContract();assert.equal(c.originals.length,36);
 for(const s of c.originals){const response=pensionOriginalResponse(s.sha256);assert.equal(response.headers.get('Content-Type'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');const bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),s.sha256);assert.equal(bytes.length,s.bytes);assert.equal(bytes.subarray(0,2).toString(),'PK');}
 assert.equal(pensionOriginalResponse('../outside').status,404);
});
const contract=loadPensionDownloadContract(),present=Object.keys(contract.bundles).every(bundle=>fs.existsSync('data/series/'+bundle+'.json'));
const registered=Boolean(YAML.parse(fs.readFileSync('data/sources.yml','utf8')).dossiers?.pensions);
test('interpreted columns and archival/status responses reconcile the full promoted source corpus',{skip:!registered&&!present},async()=>{
 assert(present,'Registered pension admission must include all37 canonical bundles; corpus test cannot be skipped');
 const dist=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-governed-download-test-'));fs.mkdirSync(path.join(dist,'data'));
 try{
  const bundles=new Map(Object.keys(contract.bundles).map(bundle=>[bundle,JSON.parse(fs.readFileSync('data/series/'+bundle+'.json'))]));
  for(const[bundle,B]of bundles){
   const csvText=await governedDownloadResponse(bundle,B,'csv').text(),jsonText=await governedDownloadResponse(bundle,B,'json').text();fs.writeFileSync(path.join(dist,'data',bundle+'.csv'),csvText);fs.writeFileSync(path.join(dist,'data',bundle+'.json'),jsonText);verifyGovernedDownloadArtifacts(process.cwd(),dist,bundle,B);
   const {_atlas,...canonical}=JSON.parse(jsonText);assert.deepEqual(canonical,B);
   const rows=parseCsv(csvText,','),head=rows.shift();let eligible=0;
   for(const[key,s]of Object.entries(B.series)){const q=getSourceQuality(bundle,B,{...s,key});if(q.canInterpret){eligible++;assert(head.includes(key));assert.deepEqual(rows.map(row=>row[head.indexOf(key)]===''?null:Number(row[head.indexOf(key)])),s.data);}else{assert(!head.includes(key));assert.equal(_atlas.records[key].canInterpret,false);assert.throws(()=>selectedJSON([{key,series:s,quality:q}]),/review|interpret/i);}}
   if(!eligible){assert.equal(head[0],'response_kind');assert(!head.includes('date'));assert(!head.includes('value'));assert(!head.includes('unit'));assert.equal(rows.length,Object.keys(B.series).length);}
  }
  for(const s of contract.originals)fs.writeFileSync(path.join(dist,s.href.slice(1)),Buffer.from(await pensionOriginalResponse(s.sha256).arrayBuffer()));
  fs.writeFileSync(path.join(dist,'data/pensions-source-coverage.json'),await pensionSourceCoverageResponse(bundles).text());verifyPensionOriginalArtifacts(process.cwd(),dist);
 }finally{fs.rmSync(dist,{recursive:true,force:true});}
});
test('other-family download helper leaves literal legacy routes alone',()=>{
 assert.equal(governedDownloadResponse('legacy-fixture',{meta:{dossier:'legacy'},series:{},dates:[]},'csv'),null);
 assert.equal(governedDownloadResponse('legacy-fixture',{meta:{dossier:'legacy'},series:{},dates:[]},'json'),null);
});
test('actual governed source helper survives SSR relocation without borrowing its output directory as project root',async()=>{
 const {build}=await import('vite'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-download-ssr-'));
 try{
  await build({configFile:false,logLevel:'error',build:{ssr:'src/dossiers/governed-downloads.js',outDir:dir,emptyOutDir:true,rollupOptions:{output:{entryFileNames:'relocated.mjs'}}}});
  const compiled=await import(pathToFileURL(path.join(dir,'relocated.mjs'))),c=compiled.loadPensionDownloadContract();assert.equal(c.originals.length,36);
  const s=c.originals[0],response=compiled.pensionOriginalResponse(s.sha256),bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),s.sha256);assert.equal(response.headers.get('Content-Type'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.equal(compiled.pensionOriginalResponse('not-a-source').status,404);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
