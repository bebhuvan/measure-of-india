// Post-build gate: all published identities/records/axes/provenance traced to canonical bundles.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {getSourceQuality,qualityRegistryVersion} from '../src/explore/source-quality.js';
import {rowAnchor} from '../src/dossiers/everycut.js';
import {canComparePolicy} from '../src/explore/model.js';
const dist=path.resolve(process.argv[2]||'dist'),root=path.join(dist,'explore-data');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,24);
const cache=new Map(),published=new Set();let records=0,points=0,maxShard=0,maxManifest=0,pending=0;const qualityCounts={};
const readShard=file=>{if(cache.has(file))return cache.get(file);assert.match(file,/^[a-f0-9]{24}\.json$/);const text=fs.readFileSync(path.join(root,'c',file),'utf8'),bytes=Buffer.byteLength(text);assert.ok(bytes<=256*1024,`Oversize shard ${file}`);assert.equal(hash(text)+'.json',file,'Shard hash mismatch');const value=JSON.parse(text);assert.equal(value.schemaVersion,1);cache.set(file,value);while(cache.size>8)cache.delete(cache.keys().next().value);maxShard=Math.max(maxShard,bytes);return value;};
for(const bucket of fs.readdirSync(path.join(root,'m')).sort()){
 const text=fs.readFileSync(path.join(root,'m',bucket),'utf8');maxManifest=Math.max(maxManifest,Buffer.byteLength(text));assert.ok(Buffer.byteLength(text)<=1024*1024,'Manifest bucket over budget');const manifest=JSON.parse(text);assert.equal(manifest.schemaVersion,1);
 for(const [bundle,m] of Object.entries(manifest.bundles)){
  assert.equal(hash(bundle).slice(0,2)+'.json',bucket,'Incorrect bucket address');const {revision,...description}=m;assert.equal(hash(JSON.stringify(description)),revision,'Manifest revision checksum mismatch');assert.ok(!published.has(bundle),'Duplicate instrument');published.add(bundle);
  const B=JSON.parse(fs.readFileSync('data/series/'+bundle+'.json'));assert.equal(m.qualityRegistryVersion,qualityRegistryVersion,'Source-quality policy version mismatch');assert.deepEqual(m.qualityStates[m.quality],getSourceQuality(bundle,B),'Bundle-quality policy mismatch');assert.deepEqual(m.meta,B.meta,'Provenance mismatch');assert.deepEqual(m.dates,B.dates,'Axis mismatch');assert.equal(m.periods.length,B.dates.length);const seen=new Set();
  let previous='';for(const part of m.chunks){assert.ok(part.first>previous&&part.last>=part.first,'Overlapping/unsorted bounds');previous=part.last;const shard=readShard(part.file),rows=shard.bundle===bundle?shard.records:shard.bundles?.[bundle];assert.ok(Array.isArray(rows),'Instrument missing from chunk');
   const matching=rows.filter(r=>r.id>=part.first&&r.id<=part.last);assert.ok(matching.length,'Empty shard locator');
   for(const r of matching){assert.ok(!seen.has(r.key),'Duplicate series');seen.add(r.key);assert.equal(r.id,rowAnchor(bundle,r.key));assert.deepEqual(r.series,B.series[r.key],`${bundle}:${r.key} source mismatch`);assert.equal(r.series.data.length,m.dates.length);const q=getSourceQuality(bundle,B,{...r.series,key:r.key});assert.deepEqual(m.qualityStates[r.quality||m.quality],q,'Record quality mismatch');qualityCounts[q.status]=(qualityCounts[q.status]||0)+1;if(!q.canInterpret)pending++;if(!canComparePolicy(q)){assert.equal(r.compare,null,'Source policy prohibits this comparison');assert.deepEqual(r.related,[],'Restricted record cannot advertise comparisons');}records++;points+=r.series.data.length;}
  }
  assert.equal(seen.size,Object.keys(B.series).length,`${bundle} coverage omission`);assert.equal(m.count,seen.size);
 }
}
const sourceBundles=fs.readdirSync('data/series').filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5));assert.equal(published.size,sourceBundles.length,'Bundle omission');for(const b of sourceBundles)assert.ok(published.has(b));
// Files per deployment: Cloudflare Pages accepts at most 20,000 files in one deployment. The
// budget keeps 4,000 of those free for the next data wave and for _headers/_redirects/OG growth,
// so a build that would break deploys fails here first. Raise it only with the hosting limit
// (docs/briefs/performance-scale-2026-10-15.md owns the move off that limit).
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).reduce((n,f)=>n+(f.isDirectory()?walk(path.join(d,f.name)):1),0);const assets=walk(dist);const target=Number(process.env.ATLAS_EXPLORE_ASSET_LIMIT||16000);assert.ok(assets<=target,`Integrated asset count ${assets} exceeds headroom budget ${target}`);
const evidence={schemaVersion:1,bundles:published.size,records,observations:points,interpretationPending:pending,interpretationEligible:records-pending,qualityCounts,qualityRegistryVersion,maxShardBytes:maxShard,maxManifestBytes:maxManifest,integratedAssets:assets,assetBudget:target,passed:true};console.log('Explorer verified:',JSON.stringify(evidence));   // a gate only reads: evidence goes to the log, never into the repo
