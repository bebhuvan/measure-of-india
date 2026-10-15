// Generate only from the independently pinned production source-review contract and exact public policy shape.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.cwd(),here=path.dirname(fileURLToPath(import.meta.url));
const {loadInvestorEvidence,validateInvestorPolicyEvidence,INVESTOR_CONTRACT_SHA}=await import(pathToFileURL(root+'/scripts/lib/investor-source-policy-evidence.mjs'));
const {sourceQualityRegistry,qualityRegistryVersion}=await import(pathToFileURL(root+'/src/explore/source-quality.js'));
validateInvestorPolicyEvidence(root,sourceQualityRegistry);const {contract,policies}=loadInvestorEvidence(root);
const entries=contract.positiveKeys.map(record=>{
 const policy=policies.find(p=>p.id===record.policy);if(!policy||policy.canInterpret!==true||policy.canCompare!==false||policy.selector.bundle!==record.bundle||policy.selector.seriesKeys.length!==1||policy.selector.seriesKeys[0]!==record.key||policy.binding.records[record.key]!==record.fingerprint)throw Error('Compiled investor certificate differs from source contract');
 const publicPolicy=Object.fromEntries(Object.entries(policy).filter(([key])=>key!=='selector'));
 return [record.bundle+'|'+record.key,{fingerprint:record.fingerprint,policyId:record.policy,policySha256:crypto.createHash('sha256').update(JSON.stringify(publicPolicy)).digest('hex'),unit:record.unit,observationKind:record.kind}];
});
if(entries.length!==contract.reviewed||new Set(entries.map(e=>e[0])).size!==contract.reviewed)throw Error('Compiled investor certificate omits/duplicates reviewed scope');
const aliases={'observed-stock':'aum','observed-period-average':'aaum','observed-activity':'net'};
const facts=Object.fromEntries(contract.positiveKeys.map(r=>[aliases[r.kind],r.bundle+'|'+r.key]));if(Object.keys(facts).length!==3||Object.keys(facts).includes('undefined'))throw Error('Investor authored fact alias scope differs');
const source='// Generated from the independently pinned investor evidence contract; regenerate with scripts/investor-client-certificate.mjs.\nexport const investorCertificate=Object.freeze('+JSON.stringify({schemaVersion:1,qualityVersion:qualityRegistryVersion,contractSha256:INVESTOR_CONTRACT_SHA,coverage:{total:contract.records,reviewed:contract.reviewed,pending:contract.pending,bundles:contract.bundles},facts,records:Object.fromEntries(entries)},null,2).replace(/"records": \{/,'"records": Object.freeze({').replace(/\n  \}\n\}$/,'\n  })\n}')+');\nObject.freeze(investorCertificate.coverage);Object.freeze(investorCertificate.facts);for(const value of Object.values(investorCertificate.records))Object.freeze(value);\n';
const productionOutput=path.resolve(here,'../src/dossiers/investor-participation.certificate.js');
const output=process.argv.includes('--check')?productionOutput:(process.env.ATLAS_INVESTOR_CERTIFICATE_OUTPUT??productionOutput);
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==source)throw Error('Compiled investor certificate changed; source review must be replayed and the browser certificate regenerated');console.log('Investor certificate matches independent contract/public policies/version');}
else{fs.writeFileSync(output,source);console.log('Investor certificate generated: '+entries.length+' exact source identities');}
