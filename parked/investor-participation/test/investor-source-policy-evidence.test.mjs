import {loadInvestorDownloadContract,verifyInvestorPublicReadback} from '../src/dossiers/investor-governed-downloads.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadInvestorEvidence,validateInvestorPolicyEvidence,INVESTOR_CONTRACT} from '../scripts/lib/investor-source-policy-evidence.mjs';
import {installImmutableSource,sourceSha} from '../scripts/lib/immutable-source-install.mjs';
import {sourceQualityRegistry,getSourceQuality} from '../src/explore/source-quality.js';
import {UNITS} from '../src/dossiers/everycut.js';
const root=process.cwd(),evidence=loadInvestorEvidence(root);
function isolated(fn){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-investor-source-'));try{
 for(const file of ['data/coverage/investor-lineage-contract.json',INVESTOR_CONTRACT,evidence.contract.policies.file,evidence.contract.inventory.file,evidence.contract.review.file,...evidence.contract.originals.map(o=>o.file)]){const target=path.join(tmp,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
 return fn(tmp);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
test('byte-pinned investor source contract keeps exact interpretation and pending scope',()=>{
 const v=validateInvestorPolicyEvidence(root,sourceQualityRegistry);assert.equal(v.reviewed,3);assert.equal(v.pending,7654);assert.equal(v.comparisons,0);assert.equal(v.originals,2);
 const positives=evidence.policies.filter(r=>r.canInterpret);assert.equal(positives.length,3);assert.ok(positives.every(r=>r.selector.seriesKeys.length===1&&r.canCompare===false));
 for(const p of evidence.policies.filter(r=>!r.canInterpret)){assert.equal(getSourceQuality(p.selector.bundle,{meta:{dossier:'investor-participation'}},{key:'new-unknown-source-record',unit:'count'}).canInterpret,false);}
});
test('a policy interpretation, unit definition or comparison change cannot reuse source evidence',()=>{
 for(const mutate of [r=>r.canCompare=true,r=>r.definition+=' changed',r=>r.selector.seriesKeys.push('unreviewed')]){const registry=structuredClone(sourceQualityRegistry);mutate(registry.rules.find(r=>r.id===evidence.policies[0].id));assert.throws(()=>validateInvestorPolicyEvidence(root,registry),/scope\/definitions/);}
});
test('missing or revised original XLS and a symlink each fail closed',()=>isolated(tmp=>{
 const file=path.join(tmp,evidence.contract.originals[0].file),bytes=fs.readFileSync(file);bytes[50]^=1;fs.writeFileSync(file,bytes);assert.throws(()=>validateInvestorPolicyEvidence(tmp,sourceQualityRegistry),/hash differs/);
 fs.unlinkSync(file);assert.throws(()=>validateInvestorPolicyEvidence(tmp,sourceQualityRegistry));fs.symlinkSync(path.join(root,evidence.contract.originals[0].file),file);assert.throws(()=>validateInvestorPolicyEvidence(tmp,sourceQualityRegistry),/symlink/);
}));
test('altered inventory fingerprint and source-header receipt cannot reuse contract',()=>isolated(tmp=>{
 for(const file of [evidence.contract.inventory.file,evidence.contract.review.file]){const f=path.join(tmp,file),before=fs.readFileSync(f);fs.writeFileSync(f,Buffer.concat([before,Buffer.from(' ')]));assert.throws(()=>validateInvestorPolicyEvidence(tmp,sourceQualityRegistry),/hash differs/);fs.writeFileSync(f,before);}
}));
test('required canonical validation refuses absent and partial admission',()=>{
 assert.throws(()=>validateInvestorPolicyEvidence(root,sourceQualityRegistry,{bundles:new Map(),requireCanonical:true}),/bundle inventory/);
});
test('native scale formatters do not silently multiply or turn numbers into rupees',()=>{
 for(const unit of ['lakh','million']){assert.equal(UNITS[unit].fmt(100),'100.00 '+unit);assert.equal(UNITS[unit].fmt(1.25),'1.25 '+unit);assert.equal(UNITS[unit].fmt(-1.25),'-1.25 '+unit);assert.equal(UNITS[unit].fmt(0),'0.00 '+unit);assert.ok(!UNITS[unit].fmt(100).includes('₹'));}
});
test('immutable source installation verifies incoming bytes, never overwrites and rejects unsafe paths',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-source-install-'));try{const body=Buffer.from('retained source'),sha256=sourceSha(body),rel='data/raw/family/source.bin';
 assert.equal(installImmutableSource(tmp,rel,body,{sha256,size:body.length}).installed,true);assert.equal(installImmutableSource(tmp,rel,body,{sha256,size:body.length}).installed,false);
 const changed=Buffer.from('changed source');assert.throws(()=>installImmutableSource(tmp,rel,changed,{sha256:sourceSha(changed),size:changed.length}),/hash differs/);assert.deepEqual(fs.readFileSync(path.join(tmp,rel)),body);
 assert.throws(()=>installImmutableSource(tmp,'data/raw/../escape',body,{sha256,size:body.length}),/path/);
 assert.throws(()=>installImmutableSource(tmp,'data/raw/other',body,{sha256:'0'.repeat(64),size:body.length}),/Incoming/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('public archive metadata boundary rejects changed object identity, private retrieval and wrong native format',()=>{
 // Synthetic schema fixture only: no claim that these URLs exist or were read publicly.
 const c=structuredClone(loadInvestorDownloadContract()),revision='1'.repeat(40);
 for(const o of c.originals)o.href=`https://huggingface.co/datasets/${c.archiveDestination}/resolve/${revision}/raw/investor-participation/${o.filename}?download=true`;
 const proof={repo:c.archiveDestination,revision,objects:522,bytes:149934485,allPublicFullBytesVerified:true,files:c.originals.map(o=>({sha256:o.sha256,bytes:o.bytes,url:o.href,authenticated:false,fullBodyVerified:true,format:o.format,nativeMime:o.mime,contentType:o.mime,contentDisposition:'attachment; filename="'+o.filename+'"',officialUrls:o.sourceUrls}))};
 assert.equal(verifyInvestorPublicReadback(c,proof),true);
 for(const mutate of [p=>p.files[0].authenticated=true,p=>p.files[0].bytes++,p=>p.files[0].sha256='0'.repeat(64),p=>p.files[0].url+='&token=unapproved',p=>p.files[0].contentType='text/plain',p=>p.files[0].contentDisposition='attachment; filename="wrong.xlsx"',p=>p.files[0].officialUrls=['https://example.invalid/'],p=>p.files.pop()]){const altered=structuredClone(proof);mutate(altered);assert.throws(()=>verifyInvestorPublicReadback(c,altered));}
});
