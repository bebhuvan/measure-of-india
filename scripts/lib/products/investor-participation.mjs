// Frozen source corpus verification only. A refresh requires its own source review.
import fs from 'node:fs';
import {assertInvestorArchiveReady} from '../../../src/dossiers/investor-governed-downloads.js';
import {validateInvestorPolicyEvidence} from '../investor-source-policy-evidence.mjs';
export async function buildInvestorParticipation(root){
 assertInvestorArchiveReady(root);
 const registry=JSON.parse(fs.readFileSync(root+'/data/source-quality.json','utf8'));
 return {mode:'frozen-reviewed-source-archive',...validateInvestorPolicyEvidence(root,registry,{registered:true,requireCanonical:true})};
}
