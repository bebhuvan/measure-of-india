import fs from 'node:fs';
import {loadPensionDownloadContract,governedDownloadPlan} from './governed-downloads.js';
// Governed source-specific pension histories. All numeric consumers use named policies.
import {getSourceQuality,sourceQualityRegistry,sourceRecordFingerprint} from '../explore/source-quality.js';
import {rowAnchor} from './everycut.js';
export function governedPensionModel(bundles,{heldLedger}={}){
 const plates=[],facts={},pending=[],seen=new Set();
 for(const[bundle,B]of bundles){
  if(B.meta.dossier!=='pensions')throw Error('Pension reader received another source family');
  for(const[key,s]of Object.entries(B.series)){
   const identity=bundle+':'+key,q=getSourceQuality(bundle,B,{...s,key});
   if(q.id===sourceQualityRegistry.default.id)throw Error('Pension record lacks an explicit source policy');
   if(q.status==='source-review-binding-changed')throw Error('Pension reviewed source changed: '+identity);
   if(!q.canInterpret){pending.push({bundle,key,label:s.label,sourceTable:B.meta.sourceTable,sourceUrl:B.meta.sourceUrl,policy:q.id,status:q.status,reason:q.reason});continue;}
   if(q.canCompare!==false||q.binding.rawSha256!==B.meta.sourceSha256||q.binding.records[key]!==sourceRecordFingerprint(B,{...s,key}))throw Error('Pension standalone source binding or comparison scope differs');
   if(!['observed-stock','observed-activity','expected-schedule'].includes(q.observationKind))throw Error('Pension observation class requires its separately reviewed reader');
   const last=s.data.findLastIndex(Number.isFinite);if(last<0)throw Error('Pension positive record has no source observation');
   const periods=B.dates.map(date=>{const label=B.meta.periodLabels?.[date];if(!label)throw Error('Pension source period label is missing');return label;});
   const sourceQuality={id:q.id,status:q.status,canInterpret:true,canCompare:false,comparisonReason:q.comparisonReason,observationKind:q.observationKind,definition:q.definition||q.reason,referencePeriod:q.referencePeriod,sourceLimits:q.sourceLimits,review:q.review,binding:{rawFile:q.binding.rawFile,rawSha256:q.binding.rawSha256,records:{[key]:q.binding.records[key]}}};
   const id='pensions-source-'+rowAnchor(bundle,key),plate={id,bundle,sourceId:B.meta.sourceTable,title:s.label,unit:s.unit||B.meta.unit,kind:'history',historyBasis:'source-period',meta:structuredClone(B.meta),sourceQuality,definition:sourceQuality.definition,referenceBasis:q.referencePeriod,sourceNote:B.meta.note||'',sourceCategoryRole:q.sourceCategoryRoles?.[key]||'exact-source-labelled-record',sourceUrl:B.meta.sourceUrl,period:periods[last],periods,dates:[...B.dates],rows:[{name:s.label,key,date:B.dates[last],value:s.data[last],unit:s.unit||B.meta.unit}],lines:[{name:s.label,key,points:B.dates.map((date,i)=>({date,value:s.data[i]}))}]};
   // Canonical metadata is retained unchanged. The observed measure class is the
   // named policy's class; it is not a new canonical/forecast marker.
   if(q.observationKind==='expected-schedule'){if(B.meta.observationKind!=='expected-schedule')throw Error('Expected source class is absent from canonical metadata');plate.observationKind='expected-schedule';}
   plates.push(plate);seen.add(identity);
   facts[id]={bundle,key,unit:plate.unit,observationKind:q.observationKind,definition:plate.definition,referenceBasis:q.referencePeriod,sourceCategoryRole:plate.sourceCategoryRole,dates:[...B.dates],periods,values:[...s.data],sourceCells:[...s.sourceCells],lastSourceDate:B.dates[last],lastSourcePeriod:periods[last],lastSourceValue:s.data[last],sourceRecordFingerprint:q.binding.records[key]};
  }
 }
 const required=sourceQualityRegistry.rules.filter(r=>r.canInterpret&&r.selector?.bundle?.startsWith('pensions-')).flatMap(r=>r.selector.seriesKeys.map(key=>r.selector.bundle+':'+key));
 if(required.length!==seen.size||required.some(id=>!seen.has(id)))throw Error('Pension reader omitted a reviewed source record');
 const APY=plates.filter(p=>p.bundle==='pensions-m3'&&p.title==='APY');
 if(APY.length!==1||APY[0].sourceQuality.observationKind!=='observed-stock')throw Error('Pension draft headline source is not uniquely reviewed stock');
 const headline=structuredClone(facts[APY[0].id]);
 return {status:'GOVERNED READER DRAFT; not promoted or browser-certified',plates,facts,headline,pending,heldLedger,coverage:{publicationRecords:seen.size+pending.length,reviewedStandaloneRecords:seen.size,reviewedObservedRecords:plates.filter(p=>p.observationKind!=='expected-schedule').length,reviewedExpectedRecords:plates.filter(p=>p.observationKind==='expected-schedule').length,pendingRecords:pending.length,sourceOnlyRecords:heldLedger?.heldRecords??0,historicalMultiSeriesDesign:'The earlier 208 candidate panels remain a historical design inventory; this reader makes no completed-panel claim.'}};
}

export function pensionsModel({bundles,root=process.cwd()}={}){
 const c=loadPensionDownloadContract(root);
 const inputs=bundles??new Map(Object.keys(c.bundles).map(b=>[b,JSON.parse(fs.readFileSync(root+'/data/series/'+b+'.json','utf8'))]));
 if(inputs.size!==Object.keys(c.bundles).length||Object.keys(c.bundles).some(b=>!inputs.has(b)))throw Error('Pension publication bundle inventory differs');
 for(const[b,B]of inputs)governedDownloadPlan(b,B,{required:true,root});
 const heldLedger={heldRecords:c.sourceOnlyRecords,records:c.sourceOnly};
 const model=governedPensionModel(inputs,{heldLedger});
 model.manifest={bundles:[...inputs].map(([slug,B])=>({slug,sourceTable:B.meta.sourceTable,series:Object.keys(B.series).length})),originals:c.originals,fullSourceRecords:c.fullSourceRecords,sourceOnlyRecords:c.sourceOnlyRecords};
 return model;
}
