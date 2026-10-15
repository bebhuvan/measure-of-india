import fs from 'node:fs';
import {loadPensionDownloadContract,governedDownloadPlan} from './governed-downloads.js';
// Governed source-specific pension histories. All numeric consumers use named policies.
import {getSourceQuality,sourceQualityRegistry,sourceRecordFingerprint} from '../explore/source-quality.js';
import {rowAnchor} from './everycut.js';

// [bundle, source record label, section, reader title, how to read]. Titles are checked against the
// values in test/pensions-governed-reader.test.mjs; change both together.
const SAVING='Who is saving',MONEY='How much money is in the schemes',LEAVING='Withdrawing and retiring';
export const GUIDE_PLAN=[
 ['pensions-m3','APY',SAVING,'Atal Pension Yojana has far more members than any other scheme','Subscribers at the end of each month. APY is open to people aged 18 to 40 who are not income-tax payers and promises a fixed monthly pension of ₹1,000 to ₹5,000 from age 60, depending on what they pay in.'],
 ['pensions-m3','SG',SAVING,'State government employees are the largest group within the NPS','NPS subscribers employed by state governments, at the end of each month. Most state employees who joined after their state moved to the NPS are enrolled automatically.'],
 ['pensions-m3','CG',SAVING,'Central government membership has grown more slowly than the states’','NPS subscribers employed by the central government. Central employees who joined from 2004 onwards are covered by the NPS rather than the old pension.'],
 ['pensions-m3','CORPORATE',SAVING,'More private-sector employees save through their employer','Employees enrolled through their employer’s corporate NPS, at the end of each month.'],
 ['pensions-a19','TOTAL NUMBER OF CORPORATES REGISTERED IN NPS AS ON THE END OF YEAR',SAVING,'More employers now offer the NPS','Companies and other employers registered to offer the NPS to their staff, at the end of each financial year.'],
 ['pensions-m3','ALL CITIZEN',SAVING,'Individuals now join the NPS on their own in large numbers','Subscribers who opened an NPS account themselves, outside an employer scheme, at the end of each month.'],
 ['pensions-a21-count','NUMBER OF SUBSCRIBERS TIER1 AS END OF MARCH OF THE PARTICULAR YEAR',SAVING,'Opening an account online has become common','Subscribers who opened their main (Tier I) account online through eNPS, at the end of each financial year.'],
 ['pensions-m3','NPS LITE',SAVING,'NPS Lite, the older scheme for informal workers, has shrunk','NPS Lite subscribers at the end of each month. The scheme was wound down after APY began in 2015, so its numbers fall as members leave or move across.'],
 ['pensions-m3','NPS VATSLYA',SAVING,'NPS Vatsalya lets parents save for their children','Accounts opened for children under NPS Vatsalya, which began in September 2024. The account becomes an ordinary NPS account at 18.'],
 ['pensions-m2','SG',MONEY,'State government employees hold the largest pool of pension money','Assets under management at the end of each month, in ₹ crore. The value moves with contributions and with the markets the money is invested in.'],
 ['pensions-m2','CG',MONEY,'Central government accounts hold the second-largest pool','Assets under management for central government subscribers, in ₹ crore.'],
 ['pensions-m2','CORPORATE',MONEY,'Money in employer schemes has grown fast','Assets under management for corporate NPS subscribers, in ₹ crore.'],
 ['pensions-m2','APY',MONEY,'APY money is small for the number of people in it','Assets under management for Atal Pension Yojana, in ₹ crore. Members are low earners and pay in small monthly amounts, so the money builds slowly.'],
 ['pensions-a15','Purchase or construction of a residential house',LEAVING,'Buying or building a house is the main reason to withdraw early','Partial withdrawals processed for buying or building a house, each financial year. Subscribers may withdraw part of their own contributions early for a few reasons the rules allow.'],
 ['pensions-a13','Total',LEAVING,'More people are buying an annuity when they leave','Annuity plans bought at retirement or exit, each financial year. At exit, NPS rules require most subscribers to use part of their savings to buy an annuity, a pension paid by an insurer.'],
 ['pensions-a23','SG',LEAVING,'State government retirements under the NPS are set to rise','An expected schedule, not a count of exits: PFRDA’s estimate of state government subscribers who will reach retirement age in each coming year. The dashed line and hollow dots mark expected values.'],
];
// Figures the guide's prose quotes, each from one reviewed record: [bundle, label, which point].
export const READER_FACTS={
 apy_members:['pensions-m3','APY','last'],sg_members:['pensions-m3','SG','last'],cg_members:['pensions-m3','CG','last'],corporate_members:['pensions-m3','CORPORATE','last'],
 all_citizen_members:['pensions-m3','ALL CITIZEN','last'],lite_peak:['pensions-m3','NPS LITE','peak'],lite_members:['pensions-m3','NPS LITE','last'],
 sg_aum:['pensions-m2','SG','last'],cg_aum:['pensions-m2','CG','last'],apy_aum:['pensions-m2','APY','last'],
 employers:['pensions-a19','TOTAL NUMBER OF CORPORATES REGISTERED IN NPS AS ON THE END OF YEAR','last'],
 housing_withdrawals:['pensions-a15','Purchase or construction of a residential house','last'],withdrawals_processed:['pensions-a14','NO OF PARTIAL WITHDRAWAL REQUESTS PROCESSED','last'],
 annuities:['pensions-a13','Total','last'],
};
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
 // The guide shows one record per reader question (the lens method); every other reviewed record
 // stays in Every Cut and the downloads. A plate is a reviewed record plate with a reader title.
 const record=(bundle,label)=>{const r=plates.filter(p=>p.bundle===bundle&&p.title===label);if(r.length!==1)throw Error(`Pension guide plan needs one reviewed record: ${bundle} ${label}`);return r[0];};
 const guide=GUIDE_PLAN.map(([bundle,label,group,title,explain])=>({...record(bundle,label),title,sourceTitle:label,group,explain}));
 const readerFacts=Object.fromEntries(Object.entries(READER_FACTS).map(([name,[bundle,label,at]])=>{const r=record(bundle,label),f=facts[r.id],i=at==='peak'?f.values.reduce((m,v,j)=>Number.isFinite(v)&&v>(f.values[m]??-Infinity)?j:m,0):at==='first'?f.values.findIndex(Number.isFinite):f.values.findLastIndex(Number.isFinite);return [name,{record:r.id,value:f.values[i],unit:f.unit,date:f.dates[i],period:f.periods[i]}];}));
 return {status:'GOVERNED READER DRAFT; not promoted or browser-certified',plates:guide,records:plates,facts,readerFacts,headline,pending,heldLedger,coverage:{publicationRecords:seen.size+pending.length,reviewedStandaloneRecords:seen.size,reviewedObservedRecords:plates.filter(p=>p.observationKind!=='expected-schedule').length,reviewedExpectedRecords:plates.filter(p=>p.observationKind==='expected-schedule').length,guidePlates:guide.length,pendingRecords:pending.length,sourceOnlyRecords:heldLedger?.heldRecords??0,historicalMultiSeriesDesign:'The earlier 208 candidate panels remain a historical design inventory; this reader makes no completed-panel claim.'}};
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
