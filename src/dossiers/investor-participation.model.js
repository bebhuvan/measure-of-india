import {validateInvestorPolicyEvidence} from '../../scripts/lib/investor-source-policy-evidence.mjs';
import {getSourceQuality,sourceQualityRegistry,sourceRecordFingerprint,qualityRegistryVersion} from '../explore/source-quality.js';
import {investorCandidateModel} from './investor-participation.candidate.js';
import {readInvestorBundle,investorBundleNames} from './investor-participation.data.js';
import {compactInvestorPlates} from './investor-participation.export.js';
import {validateInvestorSourcePlate} from './investor-participation.guard.js';
const period=date=>new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
export function investorModel(root=process.cwd(),{quality=getSourceQuality,qualityVersion=qualityRegistryVersion}={}){
 const candidate=investorCandidateModel(root),bundles=new Map(investorBundleNames(root).map(slug=>[slug,readInvestorBundle(root,slug)]));
 validateInvestorPolicyEvidence(process.cwd(),sourceQualityRegistry,{bundles,requireCanonical:true});
 const ledger=[],plates=[],pendingPlates=[],approved=new Map();
 for(const[bundle,B]of bundles)for(const[key,record]of Object.entries(B.series)){
  const q=quality(bundle,B,{...record,key});if(!q?.id||q.id===sourceQualityRegistry.default.id||q.canCompare!==false)throw Error('Investor requires a named reviewed/pending policy with comparisons disabled: '+bundle+':'+key);
  ledger.push({bundle,key,label:record.label??record.name??key,policy:q.id,status:q.status,canInterpret:q.canInterpret,canCompare:false});
  if(!q.canInterpret)continue;if(q.binding?.records?.[key]!==sourceRecordFingerprint(B,{...record,key}))throw Error('Investor reviewed canonical fingerprint changed');
  const c=candidate.plates.find(p=>!p.derived&&p.bundle===bundle&&p.rows.length===1&&p.rows[0].key===key);
  // Candidate plate IDs remain stable for search; any newly approved scope needs its own authored plate.
  if(!c)throw Error('Reviewed investor source record lacks an authored single-record plate: '+bundle+':'+key);
  const last=record.data.findLastIndex(v=>v!==null),date=B.dates[last],name=q.publicTitle;
  const points=B.dates.map((date,i)=>({date,value:record.data[i]}));
  const p={id:c.id,title:name,type:points.filter(p=>p.value!==null).length>1?'history':'snapshot',bundle,key,unit:record.unit??B.meta.unit,date,period:period(date),periodLabels:Object.fromEntries(B.dates.map(date=>[date,period(date)])),rows:[{key,name,value:record.data[last],date,...(points.filter(p=>p.value!==null).length>1?{points}:{})}],derived:null,observationKind:q.observationKind,sourceQuality:q,qualityVersion,source:{bundle,meta:structuredClone(B.meta),dates:[...B.dates],record:structuredClone(record)},sourceUrl:B.meta.sourceUrl,group:'Reviewed source records',sub:q.referenceBasis,explain:q.definition};
  validateInvestorSourcePlate(p);plates.push(p);approved.set(bundle+'|'+key,p);
 }
 const interpretedIds=new Set(plates.map(p=>p.id));for(const p of candidate.plates)if(!interpretedIds.has(p.id))pendingPlates.push({id:p.id,bundle:p.bundle,status:'Source interpretation review pending'});
 const facts=[];for(const[id,ref]of Object.entries(candidate.factSources)){const p=approved.get(ref.bundle+'|'+ref.key);if(p)facts.push({id,plate:p.id,policy:p.sourceQuality.id,label:p.title,value:p.rows[0].value,unit:p.unit,date:p.date});}
 const coverage={total:ledger.length,reviewed:plates.length,pending:ledger.filter(r=>!r.canInterpret).length,candidatePlates:candidate.plates.length,approvedPlates:plates.length,pendingPlates:pendingPlates.length,bundles:bundles.size};
 if(coverage.total!==coverage.reviewed+coverage.pending)throw Error('Investor source-policy inventory does not reconcile');
 return{plates,facts,pendingPlates,ledger,bundles:[...bundles.keys()],coverage,qualityVersion,payload:{schemaVersion:2,qualityVersion,plates:compactInvestorPlates(plates),facts:structuredClone(facts),coverage}};
}
