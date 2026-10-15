import {parseIdentity,chunkFor,canComparePolicy,validComparisonPolicy} from './model.js';
// Navigation aborts pending reads; immutable shards use an eight-entry LRU.
export function createLoader(fetcher = fetch, expectedQualityVersion = null) {
  const cache=new Map(), manifests=new Map();
  async function json(url,signal,limit) {
    if(cache.has(url)){const value=cache.get(url);cache.delete(url);cache.set(url,value);return value;}
    let response;try{response=await fetcher(url,{signal,cache:url.includes('/m/')?'no-cache':'default'});}catch(error){if(error.name==='AbortError')throw error;throw new Error('Published Atlas data could not load. Check your connection and retry this link.');}
    if(!response.ok)throw new Error(`Atlas data could not load (${response.status}). Retry this link after refreshing the page.`);
    const text=await response.text();if(new TextEncoder().encode(text).length>limit)throw new Error('Atlas data exceeds its published payload budget.');
    if (/\/[a-f0-9]{24}\.json$/.test(url)) {
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      const fingerprint=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,24);
      if(!url.endsWith('/'+fingerprint+'.json'))throw new Error('Atlas shard content differs from its versioned address. Refresh or retry after the release finishes.');
    }
    const value=JSON.parse(text);if(value.schemaVersion!==1)throw new Error('This page and its data use different versions. Refresh the page.');
    if(!url.includes('/m/')){cache.set(url,value);while(cache.size>8)cache.delete(cache.keys().next().value);}
    return value;
  }
  async function manifest(bundle,signal){
    if(signal?.aborted)throw new DOMException('Navigation cancelled','AbortError');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bundle));
    const bucket=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,2);
    let entry=manifests.get(bucket);
    if(!entry || entry.signal?.aborted){
      entry={signal,promise:null};
      const current=entry;
      entry.promise=json(`/explore-data/m/${bucket}.json`,signal,1024*1024).then(value=>{current.signal=null;return value;}).catch(error=>{if(manifests.get(bucket)===current)manifests.delete(bucket);throw error;});
      manifests.set(bucket,entry);while(manifests.size>8)manifests.delete(manifests.keys().next().value);
    }
    const value=await entry.promise,m=value.bundles?.[bundle];
    if(!m || m.bundle!==bundle)throw new Error('This instrument is unavailable in this release. Read its guide for replacements.');
    if(expectedQualityVersion && m.qualityRegistryVersion!==expectedQualityVersion)throw new Error('This page and its source-quality policy belong to different releases. Refresh the page.');
    return m;
  }
  async function chunk(bundle,m,part,signal){
    if(!/^[a-f0-9]{24}\.json$/.test(part.file))throw new Error('Invalid Atlas shard address.');
    const url=`/explore-data/c/${part.file}`,value=await json(url,signal,256*1024);
    const records=value.bundle===bundle?value.records:value.bundles?.[bundle];
    if(!Array.isArray(records))throw new Error('Atlas instrument shard mismatch.');
    return records;
  }
  async function load(id,signal){const {bundle,anchor}=parseIdentity(id),m=await manifest(bundle,signal),rows=await chunk(bundle,m,chunkFor(m,anchor),signal),r=rows.find(r=>r.id===anchor);if(!r||r.series.data.length!==m.dates.length)throw new Error('The selected series is missing or inconsistent. Refresh the page.');const quality=m.qualityStates?.[r.quality||m.quality];if((m.qualityRegistryVersion||expectedQualityVersion)&&(!validComparisonPolicy(quality)))throw new Error('Source-quality policy is missing or incompatible. Refresh this page; numeric interpretation is withheld.');if(quality&&!canComparePolicy(quality)&&(r.compare!=null||r.related?.length))throw new Error('Published comparison data conflicts with its source-quality policy. Refresh or retry after the release finishes.');return {...r,id,bundle,meta:m.meta,dates:m.dates,periods:quality?.referencePeriod&&m.dates.length===1?[quality.referencePeriod]:m.periods,guides:m.guides,quality:quality||{id:'canonical',status:'canonical-values-checked',canInterpret:true},qualityRegistryVersion:m.qualityRegistryVersion,manifest:m};}
  return {load,manifest,chunk,cache,manifests};
}
