import fs from 'node:fs';
import {loadInvestorEvidence} from '../../../scripts/lib/investor-source-policy-evidence.mjs';
import {investorSourceCoverageResponse} from '../../dossiers/investor-governed-downloads.js';
export function GET(){
 const {inventory}=loadInvestorEvidence();
 const bundles=new Map(Object.keys(inventory.bundles).map(b=>[b,JSON.parse(fs.readFileSync('data/series/'+b+'.json','utf8'))]));
 return investorSourceCoverageResponse(bundles);
}
