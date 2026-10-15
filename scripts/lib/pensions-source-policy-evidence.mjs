// Family publication gate, shared by validation and every source-quality consumer.
// An exact reviewed rule set cannot survive missing/revised supporting originals.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const CONTRACT='data/coverage/pensions-source-policy-evidence-contract.json';
const CONTRACT_SHA='c9d968004c1492eb8376a0d923082516c63d842813da15f1863e5988af20d079';
const EXPECTED_DEPENDENCIES=["scripts/lib/source-expected-schedule.mjs","scripts/lib/pensions-expected-schedule-factory.mjs","scripts/lib/pensions-source-xlsx.py","data/coverage/pensions.expected-schedule-source-contract.json"];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const isPensionRule=r=>r.selector?.dossier==='pensions'||r.selector?.bundle?.startsWith('pensions-');
function readPinned(root,relative,expected){
  if((!/^data\/(raw|coverage)\/[a-zA-Z0-9_./-]+$/.test(relative)&&!EXPECTED_DEPENDENCIES.includes(relative))||relative.split('/').includes('..'))throw Error('Pension evidence path is invalid');
  const base=fs.realpathSync(root),file=path.join(base,relative);
  let cursor=base;for(const part of relative.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Pension evidence symlink is forbidden');}
  const bytes=fs.readFileSync(file);
  if(sha(bytes)!==expected)throw Error('Pension supporting evidence changed: '+relative);
  return bytes;
}
export function validatePensionPolicyEvidence(root,registry,{registered=false}={}){
  const family=(registry.rules||[]).filter(isPensionRule);
  const seriesDirectory=path.join(root,'data/series');
  const canonical=fs.existsSync(seriesDirectory)&&fs.readdirSync(seriesDirectory).some(file=>/^pensions-.*\.json$/.test(file));
  if(!family.length&&!registered&&!canonical)return {active:false};
  const contract=JSON.parse(readPinned(root,CONTRACT,CONTRACT_SHA));
  const positives=family.filter(r=>r.canInterpret);
  if(contract.schemaVersion!==1||sha(JSON.stringify(positives))!==contract.positiveRulesSha256||
     JSON.stringify(positives.map(r=>r.id))!==JSON.stringify(contract.positiveRuleIds)||
     positives.reduce((n,r)=>n+r.selector.seriesKeys.length,0)!==contract.records)throw Error('Pension source policy scope/definitions differ from reviewed contract');
  const expected=positives.filter(rule=>rule.observationKind==='expected-schedule');
  if(expected.length){
    const e=contract.expected,rule=expected[0];
    if(expected.length!==1||!e||e.ruleId!==rule.id||e.records!==5||rule.selector.bundle!=='pensions-a23'||rule.selector.seriesKeys.length!==5||JSON.stringify(e.dependencies.map(d=>d.file))!==JSON.stringify(EXPECTED_DEPENDENCIES))throw Error('Expected pension policy/dependency scope differs');
    for(const dependency of e.dependencies)readPinned(root,dependency.file,dependency.sha256);
    const descriptor=JSON.parse(readPinned(root,EXPECTED_DEPENDENCIES[3],e.proofDescriptorSha256));
    if(e.proofDescriptorSha256!=='df90f07e566f217d4c8462e24bd238c580dc981e1a571c0397d1a33cfc29c7b0'||descriptor.bundle!=='pensions-a23'||descriptor.kind!=='expected-schedule'||descriptor.unit!=='count'||descriptor.records.length!==5||descriptor.forecastAsOfStatus!=='unknown'||descriptor.forecastAsOfDate!==null||rule.binding.rawFile!==descriptor.rawFile||rule.binding.rawSha256!==descriptor.rawSha256||descriptor.records.some(r=>!rule.selector.seriesKeys.includes(r.key)||rule.binding.records[r.key]!==r.canonicalFingerprint))throw Error('Expected pension original/descriptor/fingerprint scope differs');
  }
  const pending=family.filter(r=>!r.canInterpret);
  if(pending.length!==1||pending[0].id!==contract.pendingRuleId||sha(JSON.stringify(pending[0]))!==contract.pendingRuleSha256||family.at(-1)!==pending[0])throw Error('Pension pending catchall must follow every reviewed pension rule');
  const c=contract.catalogue,archive=readPinned(root,c.file,c.archiveSha256);
  const catalogue=JSON.parse(zlib.gunzipSync(archive,{maxOutputLength:1000000}));
  if(catalogue.source!==c.source||catalogue.sha256!==c.bodySha256||sha(Buffer.from(catalogue.body))!==c.bodySha256||Buffer.byteLength(catalogue.body)!==c.bodyBytes)throw Error('Pension catalogue body/version differs from reviewed source');
  const anchors=catalogue.body.match(/<a\b[^>]*>/gi)||[];
  for(const context of c.unitContexts){
    const matching=anchors.filter(tag=>tag.includes(`aria-label="View report for ${context.table}"`)&&tag.includes(`data-title="${context.title}"`)&&tag.includes(`data-documenturl="${context.url}"`));
    if(matching.length!==1||context.unit!=='inr_crore'||!context.title.includes('(Rs. in crore)'))throw Error('Pension catalogue unit context is not attested: '+context.table);
  }
  const book=contract.handbook,bookBytes=readPinned(root,book.file,book.sha256);
  if(bookBytes.length!==book.bytes||bookBytes.subarray(0,5).toString()!=='%PDF-')throw Error('Pension handbook source/version differs');
  const raw=new Set();for(const rule of positives){
    if(rule.canCompare!==false)throw Error('Pension standalone rule cannot permit comparisons');
    if(!raw.has(rule.binding.rawFile)){readPinned(root,rule.binding.rawFile,rule.binding.rawSha256);raw.add(rule.binding.rawFile);}
  }
  return {active:true,expectedActive:expected.length===1,rules:positives.length,records:contract.records,sourceWorkbooks:raw.size,catalogueBodySha256:c.bodySha256,handbookSha256:book.sha256,contractSha256:CONTRACT_SHA};
}
