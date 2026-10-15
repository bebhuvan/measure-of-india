// Independent byte-pinned publication scope. No acquisition, promotion or source mutation.
import fs from 'node:fs';
import path from 'node:path';
import {readSourceFile,sourceSha,sourceFileStamp} from './immutable-source-install.mjs';
import {sourceRecordFingerprint} from '../../src/explore/source-fingerprint.js';
import {investorLineageContract} from './investor-lineage.mjs';
export const INVESTOR_CONTRACT='data/coverage/investor-source-policy-evidence-contract.json';
export const INVESTOR_CONTRACT_SHA='3334756091feaee0404f6c32da0d2a2e316b4ea18f21e2824c3d65aa5a385a1f';
const familyRule=r=>r.selector?.dossier==='investor-participation'||r.selector?.bundle?.startsWith('investor-');
const evidenceCache=new Map();
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
export function loadInvestorEvidence(root=process.cwd()){
 root=fs.realpathSync(root);const old=evidenceCache.get(root);
 if(old&&old.files.every((file,i)=>sourceFileStamp(root,file)===old.stamps[i]))return old.value;
 const contract=JSON.parse(readSourceFile(root,INVESTOR_CONTRACT,INVESTOR_CONTRACT_SHA));
 const policies=JSON.parse(readSourceFile(root,contract.policies.file,contract.policies.sha256)).rules;
 const inventory=JSON.parse(readSourceFile(root,contract.inventory.file,contract.inventory.sha256));
 const review=JSON.parse(readSourceFile(root,contract.review.file,contract.review.sha256));
 const files=[INVESTOR_CONTRACT,contract.policies.file,contract.inventory.file,contract.review.file];
 const value=freeze({contract,policies,inventory,review});evidenceCache.set(root,{files,stamps:files.map(file=>sourceFileStamp(root,file)),value});return value;
}
export function validateInvestorPolicyEvidence(root,registry,{registered=false,bundles,requireCanonical=false}={}){
 const family=(registry.rules||[]).filter(familyRule),directory=path.join(root,'data/series');
 const names=fs.existsSync(directory)?fs.readdirSync(directory).filter(f=>/^investor-.*\.json$/.test(f)).map(f=>f.slice(0,-5)).sort():[];
 if(!family.length&&!registered&&!names.length&&!bundles)return {active:false};
 const {contract:c,policies,inventory:i,review}=loadInvestorEvidence(root);
 const lineage=investorLineageContract(root);
 if(c.dossier!=='investor-participation'||c.records!==7657||c.reviewed!==3||c.pending!==7654||c.bundles!==42||
    sourceSha(JSON.stringify(family))!==c.policies.rulesSha256||JSON.stringify(family)!==JSON.stringify(policies))throw Error('Investor policy scope/definitions differ from pinned source review');
 if(family.length!==45||family.filter(r=>r.canInterpret).length!==3||family.some(r=>r.canCompare!==false||!r.selector?.bundle||r.selector.bundle.includes('*'))||family.slice(0,3).some(r=>!r.canInterpret)||family.slice(3).some(r=>r.canInterpret||r.selector.seriesKeys||!r.publicTitle))throw Error('Investor positive/pending/comparison coverage differs');
 const positives=family.slice(0,3),pending=family.slice(3),expectedBundles=[...new Set(i.records.map(r=>r.bundle))].sort();
 if(JSON.stringify(lineage.files.map(f=>f.bundle).sort())!==JSON.stringify(expectedBundles))throw Error('Investor lineage bundle coverage differs');
 if(i.records.length!==c.records||expectedBundles.length!==42||new Set(i.records.map(r=>r.bundle+':'+r.key)).size!==7657||new Set(pending.map(r=>r.selector.bundle)).size!==42||pending.some(r=>!expectedBundles.includes(r.selector.bundle))||i.records.filter(r=>r.canInterpret).length!==3||i.records.some(r=>r.canCompare!==false))throw Error('Investor full inventory or pending partition differs');
 for(const o of c.originals){const bytes=readSourceFile(root,o.file,o.sha256);if(bytes.length!==o.bytes||bytes.subarray(0,8).toString('hex')!=='d0cf11e0a1b11ae1')throw Error('Investor original native XLS evidence differs');}
 if(c.originals.length!==2||review.cells.length!==6||review.assertionsPassed!==6)throw Error('Investor source-cell scope differs');
 for(const p of positives){if(p.selector.seriesKeys.length!==1||!c.positiveKeys.some(k=>k.policy===p.id&&k.key===p.selector.seriesKeys[0]&&k.bundle===p.selector.bundle&&k.fingerprint===p.binding.records[k.key]&&k.kind===p.observationKind))throw Error('Investor reviewed key/kind/binding differs');readSourceFile(root,p.binding.rawFile,p.binding.rawSha256);}
 let input=bundles;
 if(!input&&names.length)input=new Map(names.map(b=>[b,JSON.parse(fs.readFileSync(path.join(directory,b+'.json'),'utf8'))]));
 if(requireCanonical&&!input)throw Error('Investor canonical admission not installed');
 if(input){if(input.size!==42||expectedBundles.some(b=>!input.has(b)))throw Error('Investor canonical bundle inventory differs');
  let count=0;
  for(const [bundle,B]of input){const records=i.records.filter(r=>r.bundle===bundle);if(B.meta.dossier!=='investor-participation'||Object.keys(B.series).length!==records.length)throw Error('Investor canonical source scope differs');
   for(const r of records){const series=B.series[r.key];if(!series||sourceRecordFingerprint(B,{...series,key:r.key})!==r.fingerprint)throw Error('Investor source record changed: '+bundle+':'+r.key);count++;}
  }
  if(count!==7657)throw Error('Investor record census differs');
  for(const cell of review.cells){const B=input.get('investor-monthly-categories-2026-inr-crore'),s=B.series[cell.key],idx=B.dates.indexOf(cell.date);if(idx<0||s.unit!=='inr_crore'||s.data[idx]!==cell.value||cell.sourceRowLabel!=='Grand Total'||!cell.sourceHeader.includes('(INR in crore)')||!c.originals.some(o=>o.sha256===cell.sha256))throw Error('Investor literal source cell/unit/reference mismatch');}
 }
 return {active:true,contractSha256:INVESTOR_CONTRACT_SHA,records:7657,reviewed:3,pending:7654,comparisons:0,canonicalPresent:Boolean(input),originals:2};
}
