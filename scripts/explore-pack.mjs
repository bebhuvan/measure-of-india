// One bundle at a time; no catalogue-sized in-memory map or whole-cube browser payload.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DOSSIERS } from '../src/dossiers/registry.js';
import { guideBundles, rowAnchor, periodLabel, bundleTitle } from '../src/dossiers/everycut.js';
import { unitOf } from '../src/dossiers/units.js';
import {getSourceQuality,qualityRegistryVersion} from '../src/explore/source-quality.js';
import { comparisonKey, identity, parseIdentity } from '../src/explore/model.js';
export const PACK_BYTES = 256 * 1024;
const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0,24);
export function packBundle(bundle, B, write) {
  parseIdentity(identity(bundle,'s0000000'));
  const bundleQuality=getSourceQuality(bundle,B),qualityStates={[bundleQuality.id]:bundleQuality};
  const records = Object.entries(B.series).map(([key,series])=>({id:rowAnchor(bundle,key),key,series,unit:unitOf(B,series),compare:null})).sort((a,b)=>a.id.localeCompare(b.id));
  const seen = new Set(), groups = new Map();
  for (const r of records) {
    const quality=getSourceQuality(bundle,B,{...r.series,key:r.key});qualityStates[quality.id]=quality;
    if(quality.id!==bundleQuality.id)r.quality=quality.id;
    r.compare=comparisonKey(bundle,B,r.series,quality);
    if (seen.has(r.id)) throw new Error(`Explorer identity collision in ${bundle}: ${r.id}; do not publish ambiguous links`);
    seen.add(r.id);
    if (r.compare) { r.compare = hash(r.compare); if (!groups.has(r.compare)) groups.set(r.compare,[]); const g=groups.get(r.compare); if(g.length<5)g.push(r.id); }
    if(r.series.data.length!==B.dates.length)throw new Error(`Axis mismatch ${bundle}:${r.key}`);
  }
  const overhead=Buffer.byteLength(JSON.stringify({schemaVersion:1,bundle,records:[]}));
  let current=[], size=overhead; const chunks=[];
  const flush=()=>{if(!current.length)return;const text=JSON.stringify({schemaVersion:1,bundle,records:current});const file=`${hash(text)}.json`; if(Buffer.byteLength(text)>PACK_BYTES)throw new Error(`Oversize explorer shard ${bundle}`);write(file,text);chunks.push({first:current[0].id,last:current.at(-1).id,file,bytes:Buffer.byteLength(text)});current=[];size=overhead;};
  for(const r of records){r.related=(groups.get(r.compare)||[]).filter(id=>id!==r.id).slice(0,4);const n=Buffer.byteLength(JSON.stringify(r))+1;if(size+n>PACK_BYTES)flush();current.push(r);size+=n;}
  flush();
  return {schemaVersion:1,bundle,title:bundleQuality.canInterpret?bundleTitle(bundle,B):bundleQuality.publicTitle,quality:bundleQuality.id,qualityStates,qualityRegistryVersion,meta:B.meta,dates:B.dates,periods:B.dates.map(d=>periodLabel(bundle,B,d)),count:records.length,chunks,examples:records.filter(r=>r.compare&&r.related.length).slice(0,1).map(r=>[r.id,...r.related.slice(0,2)])};
}
export function packCatalogue(dist, {dry=false} = {}) {
  const out=path.resolve(dist,'explore-data');if(!dry){fs.mkdirSync(path.join(out,'c'),{recursive:true});fs.mkdirSync(path.join(out,'m'),{recursive:true});}
  const guides=new Map();for(const d of DOSSIERS)for(const b of guideBundles(d)){if(!guides.has(b))guides.set(b,[]);guides.get(b).push({slug:d.slug,title:d.title,calendar:d.calendar});}
  const catalogue=[],manifests=[],redirects=new Map();let count=0,bytes=0,files=0,max=0,snapshots=0,comparisonEligible=0,interpretationPending=0,qualityCounts={},pooled={};const started=Date.now();
  const emit=(file,text)=>{if(!dry)fs.writeFileSync(path.join(out,'c',file),text);bytes+=Buffer.byteLength(text);files++;max=Math.max(max,Buffer.byteLength(text));};
  let poolNames=[];
  const flushPool=()=>{if(!poolNames.length)return;const text=JSON.stringify({schemaVersion:1,bundles:pooled}),file=hash(text)+'.json';if(Buffer.byteLength(text)>PACK_BYTES)throw new Error('Pooled shard over budget');emit(file,text);for(const old of poolNames)redirects.set(old,{file,bytes:Buffer.byteLength(text)});pooled={};poolNames=[];};
  for(const name of fs.readdirSync('data/series').filter(f=>f.endsWith('.json')).sort()){
    const bundle=name.slice(0,-5),B=JSON.parse(fs.readFileSync('data/series/'+name));
    const manifest=packBundle(bundle,B,(file,text)=>{
      const chunk=JSON.parse(text);
      for(const r of chunk.records){if(JSON.stringify(r.series)!==JSON.stringify(B.series[r.key]))throw new Error(`Explorer source mismatch ${bundle}:${r.key}`);if(r.compare)comparisonEligible++;const q=getSourceQuality(bundle,B,{...r.series,key:r.key});qualityCounts[q.status]=(qualityCounts[q.status]||0)+1;if(!q.canInterpret)interpretationPending++;if(r.series.data.filter(v=>v!=null).length<=1)snapshots++;}
      if(Buffer.byteLength(text)>64*1024){emit(file,text);return;}
      const candidate={...pooled,[bundle]:[...(pooled[bundle]||[]),...chunk.records]};
      if(Buffer.byteLength(JSON.stringify({schemaVersion:1,bundles:candidate}))>PACK_BYTES)flushPool();
      pooled[bundle]=[...(pooled[bundle]||[]),...chunk.records];poolNames.push(file);
    });
    manifest.guides=guides.get(bundle)||[];count+=manifest.count;manifests.push(manifest);
    catalogue.push({bundle,title:manifest.title,count:manifest.count,guides:manifest.guides,examples:manifest.examples});
  }
  flushPool();
  const buckets=new Map();let maxManifest=0,manifestBytes=0;
  for(const m of manifests){for(const part of m.chunks){const pooled=redirects.get(part.file);if(pooled)Object.assign(part,pooled);}m.revision=hash(JSON.stringify(m));const bucket=hash(m.bundle).slice(0,2);if(!buckets.has(bucket))buckets.set(bucket,{});buckets.get(bucket)[m.bundle]=m;}
  for(const [bucket,bundles] of buckets){const text=JSON.stringify({schemaVersion:1,bundles});const n=Buffer.byteLength(text);if(n>1024*1024)throw new Error(`Explorer manifest bucket ${bucket} exceeds1MiB`);if(!dry)fs.writeFileSync(path.join(out,'m',bucket+'.json'),text);files++;manifestBytes+=n;maxManifest=Math.max(maxManifest,n);}
  const catalogText=JSON.stringify({schemaVersion:1,bundles:catalogue});if(!dry)fs.writeFileSync(path.join(out,'catalogue.json'),catalogText);files++;
  const evidence={schemaVersion:1,count,bundles:catalogue.length,snapshots,comparisonEligible,exactMatches:count,blockedIndividual:interpretationPending,interpretationEligible:count-interpretationPending,qualityCounts,qualityRegistryVersion,identityCollisions:0,aliasesDeduplicated:0,files:files+1,shardBytes:bytes,manifestBytes,catalogueBytes:Buffer.byteLength(catalogText),maxShardBytes:max,maxManifestBytes:maxManifest,durationMs:Date.now()-started,maxRSS:process.resourceUsage().maxRSS*1024};
  if(!dry)fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify(evidence));console.log('Explorer packaging:',JSON.stringify(evidence));return evidence;
}
if(process.argv[1]===fileURLToPath(import.meta.url))packCatalogue(process.argv[2]||'dist');
