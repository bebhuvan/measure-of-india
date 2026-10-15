// Source-bound expected schedule proof. Live validator activation requires registered independent replay; flags alone grant nothing.
import {sourceRecordFingerprint} from '../../src/explore/source-quality.js';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const reviewed=new WeakSet(),verified=new WeakSet(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function loadExpectedContract(root,relativeFile,expectedSha256,{allowedFamilies=[]}={}){
 if(!/^data\/coverage\/[a-zA-Z0-9_./-]+\.json$/.test(relativeFile)||relativeFile.split('/').some(p=>p==='.'||p==='..'))throw Error('Expected contract must be a registered data/coverage descriptor');
 const bytes=fs.readFileSync(path.join(root,relativeFile));if(sha(bytes)!==expectedSha256)throw Error('Expected-schedule reviewed contract pin differs');
 const c=JSON.parse(bytes);if(c.version!==1||c.kind!=='expected-schedule'||!allowedFamilies.includes(c.family)||!c.records?.length||!c.unit||!c.ruler||!c.method||!c.title||!['known','unknown'].includes(c.forecastAsOfStatus))throw Error('Unregistered expected-schedule source contract');
 if(c.forecastAsOfStatus==='known'&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.forecastAsOfDate)||!Number.isFinite(Date.parse(c.forecastAsOfDate+'T00:00:00Z'))||new Date(c.forecastAsOfDate+'T00:00:00Z').toISOString().slice(0,10)!==c.forecastAsOfDate))throw Error('Known forecast as-of must be a real source-attested ISO date');
 if(c.forecastAsOfStatus==='unknown'&&c.forecastAsOfDate!==null)throw Error('Unknown forecast as-of cannot carry an inferred date');
 const contract=freeze({...c,reviewedConfigSha256:expectedSha256});reviewed.add(contract);return contract;
}
export function replayExpectedSchedule(root,contract,{parseSource,verifyContext,records}={}){
 if(!reviewed.has(contract))throw Error('Pinned independently reviewed expected contract required');
 if(!/^data\/raw\/[a-zA-Z0-9_./-]+$/.test(contract.rawFile)||contract.rawFile.split('/').some(p=>p==='.'||p==='..'))throw Error('Unsafe expected source archive path');
 const base=fs.realpathSync(root);let cursor=base;for(const part of contract.rawFile.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Expected source archive symlink refused');}
 const file=fs.realpathSync(cursor);if(!file.startsWith(base+path.sep))throw Error('Expected source escaped archive root');const bytes=fs.readFileSync(file);if(sha(bytes)!==contract.rawSha256)throw Error('Expected source body hash differs');
 if(typeof parseSource!=='function'||typeof verifyContext!=='function'||typeof records!=='function')throw Error('Independent expected source replay required');
 const source=parseSource(bytes);if(verifyContext(source,contract)!==true)throw Error('Expected source definition/context differs');
 const result=new Map(),keys=new Set();
 for(const r of records(source,contract)){
  if(!r.key||keys.has(r.key)||r.unit!==contract.unit||r.dates.length!==r.values.length||r.sourceCells.length!==r.values.length||!r.values.some(v=>v!==null))throw Error('Malformed/all-null expected source record');keys.add(r.key);
  if(r.dates.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d||(i&&d<=r.dates[i-1]))||r.values.some(v=>v!==null&&!Number.isFinite(v)))throw Error('Expected source axis or value differs');
  const proof=freeze({...r,bundle:contract.bundle,family:contract.family,sourceTable:contract.sourceTable,sourceUrl:contract.sourceUrl,sourceMethod:contract.method.text,rawSha256:contract.rawSha256,ruler:contract.ruler,forecastAsOfDate:contract.forecastAsOfDate,forecastAsOfStatus:contract.forecastAsOfStatus,reviewedConfigSha256:contract.reviewedConfigSha256});verified.add(proof);result.set(contract.bundle+':'+r.key,proof);
 }
 if(keys.size!==contract.records.length||contract.records.some(r=>!keys.has(r.key)))throw Error('Expected source record scope differs');return result;
}
export function expectedScheduleProblem(B,key,proof,bundle){
 const s=B.series?.[key],kind=B.meta?.observationKind;
 if(kind!==undefined&&kind!=='expected-schedule')return 'Unsupported observationKind';
 if(kind!== 'expected-schedule'&&s?.expected===undefined)return null;
 if(kind!=='expected-schedule'||!s||!verified.has(proof))return 'Unproved expected schedule; canonical flags or copied proof cannot grant this class';
 if(proof.bundle!==bundle||proof.key!==key||B.meta.dossier!==proof.family)return 'Expected source record identity/family drift';
 if(B.meta.sourceTable!==proof.sourceTable||B.meta.sourceUrl!==proof.sourceUrl||B.meta.sourceSha256!==proof.rawSha256||B.meta.note!==proof.sourceMethod||Object.entries(proof.ruler).some(([k,v])=>B.meta[k]!==v)||(s.unit||B.meta.unit)!==proof.unit||s.label!==proof.sourceLabel)return 'Expected source unit, population, method or ruler drift';
 if(B.meta.forecastAsOfDate!==proof.forecastAsOfDate||B.meta.forecastAsOfStatus!==proof.forecastAsOfStatus)return 'Expected forecast as-of drift';
 if(JSON.stringify(B.dates)!==JSON.stringify(proof.dates)||JSON.stringify(s.data)!==JSON.stringify(proof.values)||JSON.stringify(s.sourceCells)!==JSON.stringify(proof.sourceCells))return 'Expected source date/value/coordinate drift';
 if(sourceRecordFingerprint(B,{...s,key})!==proof.canonicalFingerprint)return 'Expected canonical record binding drift';
 const exact=proof.dates.filter((d,i)=>proof.values[i]!==null);
 if(!Array.isArray(s.expected)||JSON.stringify(s.expected)!==JSON.stringify(exact)||s.estimated?.length||s.unavailable)return 'Expected flags must cover every and only published source value, without estimate/unavailable overlap';
 return null;
}
