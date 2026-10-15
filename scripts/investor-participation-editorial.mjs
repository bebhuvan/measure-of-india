// Deterministic literal source facts. Pending values never enter the prose facts sheet.
import fs from 'node:fs';
import path from 'node:path';
import {investorModel} from '../src/dossiers/investor-participation.model.js';
export function investorEditorial(root=process.cwd()){
 const model=investorModel(root);
 const facts={slug:'investor-participation',qualityVersion:model.qualityVersion,coverage:model.coverage,
  series:Object.fromEntries(model.facts.map(f=>{const p=model.plates.find(p=>p.id===f.plate);return[f.id,{...f,dates:p.source.dates,values:p.source.record.data,definition:p.sourceQuality.definition,referenceBasis:p.sourceQuality.referenceBasis,observationKind:p.observationKind,source:{bundle:p.bundle,key:p.key,fingerprint:p.sourceQuality.binding.records[p.key],originals:p.sourceQuality.supportingOriginals}}];})),
  pending:model.ledger.filter(r=>!r.canInterpret),comparisonsApproved:false,derivedRatesApproved:false};
 return facts;
}
if(process.argv[1]?.endsWith('/investor-participation-editorial.mjs')){
 const output=path.join(process.cwd(),'pipeline/out/facts-investor-participation.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(investorEditorial(),null,1)+'\n');console.log('wrote governed Investor facts');
}
