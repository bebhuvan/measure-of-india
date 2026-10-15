import {investorLineageContract} from '../../scripts/lib/investor-lineage.mjs';
import {loadInvestorEvidence,validateInvestorPolicyEvidence} from '../../scripts/lib/investor-source-policy-evidence.mjs';
import {readSourceFile} from '../../scripts/lib/immutable-source-install.mjs';
import {getSourceQuality,sourceQualityRegistry,sourceRecordFingerprint,qualityRegistryVersion} from '../explore/source-quality.js';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {sourceSha} from '../../scripts/lib/immutable-source-install.mjs';
const CONTRACT='data/coverage/investor-download-source-contract.json';
const PIN='3561d22e76005af5962c8a7d5564230f09c88b762c667278c78d1d01baf88a0e';
export function loadInvestorDownloadContract(root=process.cwd()){
 const c=JSON.parse(readSourceFile(root,CONTRACT,PIN));
 if(c.dossier!=='investor-participation'||c.originals.length!==522||new Set(c.originals.map(s=>s.sha256)).size!==522||c.publicationRecords!==7657||c.sourceOnlyRecords!==0)throw Error('Investor download source scope differs');
 // No speculative public archive URL is allowed while readback is blocked.
 if(!c.archiveAvailable&&c.originals.some(s=>s.href))throw Error('Unverified Investor archive URL');
 return c;
}
export function assertInvestorArchiveReady(root=process.cwd()){
 const c=loadInvestorDownloadContract(root);
 if(!c.archiveAvailable||!c.publicReadbackInventory?.file||!c.publicReadbackInventory?.sha256||c.originals.some(s=>!s.href||s.publicFullByteReadback!==true))throw Error('Investor public original archive has not completed all522 unauthenticated full-byte readbacks');
 const readback=JSON.parse(readSourceFile(root,c.publicReadbackInventory.file,c.publicReadbackInventory.sha256));
 verifyInvestorPublicReadback(c,readback);return c;
}
export function verifyInvestorPublicReadback(c,readback){
 if(readback.repo!==c.archiveDestination||!/^[a-f0-9]{40,64}$/.test(readback.revision)||readback.objects!==522||readback.bytes!==149934485||readback.files?.length!==522||!readback.allPublicFullBytesVerified||new Set(readback.files.map(s=>s.sha256)).size!==522)throw Error('Investor public readback inventory scope differs');
 for(const original of c.originals){const s=readback.files.find(s=>s.sha256===original.sha256),url=`https://huggingface.co/datasets/${c.archiveDestination}/resolve/${readback.revision}/raw/investor-participation/${original.filename}?download=true`;
  if(!s||s.bytes!==original.bytes||s.url!==url||original.href!==url||s.authenticated!==false||s.fullBodyVerified!==true||s.format!==original.format||s.nativeMime!==original.mime||s.contentType?.split(';')[0].trim().toLowerCase()!==original.mime||!s.contentDisposition?.includes(original.filename)||JSON.stringify([...(s.officialUrls||[])].sort())!==JSON.stringify([...original.sourceUrls].sort()))throw Error('Investor public original URL/hash/native MIME/filename/source proof differs');
 }
 return true;
}

export function investorDownloadPlan(bundle,B,{root=process.cwd()}={}){
 const c=loadInvestorDownloadContract(root),{contract,inventory}=loadInvestorEvidence(root);
 const declared=inventory.records.filter(r=>r.bundle===bundle),keys=Object.keys(B.series);
 if(B.meta?.dossier!=='investor-participation'||'_atlas'in B||!declared.length||keys.length!==declared.length||declared.some(r=>!B.series[r.key]))throw Error('Investor download canonical inventory differs');
 const records=declared.map(r=>{const s=B.series[r.key];if(sourceRecordFingerprint(B,{...s,key:r.key})!==r.fingerprint)throw Error('Investor governed source record changed');
  const policy=getSourceQuality(bundle,B,{...s,key:r.key});if(policy.id===sourceQualityRegistry.default.id||policy.id!==r.policy||policy.canInterpret!==r.canInterpret||policy.canCompare!==false)throw Error('Investor governed policy differs');
  return {key:r.key,label:s.label||s.name||r.key,policy,unitStatus:policy.canInterpret?'source-reviewed':'UNVALIDATED'};
 });
 const source={href:c.sourceCoverage,sha256:contract.inventory.sha256,title:'Pinned multiple-original source inventory',identityKind:'source-record-inventory-contract-sha256; not one workbook',linkLabel:'Source inventory',publicOriginalsAvailable:c.archiveAvailable};
 const eligible=records.filter(r=>r.policy.canInterpret),pending=records.filter(r=>!r.policy.canInterpret);
 return {bundle,contract:c,source,records,eligible,pending,coverage:{recordsTotal:records.length,recordsExported:eligible.length,recordsPending:pending.length,recordsSourceOnly:0},archivalJSON:'/data/'+bundle+'.json',sourceCoverage:c.sourceCoverage};
}
export function investorSourceCoverageObject(bundles,root=process.cwd()){
 const c=loadInvestorDownloadContract(root);validateInvestorPolicyEvidence(root,sourceQualityRegistry,{bundles,requireCanonical:true});
 const policies={},records=[];
 for(const [bundle,B]of bundles){const p=investorDownloadPlan(bundle,B,{root});for(const r of p.records){policies[r.policy.id]=r.policy;records.push({bundle,key:r.key,label:r.label,policy:r.policy.id,canInterpret:r.policy.canInterpret,canCompare:false,sourceInventory:c.sourceCoverage});}}
 if(records.length!==7657||records.filter(r=>r.canInterpret).length!==3)throw Error('Investor source coverage lost records');
 return {schemaVersion:1,label:'Source inventory and interpretation coverage; all canonical records retained',inventoryScope:'Selected canonical source records only; older unextracted publications and sheets are accounted in the release catalogue. No full statistical-family completion claim.',familyComplete:false,selectedCanonicalRecordsExcluded:0,qualityRegistryVersion,publicationRecords:7657,reviewedRecords:3,pendingRecords:7654,sourceOnlyRecords:0,fullSourceRecords:7657,originals:c.originals,reviewedSourceCells:loadInvestorEvidence(root).review.cells,policyAnchorNote:"A policy anchor binds the full reviewed record; it is not the original workbook for every observation. reviewedSourceCells identifies the exact original SHA, source header and cell for each reviewed date.",sourceLineage:investorLineageContract(root).files,archiveAvailable:c.archiveAvailable,archiveBlocker:c.archiveBlocker,releaseCatalogue:JSON.parse(zlib.gunzipSync(readSourceFile(root,c.releaseCatalogue.file,c.releaseCatalogue.sha256))),policies,records};
}
export function investorSourceCoverageResponse(bundles,root=process.cwd()){
 return new Response(JSON.stringify(investorSourceCoverageObject(bundles,root))+'\n',{headers:{'Content-Type':'application/json'}});
}
export function verifyInvestorSourceArtifacts(root,dist){
 assertInvestorArchiveReady(root);
 const {inventory}=loadInvestorEvidence(root),bundles=new Map(Object.keys(inventory.bundles).map(b=>[b,JSON.parse(fs.readFileSync(path.join(root,'data/series',b+'.json'),'utf8'))]));
 const expected=investorSourceCoverageObject(bundles,root),actual=JSON.parse(fs.readFileSync(path.join(dist,'data/investor-source-coverage.json'),'utf8'));
 if(!isDeepStrictEqual(actual,expected))throw Error('Investor published source coverage/policy/original metadata differs');
 for(const f of investorLineageContract(root).files){const b=fs.readFileSync(path.join(dist,f.href.slice(1)));if(b.length!==f.bytes||sourceSha(b)!==f.sha256)throw Error('Investor published lineage differs');}
 return {records:7657,reviewed:3,pending:7654,originals:522,lineageFiles:42};
}
