// DRAFT ONLY. Proposed scripts/lib/source-unpublished-snapshot.mjs; not installed.
// Contracts must be registered by a source adapter from independently verified archival
// definitions. Never build a contract/proof from canonical series.unavailable metadata.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';
const reviewed=new WeakSet(),verified=new WeakSet(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const realIso=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const stable=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
const reason="The archived source prints '-' for this exact cut. No numerical figure is published for this source cut and survey period.";

export function loadReviewedSnapshotContracts(root,relativeFile,expectedConfigSha256,{allowedFamilies=[]}={}){const file=path.join(root,relativeFile),bytes=fs.readFileSync(file);if(!/^[a-f0-9]{64}$/.test(expectedConfigSha256)||sha(bytes)!==expectedConfigSha256)throw Error('Reviewed source-contract configuration hash mismatch');const config=JSON.parse(bytes);if(config.version!==1||!allowedFamilies.includes(config.family)||!Array.isArray(config.contracts))throw Error('Unsupported/unapproved snapshot source family');return config.contracts.map(item=>{if(item.family!==config.family||!item.rawBodySha256)throw Error('Reviewed source scope/body checksum missing');const contract=Object.freeze({...item,reviewedConfigSha256:expectedConfigSha256});reviewed.add(contract);return contract;});}
export function replaySourceUnpublishedSnapshots(root,contract,resolver={}){
 if(!reviewed.has(contract))throw Error('Pinned reviewed source contract required; canonical flags/fresh hashes are not evidence');
 if(!/^data\/raw\//.test(contract.rawFile)||contract.rawFile.split('/').some(p=>['.','..'].includes(p)))throw Error('Archive path must be inside data/raw');
 if(!/^[a-f0-9]{64}$/.test(contract.rawSha256)||!realIso(contract.period)||!contract.instrument||!contract.context)throw Error('Incomplete independently supplied source contract');
 if(typeof resolver.verifyContext!=='function'||typeof resolver.records!=='function'||typeof resolver.parseValue!=='function')throw Error('Independent context, content locator and numeric parser required');
 const physicalRoot=fs.realpathSync(root),file=path.join(physicalRoot,contract.rawFile);let cursor=physicalRoot;for(const part of contract.rawFile.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Symbolic-link raw source is not eligible');}if(!fs.realpathSync(file).startsWith(path.join(physicalRoot,'data/raw')+path.sep))throw Error('Physical archive escaped raw root');const bytes=fs.readFileSync(file);if(sha(bytes)!==contract.rawSha256)throw Error('Archived source hash mismatch');
 const rawBody=file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes,rawBodySha256=sha(rawBody),raw=JSON.parse(rawBody);if(rawBodySha256!==contract.rawBodySha256)throw Error('Reviewed archived body hash mismatch');if(resolver.verifyContext(raw,{instrument:contract.instrument,period:contract.period,context:contract.context})!==true)throw Error('Source instrument/context/period mismatch');
 const result=new Map(),keys=new Set();for(const cell of resolver.records(raw)){
  if(!cell.key||!cell.cut||!cell.location||!cell.unit||!cell.measureLabel||keys.has(cell.key))throw Error('Source cell identity/location missing or duplicated');keys.add(cell.key);
  if(cell.sourceValue!=='-'){const n=resolver.parseValue(cell.sourceValue);if(n===null||!Number.isFinite(n))throw Error('Unsupported missing source marker; only exact archived dash qualifies');continue;}
  const proof=Object.freeze({kind:'source-unpublished',family:contract.family,reviewedConfigSha256:contract.reviewedConfigSha256,period:contract.period,instrument:contract.instrument,context:contract.context,rawFile:contract.rawFile,rawSha256:contract.rawSha256,rawBodySha256,unit:cell.unit,measureLabel:cell.measureLabel,recordKey:cell.key,sourceValue:'-',cut:Object.freeze({...cell.cut}),location:Object.freeze({...cell.location}),reason});verified.add(proof);result.set(cell.key,proof);
 }
 return result;
}
export function sourceUnpublishedBundleDeclaration(proof){if(!verified.has(proof))throw Error('Independent archived source proof required');return {kind:proof.kind,family:proof.family,reviewedConfigSha256:proof.reviewedConfigSha256,period:proof.period,instrument:proof.instrument,context:proof.context,rawFile:proof.rawFile,rawSha256:proof.rawSha256,rawBodySha256:proof.rawBodySha256,reason:proof.reason};}
export function sourceUnpublishedDeclaration(proof,{shared=false}={}){if(!verified.has(proof))throw Error('Independent archived source proof required');return shared?{kind:proof.kind,sourceRef:'bundle.unpublishedSnapshotSource',recordKey:proof.recordKey,sourceValue:'-'}:{kind:proof.kind,period:proof.period,reason:proof.reason,source:{rawFile:proof.rawFile,rawSha256:proof.rawSha256,rawBodySha256:proof.rawBodySha256,recordKey:proof.recordKey,sourceValue:proof.sourceValue,instrument:proof.instrument,context:proof.context,location:proof.location}};}
export function declaredUnpublishedSnapshot(bundle,series){const d=series.unavailable,p=bundle.meta.unpublishedSnapshotSource;return bundle.meta.frequency==='cross-sectional'&&bundle.dates.length===1&&series.data.length===1&&series.data[0]===null&&series.sourceValue==='-'&&d?.kind==='source-unpublished'&&d.sourceRef==='bundle.unpublishedSnapshotSource'&&p?.kind==='source-unpublished'&&p.period===bundle.dates[0]&&p.instrument===bundle.meta.base&&/^[a-f0-9]{64}$/.test(p.rawSha256??'')&&Boolean(p.rawFile&&p.reason&&d.recordKey);}
export function unpublishedSnapshotProblem(bundle,key,proof){
 if(!proof||!verified.has(proof))return 'no independent archived source proof';
 const s=bundle.series[key];if(bundle.meta.frequency!=='cross-sectional'||bundle.dates.length!==1||!s||s.data.length!==1||s.data[0]!==null)return 'only one-period, one-null cross-sectional snapshots qualify';
 if(s.gaps?.length||s.estimated?.length)return 'unpublished snapshot cannot be a history-gap or an estimate';
 if(bundle.meta.dossier!==proof.family)return 'unsupported source family scope';
 if(bundle.dates[0]!==proof.period||bundle.meta.base!==proof.instrument||key!==proof.recordKey)return 'snapshot period/instrument/identity differs from independently replayed source';
 if(bundle.meta.rawFile!==proof.rawFile||bundle.meta.rawBodySha256!==proof.rawBodySha256)return 'bundle archival path/body hash differs from independent proof';
 if(s.unit!==proof.unit||s.label!==proof.measureLabel||(s.dims??s.dimensions)?.measure!==proof.measureLabel)return 'canonical unit/full measure differs from source attestation';
 if(s.sourceValue!=='-')return 'canonical source marker is not the exact archived dash';
 const cuts=s.dims??s.dimensions;if(!cuts||stable(Object.fromEntries(Object.keys(proof.cut).map(k=>[k,cuts[k]])))!==stable(proof.cut))return 'canonical observed source cut differs';
 const shared=s.unavailable?.sourceRef==='bundle.unpublishedSnapshotSource';if(shared&&JSON.stringify(bundle.meta.unpublishedSnapshotSource)!==JSON.stringify(sourceUnpublishedBundleDeclaration(proof)))return 'bundle source context/hash/period differs from independent proof';
 if(JSON.stringify(s.unavailable)!==JSON.stringify(sourceUnpublishedDeclaration(proof,{shared})))return 'missing or mismatched source-unpublished declaration';
 return null;
}
