import {investorCertificate} from './investor-participation.certificate.js';
// Browser-safe source-record guard shared by payload, renderer and every chart download.
const OMIT=new Set(['semanticReview','vintage','vintageStatus','vintageNote','archiveCapturedDate','reportEditionDate','apiRevisionDate','vintageBasis']);
const verified=new WeakSet();
const hex64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function investorFingerprintText(source){return JSON.stringify({meta:Object.fromEntries(Object.entries(source.meta??{}).filter(([k])=>!OMIT.has(k))),dates:source.dates,series:source.record});}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function validateInvestorSourcePlate(p){
 const q=p?.sourceQuality,s=p?.source,key=p?.key;
 const certificate=investorCertificate.records[p?.bundle+'|'+key];if(!certificate||p.qualityVersion!==investorCertificate.qualityVersion||p.unit!==certificate.unit||p.observationKind!==certificate.observationKind||q?.id!==certificate.policyId||q?.binding?.records?.[key]!==certificate.fingerprint)throw Error('Investor source record is outside the compiled review certificate');
 if(!p||!s||!key||q?.canInterpret!==true||q.canCompare!==false||!q.id||q.id==='canonical'||!q.review?.sourceVersion||!hex64(q.binding?.records?.[key])||!hex64(q.binding?.rawSha256)||!q.binding.rawFile||!p.qualityVersion||!q.definition||!q.referenceBasis)throw Error('Investor chart requires one explicitly reviewed and bound source record');
 if(p.derived||!['history','snapshot'].includes(p.type)||!['observed-stock','observed-period-average','observed-activity'].includes(q.observationKind))throw Error('Investor derived/comparative or unknown observation kind is not approved');
 if(!Array.isArray(s.dates)||!s.dates.length||!Array.isArray(s.record?.data)||s.dates.length!==s.record.data.length||p.rows?.length!==1||p.rows[0].key!==key||p.unit!==(s.record.unit??s.meta.unit)||p.bundle!==s.bundle||s.meta.dossier!=='investor-participation')throw Error('Investor plate differs from canonical record identity, unit or scope');
 let prior='';for(let i=0;i<s.dates.length;i++){const date=s.dates[i],value=s.record.data[i];if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(+new Date(date+'T00:00:00Z'))||date<=prior||!(value===null||Number.isFinite(value)))throw Error('Investor canonical dates/values are invalid');prior=date;}
 const last=s.record.data.findLastIndex(v=>v!==null);if(last<0)throw Error('Investor reviewed source has no observations');
 if(!p.periodLabels||Object.keys(p.periodLabels).length!==s.dates.length||Object.keys(p.periodLabels).some(date=>!s.dates.includes(date)))throw Error('Investor period label scope changed');
 if(s.meta.frequency!=='monthly')throw Error('Investor reviewed source period presentation requires an authored calendar');
 for(const date of s.dates){const label=s.meta.periodLabels?.[date]??new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));if(p.periodLabels?.[date]!==label)throw Error('Investor source period label changed');}
 const r=p.rows[0];if(p.sub!==q.referenceBasis||p.explain!==q.definition||p.period!==p.periodLabels[p.date])throw Error('Investor source explanation or period differs from review');
 if(r.value!==s.record.data[last]||r.date!==s.dates[last]||p.date!==s.dates[last]||r.name!==q.publicTitle||p.title!==q.publicTitle||p.observationKind!==q.observationKind)throw Error('Investor readout, title or reference date differs from reviewed source');
 if(p.type==='history'){if(!same(r.points,s.dates.map((date,i)=>({date,value:s.record.data[i]}))))throw Error('Investor plotted points differ from full canonical source record');}
 else if(s.record.data.filter(v=>v!==null).length!==1||r.points!==undefined)throw Error('Investor snapshot would omit source history');
 if(!s.meta.instrument||!s.meta.source||!s.meta.sourceUrl||p.sourceUrl!==s.meta.sourceUrl)throw Error('Investor source provenance is missing or changed');
 return p;
}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export async function verifyInvestorPlate(p,{crypto=globalThis.crypto}={}){
 validateInvestorSourcePlate(p);freeze(p);if(!crypto?.subtle)throw Error('Source verification requires Web Crypto');
 const certificate=investorCertificate.records[p.bundle+'|'+p.key];
 const policyDigest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(p.sourceQuality)));const policyHash=[...new Uint8Array(policyDigest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(policyHash!==certificate.policySha256)throw Error('Investor public policy differs from the compiled review certificate');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(investorFingerprintText(p.source)));const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==certificate.fingerprint)throw Error('Investor canonical source fingerprint differs from reviewed policy');freeze(p);verified.add(p);return p;
}
export function assertInvestorPlate(p){if(!verified.has(p))throw Error('Investor source record has not completed client verification');validateInvestorSourcePlate(p);return p;}
export async function verifyInvestorPayload(payload,opts){
 if(payload?.schemaVersion!==2||payload.qualityVersion!==investorCertificate.qualityVersion||!Array.isArray(payload.plates)||!Array.isArray(payload.facts)||!payload.coverage||payload.coverage.reviewed!==payload.plates.length||payload.coverage.total!==payload.coverage.reviewed+payload.coverage.pending)throw Error('Invalid governed investor payload');
 for(const key of ['total','reviewed','pending','bundles'])if(!Number.isInteger(payload.coverage[key])||payload.coverage[key]!==investorCertificate.coverage[key])throw Error('Invalid investor coverage count');
 const ids=new Set(),records=new Set(),factIds=new Set();for(const p of payload.plates){if(ids.has(p.id)||records.has(p.bundle+'|'+p.key)||p.qualityVersion!==payload.qualityVersion)throw Error('Duplicate or mixed-version investor plate');ids.add(p.id);records.add(p.bundle+'|'+p.key);await verifyInvestorPlate(p,opts);}
 if(payload.facts.length!==Object.keys(investorCertificate.facts).length)throw Error('Investor fact alias coverage differs');
 for(const f of payload.facts){if(!f.id||factIds.has(f.id))throw Error('Duplicate investor fact');factIds.add(f.id);const p=payload.plates.find(p=>p.id===f.plate);if(!p||investorCertificate.facts[f.id]!==p.bundle+'|'+p.key||f.label!==p.title||f.value!==p.rows[0].value||f.unit!==p.unit||f.date!==p.date||f.policy!==p.sourceQuality.id)throw Error('Investor fact is not bound to an approved source plate');}
 return freeze(payload);
}
