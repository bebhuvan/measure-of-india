// Source-governed bundle downloads and exact retained-original access.
import {investorDownloadPlan,loadInvestorDownloadContract} from './investor-governed-downloads.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {getSourceQuality,sourceQualityRegistry,qualityRegistryVersion,sourceRecordFingerprint} from '../explore/source-quality.js';
import {periodLabel} from './everycut.js';
import {assertExpectedPolicy} from '../explore/model.js';
import {replayPensionExpectedProofs} from '../../scripts/lib/pensions-expected-schedule-factory.mjs';
import {expectedScheduleProblem} from '../../scripts/lib/source-expected-schedule.mjs';
import {parseCsv} from '../../scripts/lib/tabular.mjs';
const CONTRACT='data/coverage/pensions-download-source-contract.json';
const PIN='68c8dd5fba5e68e03d1ad0c2b5e9f9129ee8005796fd8e6a9fa03f236f1b886f';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const quote=value=>{const text=String(value??'');return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
const csv=rows=>rows.map(row=>row.map(quote).join(',')).join('\n')+'\n';
const STATUS_HEADERS=['response_kind','bundle','series_key','source_label','review_status','review_reason','quality_registry_version','source_workbook','archival_json','source_coverage'];
const statusHeaders=p=>STATUS_HEADERS.map(h=>p.source.identityKind&&h==='source_workbook'?'source_inventory':h);
const sourceColumns=p=>p.source.identityKind?['_atlas_source_inventory_sha256','_atlas_source_inventory']:['_atlas_source_sha256','_atlas_source_workbook'];
const statusRows=p=>p.records.map(r=>['review-status',p.bundle,r.key,r.label,r.policy.status,r.policy.reason,qualityRegistryVersion,p.source.href,p.archivalJSON,p.sourceCoverage]);
function archivalOverlay(p){
 const policies={};for(const r of p.records)policies[r.policy.id]=r.policy;
 return {schemaVersion:1,downloadKind:'ARCHIVAL_CANONICAL_BUNDLE',validationLabel:'ARCHIVAL / UNVALIDATED: record policies determine interpretation',warning:'Canonical fields are retained exactly. Unreviewed records and units remain unvalidated; use the record policies before interpreting any value. Reviewed source-column exports are separate.',qualityRegistryVersion,coverage:p.coverage,...(p.source.identityKind?{sourceInventory:p.source}:{sourceWorkbook:p.source}),sourceCoverage:p.sourceCoverage,policies,records:Object.fromEntries(p.records.map(r=>[r.key,{policy:r.policy.id,canInterpret:r.policy.canInterpret,canCompare:r.policy.canCompare??null,canonicalUnitStatus:r.unitStatus}]))};
}
function safeRead(root,relative){
 if(!/^data\/(raw|coverage)\/[a-zA-Z0-9_./-]+$/.test(relative)||relative.split('/').includes('..'))throw Error('Governed source path is invalid');
 let cursor=fs.realpathSync(root);for(const part of relative.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Governed source symlink is forbidden');}
 return fs.readFileSync(cursor);
}
export function loadPensionDownloadContract(root=process.cwd()){
 const bytes=safeRead(root,CONTRACT);if(sha(bytes)!==PIN)throw Error('Governed download source contract changed');
 const c=JSON.parse(bytes);if(c.schemaVersion!==1||c.dossier!=='pensions'||c.originals.length!==36||new Set(c.originals.map(s=>s.sha256)).size!==36)throw Error('Governed original inventory differs');
 return c;
}
export function governedDownloadPlan(bundle,B,{required=false,root=process.cwd()}={}){
 const familyPlans={'investor-participation':investorDownloadPlan};
 if(familyPlans[B.meta?.dossier])return familyPlans[B.meta.dossier](bundle,B,{root});
 if(!required&&B.meta?.dossier!=='pensions')return null;
 if(B.meta?.dossier!=='pensions')throw Error('A reviewed required-family download source contract must be registered');
 const c=loadPensionDownloadContract(root),binding=c.bundles[bundle];
 if(!binding||binding.sourceTable!==B.meta.sourceTable||binding.sourceSha256!==B.meta.sourceSha256||'_atlas'in B)throw Error('Governed download source identity differs');
 const keys=Object.keys(B.series),expected=Object.keys(binding.records);
 if(keys.length!==expected.length||expected.some(key=>!B.series[key]))throw Error('Governed download publication record scope differs');
 const records=keys.map(key=>{
  const s=B.series[key];if(sourceRecordFingerprint(B,{...s,key})!==binding.records[key])throw Error('Governed download canonical source changed: '+bundle+':'+key);
  const policy=getSourceQuality(bundle,B,{...s,key});if(policy.id===sourceQualityRegistry.default.id)throw Error('Required download record lacks a named policy');
  return {key,label:s.label||s.name||key,policy,unitStatus:policy.canInterpret?'source-reviewed':'UNVALIDATED'};
 });
 const source=c.originals.find(s=>s.sha256===B.meta.sourceSha256);if(!source)throw Error('Governed download has no retained original');
 return {bundle,contract:c,source,records,eligible:records.filter(r=>r.policy.canInterpret),pending:records.filter(r=>!r.policy.canInterpret),coverage:{recordsTotal:records.length,recordsExported:records.filter(r=>r.policy.canInterpret).length,recordsPending:records.filter(r=>!r.policy.canInterpret).length,recordsSourceOnly:binding.sourceOnlyKeys.length},archivalJSON:'/data/'+bundle+'.json',sourceCoverage:'/data/pensions-source-coverage.json'};
}
export function governedDownloadResponse(bundle,B,format,opts={}){
 const p=governedDownloadPlan(bundle,B,opts);if(!p)return null;
 if(format==='json'){
  return new Response(JSON.stringify({...B,_atlas:archivalOverlay(p)})+'\n',{headers:{'Content-Type':'application/json'}});
 }
 if(format!=='csv')throw Error('Unknown governed download format');
 if(!p.eligible.length){
  // This is a metadata-only status receipt, not a numeric series table. Keeping
  // its CSV MIME avoids relying on static hosting to preserve response headers.
  return new Response(csv([statusHeaders(p),...statusRows(p)]),{headers:{'Content-Type':'text/csv'}});
 }
 const expected=B.meta.observationKind==='expected-schedule';
 if(expected){
  const proofs=replayPensionExpectedProofs(opts.root??process.cwd());
  for(const r of p.eligible){assertExpectedPolicy({key:r.key,meta:B.meta,quality:r.policy});const problem=expectedScheduleProblem(B,r.key,proofs.get(bundle+':'+r.key),bundle);if(problem)throw Error('Expected governed CSV is unproved: '+problem);}
 }
 const keys=p.eligible.map(r=>r.key),metadata=['_atlas_export_kind','_atlas_quality_version',sourceColumns(p)[0],'_atlas_records_total','_atlas_records_exported','_atlas_records_pending','_atlas_records_source_only','_atlas_policy_manifest',sourceColumns(p)[1]];
 const forecast=expected?['observation_kind','forecast_as_of_status','forecast_as_of_date','forecast_method','forecast_window_note',...keys.map(key=>key+'_expected')]:[];
 const head=['date','reference_period',...keys,...forecast,...metadata];
 if(new Set(head.map(h=>h.toLowerCase())).size!==head.length)throw Error('Governed CSV headers collide');
 const rows=B.dates.map((date,i)=>{
  const period=B.meta.periodLabels?.[date]??periodLabel(bundle,B,date);
  const flags=expected?[B.meta.observationKind,B.meta.forecastAsOfStatus,B.meta.forecastAsOfDate??'',B.meta.note||'',B.meta.forecastWindowNote||'',...keys.map(key=>(B.series[key].expected||[]).includes(date))]:[];
  return [date,period,...keys.map(key=>B.series[key].data[i]??''),...flags,'reviewed-source-columns; comparisons not approved',qualityRegistryVersion,p.source.sha256,p.coverage.recordsTotal,p.coverage.recordsExported,p.coverage.recordsPending,p.coverage.recordsSourceOnly,p.archivalJSON,p.source.href];
 });
 return new Response(csv([head,...rows]),{headers:{'Content-Type':'text/csv'}});
}
export function pensionOriginalResponse(hash,root=process.cwd()){
 const c=loadPensionDownloadContract(root),s=/^[a-f0-9]{64}$/.test(hash||'')&&c.originals.find(s=>s.sha256===hash);
 if(!s)return new Response('Unknown pension source workbook',{status:404});
 if(s.archiveFile!==`data/raw/pensions/source-documents/${s.sha256}.xlsx`||s.href!==`/data/pensions-source-${s.sha256}.xlsx`)throw Error('Original source path differs');
 const bytes=safeRead(root,s.archiveFile);if(sha(bytes)!==s.sha256||bytes.length!==s.bytes||bytes.subarray(0,2).toString()!=='PK')throw Error('Retained original source changed');
 return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
}
function sourceCoverageObject(bundles,root=process.cwd()){
 const c=loadPensionDownloadContract(root),plans=[...bundles].map(([bundle,B])=>governedDownloadPlan(bundle,B,{required:true,root})),policies={};
 if(plans.length!==Object.keys(c.bundles).length||Object.keys(c.bundles).some(bundle=>!bundles.has(bundle)))throw Error('Source coverage omitted a publication bundle');
 const records=plans.flatMap(p=>p.records.map(r=>{policies[r.policy.id]=r.policy;return {bundle:p.bundle,key:r.key,label:r.label,policy:r.policy.id,scope:r.policy.canInterpret?'reviewed-source-column':'review-pending',sourceWorkbook:p.source.href};}));
 if(records.length!==c.publicationRecords||records.length+c.sourceOnly.length!==c.fullSourceRecords)throw Error('Full source coverage does not reconcile');
 return {schemaVersion:1,label:'Source inventory and review coverage; no observation values',qualityRegistryVersion,originals:c.originals,publicationRecords:records.length,reviewedRecords:plans.reduce((n,p)=>n+p.eligible.length,0),pendingRecords:plans.reduce((n,p)=>n+p.pending.length,0),sourceOnlyRecords:c.sourceOnly.length,fullSourceRecords:c.fullSourceRecords,metadataSources:c.metadataSources,policies,records,sourceOnly:c.sourceOnly};
}
export function pensionSourceCoverageResponse(bundles,root=process.cwd()){
 return new Response(JSON.stringify(sourceCoverageObject(bundles,root))+'\n',{headers:{'Content-Type':'application/json'}});
}
export function verifyGovernedDownloadArtifacts(root,dist,bundle,B,opts={}){
 const p=governedDownloadPlan(bundle,B,{...opts,root});if(!p)return null;
 const archived=JSON.parse(fs.readFileSync(path.join(dist,'data',bundle+'.json'),'utf8')),{_atlas,...canonical}=archived;
 if(!isDeepStrictEqual(canonical,B)||!isDeepStrictEqual(_atlas,archivalOverlay(p)))throw Error('Archival JSON complete overlay/source/policy/coverage mismatch: '+bundle);
 const rows=parseCsv(fs.readFileSync(path.join(dist,'data',bundle+'.csv'),'utf8'),','),head=rows.shift(),column=name=>head.indexOf(name);
 if(!p.eligible.length){
  if(!isDeepStrictEqual(head,statusHeaders(p))||!isDeepStrictEqual(rows,statusRows(p).map(row=>row.map(value=>String(value??'')))))throw Error('Review receipt complete headers/identity/reason/label/source/version differs');
 }else{
  const forecast=B.meta.observationKind==='expected-schedule'?['observation_kind','forecast_as_of_status','forecast_as_of_date','forecast_method','forecast_window_note',...p.eligible.map(r=>r.key+'_expected')]:[];
  const expectedHeaders=['date','reference_period',...p.eligible.map(r=>r.key),...forecast,'_atlas_export_kind','_atlas_quality_version',sourceColumns(p)[0],'_atlas_records_total','_atlas_records_exported','_atlas_records_pending','_atlas_records_source_only','_atlas_policy_manifest',sourceColumns(p)[1]];
  if(!isDeepStrictEqual(head,expectedHeaders))throw Error('Reviewed CSV complete headers differ');
  if(rows.length!==B.dates.length||p.pending.some(r=>head.includes(r.key))||p.eligible.some(r=>!head.includes(r.key)))throw Error('Reviewed CSV scope differs');
  for(const[i,row]of rows.entries()){
   if(row[column('date')]!==B.dates[i]||row[column('reference_period')]!==(B.meta.periodLabels?.[B.dates[i]]??periodLabel(bundle,B,B.dates[i]))||row[column('_atlas_export_kind')]!=='reviewed-source-columns; comparisons not approved'||row[column('_atlas_quality_version')]!==qualityRegistryVersion||row[column(sourceColumns(p)[0])]!==p.source.sha256||row[column('_atlas_records_total')]!==String(p.records.length)||row[column('_atlas_records_exported')]!==String(p.eligible.length)||row[column('_atlas_records_pending')]!==String(p.pending.length)||row[column('_atlas_records_source_only')]!==String(p.coverage.recordsSourceOnly)||row[column('_atlas_policy_manifest')]!==p.archivalJSON||row[column(sourceColumns(p)[1])]!==p.source.href)throw Error('Reviewed CSV period/version/coverage differs');
   for(const r of p.eligible){const text=row[column(r.key)],value=text===''?null:Number(text);if(value!==B.series[r.key].data[i])throw Error('Reviewed CSV source value differs: '+bundle+':'+r.key);if(B.meta.observationKind==='expected-schedule'&&row[column(r.key+'_expected')]!==String((B.series[r.key].expected||[]).includes(B.dates[i])))throw Error('Expected source flag differs');}
  }
 }
 return {bundle,...p.coverage,original:p.source.href};
}
export function verifyPensionOriginalArtifacts(root,dist){
 const c=loadPensionDownloadContract(root);for(const s of c.originals){const bytes=fs.readFileSync(path.join(dist,s.href.slice(1)));if(sha(bytes)!==s.sha256||bytes.length!==s.bytes||bytes.subarray(0,2).toString()!=='PK')throw Error('Published original differs: '+s.id);}
 const coverage=JSON.parse(fs.readFileSync(path.join(dist,'data/pensions-source-coverage.json'),'utf8'));
 if(coverage.qualityRegistryVersion!==qualityRegistryVersion||coverage.fullSourceRecords!==c.fullSourceRecords||coverage.sourceOnlyRecords!==c.sourceOnlyRecords||coverage.records.length!==c.publicationRecords||coverage.sourceOnly.length!==c.sourceOnlyRecords||!isDeepStrictEqual(coverage.originals,c.originals)||!isDeepStrictEqual(coverage.sourceOnly,c.sourceOnly))throw Error('Published source inventory/held coverage differs');
 const expected=new Map();for(const bundle of Object.keys(c.bundles)){
  const B=JSON.parse(fs.readFileSync(path.join(root,'data/series',bundle+'.json'),'utf8')),p=governedDownloadPlan(bundle,B,{required:true,root});
  for(const r of p.records)expected.set(bundle+':'+r.key,{bundle,key:r.key,label:r.label,policy:r.policy.id,scope:r.policy.canInterpret?'reviewed-source-column':'review-pending',sourceWorkbook:p.source.href});
 }
 const seen=new Set();for(const r of coverage.records){const id=r.bundle+':'+r.key;if(seen.has(id)||!isDeepStrictEqual(r,expected.get(id)))throw Error('Source coverage lost, duplicated or altered a record');seen.add(id);}
 if(seen.size!==expected.size)throw Error('Source coverage omitted a record');
 const bundles=new Map(Object.keys(c.bundles).map(bundle=>[bundle,JSON.parse(fs.readFileSync(path.join(root,'data/series',bundle+'.json'),'utf8'))]));
 if(!isDeepStrictEqual(coverage,sourceCoverageObject(bundles,root)))throw Error('Source coverage complete policy/label/source overlay differs');
 return {originals:c.originals.length,bytes:c.originals.reduce((n,s)=>n+s.bytes,0),fullSourceRecords:c.fullSourceRecords};
}

export function loadGovernedSourceInventory(dossier,root=process.cwd()){
 const families={pensions:loadPensionDownloadContract,'investor-participation':loadInvestorDownloadContract};
 return families[dossier]?.(root)??null;
}
