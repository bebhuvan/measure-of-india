import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {canComparePolicy,validComparisonPolicy,comparisonKey,assertCompatible,selectedCSV,selectedJSON,identity,seriesURL} from '../src/explore/model.js';
import {sourceQualityRegistry,validateQualityRegistry,getSourceQuality,sourceBundleFingerprint} from '../src/explore/source-quality.js';
import {packBundle} from '../scripts/explore-pack.mjs';
import {createLoader} from '../src/explore/loader.js';
import {rowAnchor} from '../src/dossiers/everycut.js';
import {createSearch,encodeIds} from '../src/dossiers/search-core.js';

const reason='Literal source counts are reviewed; territory and population comparability are unresolved.';
const restricted={canInterpret:true,canCompare:false,comparisonReason:reason};
const B={meta:{frequency:'monthly',unit:'count'},dates:['2026-01-01','2026-02-01'],series:{
 a:{label:'Source-labelled account count A',unit:'count',dims:{state:'A',measure:'Accounts',association:'current'},data:[17,null],gaps:['2026-02-01']},
 b:{label:'Source-labelled account count B',unit:'count',dims:{state:'B',measure:'Accounts',association:'current'},data:[5,9]},
}};
const record=(key='a',quality=restricted)=>({id:identity('fixture-policy',rowAnchor('fixture-policy',key)),key,bundle:'fixture-policy',meta:B.meta,series:B.series[key],dates:B.dates,unit:'count',compare:'forged-or-legacy-set',quality});
function packed(override){
 const original=sourceQualityRegistry.default;
 try{
  sourceQualityRegistry.default={...original,id:'fixture-default',...override};
  validateQualityRegistry(sourceQualityRegistry);
  const files=new Map(),manifest=packBundle('fixture-policy',B,(file,text)=>files.set(file,text));
  return {manifest,files};
 }finally{sourceQualityRegistry.default=original;}
}
const fetchFixture=({manifest,files})=>async url=>({ok:true,text:async()=>url.includes('/m/')?JSON.stringify({schemaVersion:1,bundles:{'fixture-policy':manifest}}):files.get(url.split('/').at(-1))});
const loadFixture=fixture=>createLoader(fetchFixture(fixture),fixture.manifest.qualityRegistryVersion);
function searchFixture(policy){
 const core={guides:[['fixture','Accounts','Literal counts']],plates:[],views:[],bundles:[['fixture-policy','Accounts','monthly',0,0,2,[[0,'/guides/fixture/']],'']],shards:{frequent:[],tokens:['accounts'],rows:[0]},quality:{version:'fixture-version',default:'fixture',policies:{fixture:{id:'fixture',...policy}},bundles:{},rowOverrides:{}}};
 const files={'t/0.json':{accounts:encodeIds([0,1])},'r/0.json':[['Accounts A','',17,'Jan 2026',rowAnchor('fixture-policy','a'),[17]],['Accounts B','',9,'Feb 2026',rowAnchor('fixture-policy','b'),[5,9]]]};
 return {core,load:async path=>files[path]};
}

test('restricted reviewed counts retain exact single-series values, nulls, dates and source fields',()=>{
 const r=record();
 assert.equal(canComparePolicy(restricted),false);
 assert.equal(comparisonKey('fixture-policy',B,B.series.a,restricted),null);
 assert.match(selectedCSV([r]),/2026-01-01,17,2026-01-01,false\r\n/);
 assert.match(selectedCSV([r]),/2026-02-01,,2026-02-01,false\r\n/);
 const exported=selectedJSON([r]).series[0];
 assert.deepEqual(exported.observations.map(d=>d.value),[17,null]);
 assert.deepEqual(exported.observations.map(d=>d.date),B.dates);
 assert.deepEqual(exported.series.dims,B.series.a.dims);
 assert.deepEqual(B.series.a.data,[17,null]);
});

test('direct comparison and both multi-series exports reject a restriction despite forged equal set IDs',()=>{
 const records=[record(),record('b')];
 assert.throws(()=>assertCompatible(records),/comparisons are withheld/);
 assert.throws(()=>selectedCSV(records),/comparisons are withheld/);
 assert.throws(()=>selectedJSON(records),/Comparison exports are withheld/);
});

test('missing capability preserves eligible comparison-key and selected-export defaults',()=>{
 const policy={canInterpret:true},a=record('a',policy),b=record('b',policy);
 const expected=JSON.stringify([['fixture-policy',null,'monthly',null,null],'count',[['association','current'],['measure','Accounts']]]);
 assert.equal(comparisonKey('fixture-policy',B,B.series.a,policy),expected);
 assert.equal(comparisonKey('fixture-policy',B,B.series.b),expected);
 assert.equal(canComparePolicy(null),true);assert.equal(canComparePolicy(policy),true);
 assert.doesNotThrow(()=>assertCompatible([a,b]));
 assert.equal(selectedCSV([a,b]),selectedCSV([{...a,quality:null},{...b,quality:null}]));
 assert.deepEqual(selectedJSON([a,b]).series.map(s=>s.observations),selectedJSON([{...a,quality:null},{...b,quality:null}]).series.map(s=>s.observations));
});

test('explicit permission never relaxes instrument, measure, fixed cuts, unit or frequency',()=>{
 const policy={canInterpret:true,canCompare:true},a=record('a',policy),b=record('b',policy);
 for(const candidate of [{...b,unit:'index'},{...b,bundle:'another-instrument'},{...b,meta:{...B.meta,frequency:'annual'}},{...b,meta:{...B.meta,base:'another-base'}},{...b,compare:'different-measure-or-cut'}])assert.throws(()=>assertCompatible([a,candidate]));
 assert.notEqual(comparisonKey('fixture-policy',B,{...B.series.b,dims:{...B.series.b.dims,measure:'Contributors'}},policy),comparisonKey('fixture-policy',B,B.series.a,policy));
 assert.notEqual(comparisonKey('fixture-policy',B,{...B.series.b,dims:{...B.series.b.dims,association:'historical'}},policy),comparisonKey('fixture-policy',B,B.series.a,policy));
});

test('interpreted restriction needs a typed substantive explanation or validated existing reason fallback',()=>{
 assert.equal(validComparisonPolicy(restricted),true);
 assert.equal(validComparisonPolicy({canInterpret:true,canCompare:false,reason}),true);
 for(const policy of [{canInterpret:true,canCompare:false},{canInterpret:true,canCompare:false,comparisonReason:'short',reason},{canInterpret:true,canCompare:false,reason:' '.repeat(30)},{canInterpret:true,canCompare:false,comparisonReason:123},{canInterpret:true,canCompare:'false'},{canInterpret:false,canCompare:true},{canCompare:true}]){
  assert.equal(validComparisonPolicy(policy),false);
  assert.equal(canComparePolicy(policy),false);
  assert.throws(()=>selectedCSV([record('a',policy)]),/withheld/);
  assert.throws(()=>selectedJSON([record('a',policy)]),/withheld/);
 }
 assert.equal(validComparisonPolicy({canInterpret:false,canCompare:false}),true);
 assert.equal(canComparePolicy({canInterpret:false,canCompare:false}),false);
});

test('registry and search reject malformed, contradictory and unexplained comparison capabilities',()=>{
 const policy={id:'fixture',status:'canonical',canInterpret:true,reason:'Canonical source values are checked mechanically.'};
 for(const invalid of [{...policy,canCompare:'false'},{...policy,canInterpret:false,canCompare:true},{...policy,canCompare:false,comparisonReason:'short'},{...policy,canCompare:false,reason:'short'}]){
  assert.throws(()=>validateQualityRegistry({schemaVersion:1,default:invalid,rules:[]}));
  const {core,load}=searchFixture(invalid);assert.throws(()=>createSearch(core,load),/quality policy/);
 }
 assert.doesNotThrow(()=>validateQualityRegistry({schemaVersion:1,default:{...policy,canCompare:false},rules:[]}));
});

test('small-bundle packaging preserves exact reviewed records while clearing compare and related advertisements',()=>{
 const before=JSON.stringify(B),fixture=packed(restricted),rows=[...fixture.files.values()].flatMap(t=>JSON.parse(t).records);
 assert.equal(fixture.manifest.count,2);assert.equal(fixture.manifest.qualityStates['fixture-default'].canInterpret,true);
 assert.equal(fixture.manifest.qualityStates['fixture-default'].canCompare,false);
 assert.deepEqual(fixture.manifest.examples,[]);
 for(const r of rows){assert.equal(r.compare,null);assert.deepEqual(r.related,[]);assert.deepEqual(r.series,B.series[r.key]);}
 assert.equal(JSON.stringify(B),before);
 const legacy=packed({}),legacyRows=[...legacy.files.values()].flatMap(t=>JSON.parse(t).records);
 assert.ok(legacyRows.every(r=>r.compare&&r.related.length===1));
});

test('actual deep-link state loads literal records but refuses comparison replay and multi-series exports',async()=>{
 const fixture=packed(restricted),loader=loadFixture(fixture),ids=['a','b'].map(k=>record(k).id);
 const url=new URL(seriesURL(ids),'https://atlas.example'),records=await Promise.all(url.searchParams.getAll('series').map(id=>loader.load(id)));
 assert.deepEqual(records[0].series.data,[17,null]);assert.equal(records[0].quality.canInterpret,true);
 assert.throws(()=>assertCompatible(records),/comparisons are withheld/);
 assert.throws(()=>selectedCSV(records),/withheld/);assert.throws(()=>selectedJSON(records),/withheld/);
 assert.deepEqual(selectedJSON([records[0]]).series[0].observations.map(d=>d.value),[17,null]);
});

test('loader fails closed for malformed or unexplained published capability',async()=>{
 for(const invalid of [{canCompare:'false'},{canInterpret:false,canCompare:true},{canCompare:false,comparisonReason:'short'},{canCompare:false,comparisonReason:undefined,reason:'short'}]){
  const fixture=packed(restricted);fixture.manifest=structuredClone(fixture.manifest);Object.assign(fixture.manifest.qualityStates['fixture-default'],invalid);
  await assert.rejects(loadFixture(fixture).load(record().id),/quality policy is missing or incompatible/);
 }
});

test('loader rejects a valid hashed shard that advertises comparisons forbidden by its own policy',async()=>{
 for(const change of [r=>r.compare='forged',r=>r.related=[rowAnchor('fixture-policy','b')]]){
  const fixture=packed(restricted),part=fixture.manifest.chunks[0],shard=JSON.parse(fixture.files.get(part.file));change(shard.records[0]);
  const text=JSON.stringify(shard),file=crypto.createHash('sha256').update(text).digest('hex').slice(0,24)+'.json';fixture.files=new Map([[file,text]]);part.file=file;part.bytes=Buffer.byteLength(text);
  await assert.rejects(loadFixture(fixture).load(identity('fixture-policy',shard.records[0].id)),/conflicts with its source-quality policy/);
 }
});

test('search preserves reviewed literal numeric readout and identity while carrying the comparison restriction',async()=>{
 const {core,load}=searchFixture(restricted),S=createSearch(core,load,{expectedQualityVersion:'fixture-version'}),result=await S.series('accounts',{limit:2});
 assert.equal(result.rows.length,2);assert.equal(result.rows[0].quality.canInterpret,true);
 assert.equal(result.rows[0].quality.canCompare,false);assert.equal(canComparePolicy(result.rows[0].quality),false);
 assert.deepEqual(result.rows.map(r=>r.latest).sort((a,b)=>a-b),[9,17]);
 assert.ok(result.rows.every(r=>r.explorerHref.includes('/explore/?series=fixture-policy')));
});

test('homogeneous source review retains rule comparison restrictions and cannot grant metadata permission',()=>{
 const bundle='profiles-mospi-nss78-0-7',source=JSON.parse(fs.readFileSync('data/series/'+bundle+'.json'));
 const attested=sourceQualityRegistry.rules.find(r=>r.id==='reviewed-broadband');
 const reviewed={...source,meta:{...source.meta,semanticReview:{status:'verified',scope:'homogeneous-bundle',evidence:attested.evidence,sourceVersion:attested.review.sourceVersion,reviewer:'Capability regression fixture',rationale:'A fixture reuses the archived primary binding to exercise the existing homogeneous review path only.',canCompare:true,binding:{rawFile:attested.binding.rawFile,rawSha256:attested.binding.rawSha256,bundleSha256:sourceBundleFingerprint(source)}}}};
 const rule={id:'fixture-review',selector:{dossier:'profiles-mospi',unreviewedMapping:true},status:'pending',canInterpret:false,canCompare:false,comparisonReason:reason,reason:'Source mapping needs a scoped source review before numerical interpretation.',evidence:attested.evidence};
 const registry={schemaVersion:1,default:sourceQualityRegistry.default,rules:[rule]};
 validateQualityRegistry(registry);
 const q=getSourceQuality(bundle,reviewed,null,registry);
 assert.equal(q.status,'source-mapping-reviewed');assert.equal(q.canInterpret,true);assert.equal(q.canCompare,false);assert.equal(q.comparisonReason,reason);assert.equal(canComparePolicy(q),false);
 const fallback=getSourceQuality(bundle,reviewed,null,{...registry,rules:[{...rule,comparisonReason:undefined}]});
 assert.equal(fallback.comparisonReason,rule.reason);assert.equal(fallback.canCompare,false);
 for(const invalid of [{...rule,canCompare:'false'},{...rule,canCompare:true},{...rule,canInterpret:true,comparisonReason:'short'}])assert.throws(()=>getSourceQuality(bundle,reviewed,null,{...registry,rules:[invalid]}),/Comparison capability/);
});

test('stale positive review cannot retain a comparison permission after interpretation is withheld',()=>{
 const bundle='profiles-mospi-nss78-0-7',source=JSON.parse(fs.readFileSync('data/series/'+bundle+'.json')),key='all_india__broadband';
 const attested=sourceQualityRegistry.rules.find(r=>r.id==='reviewed-broadband'),rule={...attested,canCompare:true};
 const registry={schemaVersion:1,default:sourceQualityRegistry.default,rules:[rule]};validateQualityRegistry(registry);
 const unchanged=getSourceQuality(bundle,source,{...source.series[key],key},registry);assert.equal(unchanged.canCompare,true);
 const stale=getSourceQuality(bundle,source,{...source.series[key],key,data:[999]},registry);
 assert.equal(stale.canInterpret,false);assert.equal(stale.canCompare,false);assert.equal(canComparePolicy(stale),false);assert.equal(validComparisonPolicy(stale),true);
});

test('default policy retains its explicit restriction and rejects malformed direct registry fallback',()=>{
 const registry={schemaVersion:1,default:{...sourceQualityRegistry.default,canCompare:false,comparisonReason:reason},rules:[]};
 const q=getSourceQuality('fixture',B,B.series.a,registry);assert.equal(q.canInterpret,true);assert.equal(q.canCompare,false);
 assert.throws(()=>getSourceQuality('fixture',B,B.series.a,{...registry,default:{...registry.default,comparisonReason:'short'}}),/Comparison capability/);
});

test('scoped homogeneous restriction cannot be overwritten by another shortcut policy ID in a manifest',()=>{
 const bundle='profiles-mospi-nss78-0-7',source=JSON.parse(fs.readFileSync('data/series/'+bundle+'.json'));
 const attested=sourceQualityRegistry.rules.find(r=>r.id==='reviewed-broadband'),keys=['all_india__broadband','bihar__broadband'];
 const reviewed={...source,meta:{...source.meta,semanticReview:{status:'verified',scope:'homogeneous-bundle',evidence:attested.evidence,sourceVersion:attested.review.sourceVersion,reviewer:'Capability regression fixture',rationale:'Fixture for retaining two independently scoped comparison decisions over the same archived source.',binding:{rawFile:attested.binding.rawFile,rawSha256:attested.binding.rawSha256,bundleSha256:sourceBundleFingerprint(source)}}}};
 const base={status:'pending',canInterpret:false,reason:'Source mapping needs a scoped source review before numerical interpretation.',evidence:attested.evidence};
 const restrictedRule={...base,id:'fixture-restricted-review',selector:{bundle,seriesKeys:[keys[0]],unreviewedMapping:true},canCompare:false,comparisonReason:reason};
 const legacyRule={...base,id:'fixture-legacy-review',selector:{bundle,seriesKeys:[keys[1]],unreviewedMapping:true}};
 const original=sourceQualityRegistry.rules;
 try{
  sourceQualityRegistry.rules=[restrictedRule,legacyRule,...original];validateQualityRegistry(sourceQualityRegistry);
  const files=new Map(),m=packBundle(bundle,reviewed,(f,t)=>files.set(f,t)),rows=[...files.values()].flatMap(t=>JSON.parse(t).records);
  const first=rows.find(r=>r.key===keys[0]),second=rows.find(r=>r.key===keys[1]);
  assert.notEqual(first.quality,second.quality);
  assert.equal(m.qualityStates[first.quality].canCompare,false);assert.equal(m.qualityStates[first.quality].comparisonReason,reason);
  assert.equal(m.qualityStates[second.quality||m.quality].id,'reviewed-mapping','omitted capability retains the legacy shortcut ID');
  assert.equal(m.qualityStates[second.quality||m.quality].canCompare,undefined);
 }finally{sourceQualityRegistry.rules=original;}
});
