// One governed source-quality registry shared by explorer packaging and site search.
// Canonical/raw data and stable identities remain unchanged; interpretation can be withheld.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {sourceBundleFingerprint,sourceRecordFingerprint} from './source-fingerprint.js';
import {validateInvestorPolicyEvidence} from '../../scripts/lib/investor-source-policy-evidence.mjs';
import {unitOf} from '../dossiers/units.js';
import {validComparisonPolicy} from './model.js';
import {validatePensionPolicyEvidence} from '../../scripts/lib/pensions-source-policy-evidence.mjs';
const PROJECT_ROOT=process.cwd();
const sourcePath=relative=>path.join(PROJECT_ROOT,relative);
if(!fs.existsSync(sourcePath('data/sources.yml')))throw new Error('Source-quality build helper must run from the Atlas project root.');
const text=fs.readFileSync(sourcePath('data/source-quality.json'),'utf8');
export const sourceQualityRegistry=JSON.parse(text);
const pensionEvidence=validatePensionPolicyEvidence(PROJECT_ROOT,sourceQualityRegistry);
const investorEvidence=validateInvestorPolicyEvidence(PROJECT_ROOT,sourceQualityRegistry);
const qualityHash=crypto.createHash('sha256').update(text).update(fs.readFileSync(sourcePath('src/explore/source-quality.js'))).update(fs.readFileSync(sourcePath('src/explore/model.js'))).update(fs.readFileSync(sourcePath('src/dossiers/units.js'))).update(fs.readFileSync(sourcePath('scripts/lib/pensions-source-policy-evidence.mjs')));
qualityHash.update(fs.readFileSync(sourcePath('src/explore/source-fingerprint.js'))).update(fs.readFileSync(sourcePath('scripts/lib/investor-source-policy-evidence.mjs'))).update(fs.readFileSync(sourcePath('scripts/lib/immutable-source-install.mjs')));
if(investorEvidence.active)qualityHash.update(fs.readFileSync(sourcePath('scripts/lib/investor-lineage.mjs'))).update(fs.readFileSync(sourcePath('data/coverage/investor-lineage-contract.json')));
if(investorEvidence.active)for(const file of ['data/coverage/investor-source-policy-evidence-contract.json','data/coverage/investor-source-policies.json','data/coverage/investor-record-inventory.json','data/coverage/investor-source-review.json'])qualityHash.update(fs.readFileSync(sourcePath(file)));
// Fixed, independently pinned dependency; the gate above rejects missing/drifted
// bytes before these bytes can contribute to a new interpretation certificate.
if(pensionEvidence.active)qualityHash.update(fs.readFileSync(sourcePath('data/coverage/pensions-source-policy-evidence-contract.json')));
if(pensionEvidence.expectedActive)for(const relative of ["scripts/lib/source-expected-schedule.mjs","scripts/lib/pensions-expected-schedule-factory.mjs","scripts/lib/pensions-source-xlsx.py","data/coverage/pensions.expected-schedule-source-contract.json"])qualityHash.update(fs.readFileSync(sourcePath(relative)));
export const qualityRegistryVersion=qualityHash.digest('hex').slice(0,24);
export function validateQualityRegistry(registry){
  if(registry.schemaVersion!==1||!Array.isArray(registry.rules))throw new Error('Unsupported source-quality registry');
  const ids=new Set();for(const q of [registry.default,...registry.rules]){if(!q?.id||ids.has(q.id)||typeof q.canInterpret!=='boolean'||!q.status||q.reason?.length<20)throw new Error('Invalid source-quality policy');ids.add(q.id);if(!validComparisonPolicy(q))throw new Error('Comparison capability or its substantive explanation is invalid');if(q!==registry.default&&!q.selector)throw new Error('Quality rule needs a selector');if(q!==registry.default&&q.canInterpret&&(!q.evidence?.length||!q.review?.sourceVersion||!q.review?.reviewer||q.review?.rationale?.length<30))throw new Error('Interpretation opt-in needs versioned evidence and reviewer rationale');if(q!==registry.default&&q.canInterpret&&(!q.binding||!q.binding.rawFile||!q.binding.rawSha256||(!q.binding.records&&!q.binding.bundleSha256)))throw new Error('Interpretation opt-in needs canonical/raw drift binding');if(!q.canInterpret&&!q.evidence?.length)throw new Error('Withheld interpretation needs evidence');}
  return registry;
}
validateQualityRegistry(sourceQualityRegistry);
export {sourceBundleFingerprint,sourceRecordFingerprint} from './source-fingerprint.js';
const rawBindings=new Map();
function rawBindingValid(binding){
  if(!binding?.rawFile||!binding.rawSha256||!/^data\/raw\/[a-zA-Z0-9_./-]+$/.test(binding.rawFile)||binding.rawFile.includes('..'))return false;
  if(!rawBindings.has(binding.rawFile)){const rawPath=sourcePath(binding.rawFile);rawBindings.set(binding.rawFile,fs.existsSync(rawPath)?crypto.createHash('sha256').update(fs.readFileSync(rawPath)).digest('hex'):null);}
  return rawBindings.get(binding.rawFile)===binding.rawSha256;
}
function checkedComparisonPolicy(policy){
  if(!validComparisonPolicy(policy))throw new Error('Comparison capability or its substantive explanation is invalid');
  return policy;
}
export function getSourceQuality(bundle,B,series=null,registry=sourceQualityRegistry){
  const meta=B?.meta||B||{};
  for(const rule of registry.rules){const s=rule.selector;
    if(s.bundle && s.bundle!==bundle)continue;
    if(s.seriesKeys && (!series||!s.seriesKeys.includes(series.key)))continue;
    if(s.dossier && s.dossier!==meta.dossier)continue;
    if(s.units && (!series||(!s.units.includes(series.unit?.toLowerCase())&&!s.units.includes(unitOf({meta},series)))))continue;
    checkedComparisonPolicy(rule); // Validate the matched rule before any positive-review shortcut.
    if(s.unreviewedMapping && meta.semanticReview?.status==='verified' && meta.semanticReview?.scope==='homogeneous-bundle' && meta.semanticReview?.evidence?.length && meta.semanticReview?.sourceVersion && meta.semanticReview?.reviewer && meta.semanticReview?.rationale?.length>=30 && meta.semanticReview?.binding?.bundleSha256===sourceBundleFingerprint(B) && rawBindingValid(meta.semanticReview.binding))return checkedComparisonPolicy({id:rule.canCompare===undefined?'reviewed-mapping':`reviewed-mapping-${rule.id}`,status:'source-mapping-reviewed',canInterpret:true,reason:meta.semanticReview.rationale,evidence:meta.semanticReview.evidence,review:meta.semanticReview,
      ...(rule.canCompare!==undefined?{canCompare:rule.canCompare}:{}),
      ...(rule.canCompare===false?{comparisonReason:rule.comparisonReason??rule.reason}:{})});
    if(rule.canInterpret && rule.binding && (!series||rule.binding.records?.[series.key]!==sourceRecordFingerprint(B,series)||!rawBindingValid(rule.binding)))return checkedComparisonPolicy({id:rule.id+'-stale',status:'source-review-binding-changed',canInterpret:false,canCompare:false,publicTitle:'Source mapping changed since review',reason:'The source data, schema or instrument no longer matches its versioned review. Numeric interpretation is withheld until the named record is reviewed again.',evidence:rule.evidence});
    const publicPolicy=Object.fromEntries(Object.entries(rule).filter(([key])=>key!=='selector'));
    if(meta.dossier==='profiles-mospi'){publicPolicy.sourceRevisionStatus='unknown';publicPolicy.archiveCapturedDate=meta.archiveCapturedDate||meta.vintage||null;}
    return checkedComparisonPolicy(publicPolicy);
  }
  return checkedComparisonPolicy(registry.default);
}
export function qualityPublicLabel(quality,series,bundle){
  if(quality.canInterpret&&!quality.publicTitle)return series.label||series.name||bundle;
  const geo=series.geo||series.state;
  return (quality.publicTitle||'Source record under review')+(geo?`: ${geo}`:'');
}
