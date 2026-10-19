import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readRaw} from './util.mjs';
import {timeUseBundles} from './products/time-use.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function validateTimeUse(root){
 const extraction=readRaw(root,'data/raw/time-use/extracted-2024.json');
 const report=readRaw(root,'data/raw/time-use/report-2024.json');
 assert.equal(hash(Buffer.from(report.bodyBase64,'base64')),report.sha256,'Original PDF hash');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/time-use.manifest.json')));
 assert.equal(extraction.tables.length,62);
 assert.equal(new Set(extraction.tables.map(t=>t.id)).size,62);
 for(const t of extraction.tables){
  const source=readRaw(root,t.rawFile);
  assert.equal(hash(Buffer.from(source.bodyBase64,'base64')),t.sourceSha256,`Original workbook ${t.id}`);
  assert.equal(source.documentSha256,report.sha256,`Report attachment binding ${t.id}`);
  assert.equal(t.documentSha256,report.sha256);
  assert.equal(t.sourceUrl,source.url);
  assert.ok(t.sheets.every(s=>s.unassignedNumeric.length===0),'Every numeric cell is accounted for');
 }
 const classification=readRaw(root,'data/raw/time-use/classification-2024.json');
 assert.equal(classification.reportSha256,report.sha256,'Classification belongs to this original report');
 assert.equal(Object.keys(classification.labels).length,230);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'data/coverage/time-use.labels.json'))),classification.labels,'Original report labels, not API labels');
 const {bundles,items}=timeUseBundles(extraction,classification.labels);let cells=0,identities=0;
 assert.equal(manifest.sourceCells,items.length);
 assert.equal(manifest.withheld,items.filter(i=>i.withheld).length);
 assert.deepEqual(manifest.bundles.map(x=>x.slug),bundles.map(x=>x.slug));
 for(const {slug,bundle} of bundles){
  const actual=JSON.parse(fs.readFileSync(path.join(root,'data/series/'+slug+'.json')));
  assert.deepEqual(actual,bundle,`Full report-to-canonical equality ${slug}`);cells+=Object.keys(bundle.series).length;
 }
 const table=(id)=>bundles.filter(x=>x.bundle.meta.sourceTable===id).flatMap(x=>Object.values(x.bundle.series));
 // Same population and activity: per-person time = participation × participant time.
 const key=d=>JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k])=>k!=='measure')));
 const parts=new Map(table('t6').map(s=>[key(s.dims),s.data[0]])),duration=new Map(table('t7').map(s=>[key(s.dims),s.data[0]]));
 for(const s of table('t8')){const p=parts.get(key(s.dims)),m=duration.get(key(s.dims));if(p===undefined||m===undefined)continue;
  // Source rounds participation to 0.1 points and minutes to whole minutes.
  const tolerance=0.5+0.0005*m+0.005*p+0.00025;
  assert.ok(Math.abs(s.data[0]-p*m/100)<=tolerance+1e-9,`Participation identity ${key(s.dims)}`);identities++;
 }
 // Only the nine non-overlapping major divisions partition the day.
 const groups=new Map();for(const s of table('t8'))if(/^Major Division: [1-9]$/.test(s.dims.source_row)){
  const {source_row,measure,...d}=s.dims,k=JSON.stringify(d);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s.data[0]);
 }
 for(const [k,v]of groups){assert.equal(v.length,9,'Complete day '+k);assert.ok(Math.abs(v.reduce((a,b)=>a+b,0)-1440)<=4.5,'Rounded day budget '+k);identities++;}
 for(const id of ['t41','t42','t43','t44']){
  const groups=new Map();
  for(const s of table(id)){
   const {measure,source_column,...d}=s.dims;
   const k=JSON.stringify({...d,column:source_column.replace(/ \/ (?:percentage of persons|minutes spent on an average in a day per person|minutes spent on an average in a day per participant)$/,'')});
   if(!groups.has(k))groups.set(k,{});groups.get(k)[measure]=s.data[0];
  }
  for(const [k,g]of groups){const p=g['Participation rate'],m=g['Minutes per participant'],v=g['Minutes per person'];if([p,m,v].some(x=>x===undefined))continue;
   const tolerance=0.5+0.0005*m+0.005*p+0.00025;
   assert.ok(Math.abs(v-p*m/100)<=tolerance+1e-9,`${id} joint participation identity ${k}`);identities++;
  }
 }
 // Locations overlap: do not constrain their participation rates to sum to 100.
 // Weighted location time reconstructs the all-location participant duration.
 const locationGroups=new Map();
 for(const id of ['t39','t40'])for(const s of table(id)){
  const {source_column,measure,...dims}=s.dims,k=JSON.stringify(dims);
  if(!locationGroups.has(k))locationGroups.set(k,{rates:new Map(),times:new Map()});
  locationGroups.get(k)[id==='t39'?'rates':'times'].set(source_column,s.data[0]);
 }
 for(const [key,g]of locationGroups){
  let sum=0,tolerance=0.5;
  for(const [location,rate]of g.rates){
   if(location.endsWith('all (incl. n.r.)'))continue;
   const duration=g.times.get(location);assert.ok(Number.isFinite(duration),'Location duration '+key);
   sum+=rate*duration/100;
   tolerance+=0.0005*duration+0.005*rate+0.00025;
  }
  const control=[...g.times].find(([location])=>location.endsWith('all (incl. n.r.)'));
  assert.ok(control,'All-location control '+key);
  assert.ok(Math.abs(sum-control[1])<=tolerance+1e-9,'Overlapping location-time identity '+key);identities++;
 }
 assert.ok(identities>9000,'Identity scope must include the detailed source family');
 return {sourceCells:items.length,canonicalCells:cells,withheld:manifest.withheld,workbooks:62,identities};
}
