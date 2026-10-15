import {assertInvestorPlate,validateInvestorSourcePlate} from './investor-participation.guard.js';
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
export function investorCSV(p){
 assertInvestorPlate(p);const q=p.sourceQuality,source=p.source;
 const head=['date','reference_period','measure','value','unit','bundle','series','observation_kind','reference_basis','source_version','source_record_fingerprint','policy_anchor_sha256','quality_version','source_coverage'];
 const rows=source.dates.map((date,i)=>[date,p.periodLabels[date],p.rows[0].name,source.record.data[i],p.unit,p.bundle,p.key,p.observationKind,q.referenceBasis,q.review.sourceVersion,q.binding.records[p.key],q.binding.rawSha256,p.qualityVersion,'/data/investor-source-coverage.json']);
 return [head,...rows].map(r=>r.map(quote).join(',')).join('\n')+'\n';
}
export function compactInvestorPlates(plates){
 // Full three source records are small; keep their exact metadata and values for browser fingerprint replay.
 return plates.map(p=>{validateInvestorSourcePlate(p);return structuredClone(p);});
}
export function expandInvestorPlate(p){validateInvestorSourcePlate(p);return p;}
