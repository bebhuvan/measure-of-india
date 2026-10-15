import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {validatePensionPolicyEvidence} from '../scripts/lib/pensions-source-policy-evidence.mjs';
import {parse} from 'acorn';

test('reviewed pension meaning rejects missing/revised supporting sources, altered scope and catchall bypass before publication',()=>{
 const project=process.cwd(),root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-pension-policy-evidence-'));
 try{
  const installed=JSON.parse(fs.readFileSync('data/source-quality.json')).rules.filter(r=>r.selector?.dossier==='pensions'||r.selector?.bundle?.startsWith('pensions-'));
  const packet={rules:installed.filter(r=>r.canInterpret),pendingRule:installed.find(r=>!r.canInterpret)};
  const registry={schemaVersion:1,rules:[...packet.rules,packet.pendingRule]};
  const contractFile='data/coverage/pensions-source-policy-evidence-contract.json';
  const contract=JSON.parse(fs.readFileSync(contractFile));
  const files=[contractFile,contract.catalogue.file,contract.handbook.file,...new Set(packet.rules.map(r=>r.binding.rawFile)),...contract.expected.dependencies.map(d=>d.file)];
  for(const file of files){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
  const good=validatePensionPolicyEvidence(root,registry);assert.equal(good.records,278);assert.equal(good.rules,18);assert.equal(good.sourceWorkbooks,16);assert.equal(good.expectedActive,true);
  const disjoint=structuredClone(registry);disjoint.rules.push({id:'unrelated-pending',selector:{dossier:'unrelated'},canInterpret:false,status:'source-review-pending',reason:'An unrelated source family remains under its separate scoped review.',evidence:['fixture']});assert.equal(validatePensionPolicyEvidence(root,disjoint).records,278);
  assert.deepEqual(validatePensionPolicyEvidence(root,{rules:[]}),{active:false});
  const validatorSource=fs.readFileSync(path.join(project,'scripts/validate.mjs'),'utf8');
  const statement=parse(validatorSource,{ecmaVersion:'latest',sourceType:'module'}).body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.name==='validatePensionPolicyEvidence');
  assert(statement,'Production validator must invoke supporting-source gate');
  const productionGate=new Function('ROOT','cfg','fs','path','validatePensionPolicyEvidence',validatorSource.slice(statement.start,statement.end));
  fs.writeFileSync(path.join(root,'data/source-quality.json'),JSON.stringify(registry));
  productionGate(root,{dossiers:{}},fs,path,validatePensionPolicyEvidence);
  fs.writeFileSync(path.join(root,'data/source-quality.json'),JSON.stringify({rules:[]}));
  assert.throws(()=>productionGate(root,{dossiers:{pensions:{}}},fs,path,validatePensionPolicyEvidence),/scope\/definitions/);
  fs.writeFileSync(path.join(root,'data/sources.yml'),'dossiers:\n  pensions: {}\n');
  assert.throws(()=>validatePensionPolicyEvidence(root,{rules:[]},{registered:true}),/scope\/definitions/);
  fs.writeFileSync(path.join(root,'data/sources.yml'),'dossiers: {}\n');
  fs.mkdirSync(path.join(root,'data/series'),{recursive:true});fs.writeFileSync(path.join(root,'data/series/pensions-fixture.json'),'{}');
  assert.throws(()=>validatePensionPolicyEvidence(root,{rules:[]}),/scope\/definitions/);
  fs.unlinkSync(path.join(root,'data/series/pensions-fixture.json'));
  for(const file of [contractFile,contract.catalogue.file,contract.handbook.file,packet.rules[0].binding.rawFile]){
    const target=path.join(root,file),bytes=fs.readFileSync(target);
    fs.unlinkSync(target);assert.throws(()=>validatePensionPolicyEvidence(root,registry));
    fs.writeFileSync(target,Buffer.concat([bytes,Buffer.from('changed')]));assert.throws(()=>validatePensionPolicyEvidence(root,registry),/changed/);
    fs.writeFileSync(target,bytes);
  }
  for(const {file}of contract.expected.dependencies){const target=path.join(root,file),bytes=fs.readFileSync(target);fs.appendFileSync(target,' ');assert.throws(()=>validatePensionPolicyEvidence(root,registry),/supporting evidence changed/);fs.writeFileSync(target,bytes);}
  const forged=structuredClone(registry);forged.rules[0].definition='A forged population definition';
  assert.throws(()=>validatePensionPolicyEvidence(root,forged),/scope\/definitions/);
  const omitted=structuredClone(registry);omitted.rules[0].selector.seriesKeys.pop();
  assert.throws(()=>validatePensionPolicyEvidence(root,omitted),/scope\/definitions/);
  const reordered=structuredClone(registry);reordered.rules.unshift(reordered.rules.pop());
  assert.throws(()=>validatePensionPolicyEvidence(root,reordered),/catchall/);
  const latePositive=structuredClone(registry),lastPositive=latePositive.rules.splice(-2,1)[0];latePositive.rules.push(lastPositive);assert.throws(()=>validatePensionPolicyEvidence(root,latePositive),/catchall/);
  const extra=structuredClone(registry);extra.rules.splice(-1,0,{...packet.rules[0],id:'unapproved-new-pension-rule'});
  assert.throws(()=>validatePensionPolicyEvidence(root,extra),/scope\/definitions/);
  const source=path.join(root,contract.catalogue.file),bytes=fs.readFileSync(source);
  const body=JSON.parse(zlib.gunzipSync(bytes));body.body=body.body.replace('(Rs. in crore)','(Rs. in lakh)');
  fs.writeFileSync(source,zlib.gzipSync(JSON.stringify(body)));assert.throws(()=>validatePensionPolicyEvidence(root,registry),/changed/);fs.writeFileSync(source,bytes);
  fs.unlinkSync(source);fs.symlinkSync(path.join(project,contract.catalogue.file),source);
  assert.throws(()=>validatePensionPolicyEvidence(root,registry),/symlink/);fs.unlinkSync(source);fs.writeFileSync(source,bytes);
  // Production consumers import the guarded resolver. Missing support must reject
  // an actual import, not merely a direct helper invocation.
  fs.writeFileSync(path.join(root,'data/source-quality.json'),JSON.stringify({...JSON.parse(fs.readFileSync('data/source-quality.json')),rules:registry.rules}));
  fs.writeFileSync(path.join(root,'data/sources.yml'),'dossiers: {}\n');
  fs.symlinkSync(path.join(project,'src'),path.join(root,'src'),'dir');
  for(const file of ['scripts/lib/investor-source-policy-evidence.mjs','scripts/lib/immutable-source-install.mjs']){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.copyFileSync(path.join(project,file),path.join(root,file));}
  const dependency='scripts/lib/pensions-source-policy-evidence.mjs';fs.mkdirSync(path.join(root,'scripts/lib'),{recursive:true});fs.copyFileSync(path.join(project,dependency),path.join(root,dependency));
  const child="const q=await import(process.argv[1]);console.log(q.qualityRegistryVersion);";
  const url=new URL('../src/explore/source-quality.js',import.meta.url).href;
  let imported=spawnSync(process.execPath,['--input-type=module','-e',child,url],{cwd:root,encoding:'utf8'});assert.equal(imported.status,0,imported.stderr);
  const beforeVersion=imported.stdout.trim();fs.appendFileSync(path.join(root,dependency),'\n// A guard-only implementation revision.\n');
  const revised=spawnSync(process.execPath,['--input-type=module','-e',child,url],{cwd:root,encoding:'utf8'});assert.equal(revised.status,0,revised.stderr);assert.notEqual(revised.stdout.trim(),beforeVersion);
  const contractPath=path.join(root,contractFile),contractBytes=fs.readFileSync(contractPath);fs.appendFileSync(contractPath,' ');
  const contractDrift=spawnSync(process.execPath,['--input-type=module','-e',child,url],{cwd:root,encoding:'utf8'});assert.notEqual(contractDrift.status,0);assert.match(contractDrift.stderr,/supporting evidence changed/);fs.writeFileSync(contractPath,contractBytes);
  fs.unlinkSync(source);imported=spawnSync(process.execPath,['--input-type=module','-e',child,url],{cwd:root,encoding:'utf8'});assert.notEqual(imported.status,0);assert.match(imported.stderr,/ENOENT|Pension/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
