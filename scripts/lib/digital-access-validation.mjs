import {unpublishedSnapshotProblem} from './source-unpublished-snapshot.mjs';
import crypto from 'node:crypto';
import {digitalCuts} from './digital-access-cuts.mjs';
import {buildDigitalReport,digitalCell,digitalKey} from './products/digital-access.mjs';
import {parseNumber} from './tabular.mjs';
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
import {readRawFile} from './util.mjs';
export const readDigitalValidationFile=readRawFile;
const read=readRawFile;
export function verifyDigitalCells(rows,bundle){
 const dims=bundle.meta.dimensions,errors=[],entries=Object.entries(bundle.series),stable=d=>JSON.stringify(Object.entries(d).sort(([a],[b])=>a.localeCompare(b))),index=new Map(entries.map(([key,s])=>[stable(digitalCuts(bundle,s)),{key,s}]));
 if(entries.length!==rows.length||index.size!==rows.length)errors.push('Raw/canonical count mismatch');
 for(const row of rows){const [expectedKey,expected]=digitalCell(row,dims),expectedCut=Object.fromEntries(dims.map(d=>[d,row[d]??null])),found=index.get(stable(expectedCut));if(!found){errors.push('Source cell changed');continue;}const {key,s}=found;
  if(s.sourceValue!==row.value||s.data.length!==1||s.data[0]!==expected.data[0])errors.push('Source cell changed');
  if(key!==expectedKey||key!==digitalKey(digitalCuts(bundle,s)))errors.push('Source series identity changed');
  if(s.unit!=='pct'||s.label!==expected.label||s.name!==expected.name||stable(s.dims??{})!==stable(expected.dims))errors.push('Source unit/label/measure/cut changed');
 }
 return errors;
}
export function validateDigitalAccess(root,{rawRoot=path.join(root,'data/raw/digital-access'),legacyRoot=root,reportCellsFile=path.join(rawRoot,'report-cells.json'),reportPins,verifiedSourceSnapshots=new Map()}={}){
 const cuts=new WeakMap(),cut=s=>cuts.get(s);
 const manifest=read(path.join(root,'data/coverage/digital-access.manifest.json')),errors=[],warnings=[],stats={sourceCells:0,supportCells:0,identities:0,nulls:0};
 const loaded=new Map();for(const item of [...manifest.bundles,...(manifest.supportTables??[])]){const b=read(path.join(root,'data/series/'+item.slug+'.json'));loaded.set(item.slug,b);if(b.dates.length!==1||Object.values(b.series).some(s=>s.data.length!==1))errors.push('Snapshot shape '+item.slug);if(b.meta.vintage===null&&b.meta.vintageStatus!=='unknown')errors.push('Undeclared unknown vintage');for(const s of Object.values(b.series)){cuts.set(s,digitalCuts(b,s));if(s.data[0]===null)stats.nulls++;else if(!Number.isFinite(s.data[0]))errors.push('Nonfinite value');}if(item.slug.includes('rse')||item.slug.includes('table-'))stats.supportCells+=Object.keys(b.series).length;}
 for(const item of manifest.bundles){const file=item.instrument==='cmst2025'?path.join(rawRoot,'indicator-'+item.code+'.json'):path.join(legacyRoot,`data/raw/profiles-mospi/${item.instrument==='nss78'?'nss78-0':'nss79-1'}-${item.code}.json`);const raw=read(file),b=loaded.get(item.slug),dims=b.meta.dimensions;const index=new Map(Object.values(b.series).map(s=>[JSON.stringify(dims.map(d=>cut(s)[d])),s]));errors.push(...verifyDigitalCells(raw.rows,b).map(e=>e+' '+item.slug));stats.sourceCells+=raw.rows.length;}
 for(const [code,dimension]of [[2,'mobile_type'],[4,'mobile_type'],[7,'internet_access'],[8,'type_of_device_and_network'],[16,'mode_of_transaction'],[19,'major_reason'],[20,'type_of_goods']]){
 const b=loaded.get('digital-access-cmst2025-'+code),groups=new Map();for(const s of Object.values(b.series)){if(cut(s)[dimension]===null||cut(s)[dimension]==='All')continue;const key=JSON.stringify(Object.entries(cut(s)).filter(([k])=>k!==dimension));const group=groups.get(key)??[];group.push(s);groups.set(key,group);}
 for(const [key,group]of groups){if(group.some(s=>s.data[0]===null))continue;stats.identities++;const total=group.reduce((n,s)=>n+s.data[0],0);if(Math.abs(total-100)>0.21)warnings.push({code,key,total,reason:'Published conditional components do not sum to100 within rounding allowance; exact source values retained.'});}
 }
 const network=loaded.get('digital-access-cmst2025-18'),networkGroups=new Map();for(const s of Object.values(network.series).filter(s=>cut(s).type_of_network!==null)){const key=JSON.stringify([cut(s).state,cut(s).sector]);const group=networkGroups.get(key)??{};group[cut(s).type_of_network]=s.data[0];networkGroups.set(key,group);}for(const [key,g]of networkGroups){const fixed=g['Fixed/ WiFi network'],mobile=g['Mobile network'],both=g['Both fixed/ WiFi and mobile network'];if([fixed,mobile,both].some(v=>v===null))continue;stats.identities++;if(both>Math.min(fixed,mobile)+0.11||fixed+mobile-both>100.11)errors.push('Overlapping network inclusion bound '+key);}
 const yes=loaded.get('digital-access-cmst2025-18'),no=loaded.get('digital-access-cmst2025-19');for(const s of Object.values(yes.series).filter(s=>cut(s).type_of_network===null)){const match=Object.values(no.series).find(q=>cut(q).major_reason===null&&cut(q).state===cut(s).state&&cut(q).sector===cut(s).sector);if(s.data[0]!==null&&match?.data[0]!==null){stats.identities++;if(Math.abs(s.data[0]+match.data[0]-100)>0.11)errors.push('Household access complement '+JSON.stringify(cut(s)));}}
for(const {slug,bundle}of buildDigitalReport(root,{cellsFile:reportCellsFile,write:false})){errors.push(...verifyReportSupportSeries(bundle.series,loaded.get(slug),slug,verifiedSourceSnapshots));}
 const approvedFile=path.join(root,'data/coverage/digital-access.source-quality.json');const approved=fs.existsSync(approvedFile)?read(approvedFile).warnings:[];for(const w of warnings)if(!approved.some(a=>a.code===w.code&&a.key===w.key&&Math.abs(a.total-w.total)<1e-8&&a.status==='source-confirmed'))errors.push('Unreviewed distribution discrepancy '+w.code+' '+w.key);
 const report=validateCmstReportArchive(root,{rawRoot,expectedPins:reportPins});errors.push(...report.errors);stats.cmstReport=report.stats;
 return {errors,warnings,stats};
}

export function reconcileCmstCells(apiByCode,reportCells,{expectedCodes=Array.from({length:20},(_,i)=>i+1),expectedCells=28632}={}){
 const errors=[],stats={apiCells:0,reportCells:reportCells.length,matched:0,missingApi:0,extraApi:0,duplicateApi:0,duplicateReport:0,valueMismatches:0};
 if(reportCells.length!==expectedCells)errors.push('CMST report cell count differs from pinned source contract');
 const stable=d=>JSON.stringify(Object.entries(d).sort(([a],[b])=>a.localeCompare(b)));
 for(const code of expectedCodes){const expected=reportCells.filter(r=>r.code===code),api=apiByCode.get(code)??[];stats.apiCells+=api.length;if(!expected.length){errors.push('Missing report indicator '+code);continue;}const dims=Object.keys(expected[0].dims).sort(),allowed=new Set(['indicator','value',...dims,...([6,18,19,20].includes(code)?['subindicator']:[])]),reportMap=new Map(),apiMap=new Map();for(const r of expected){const k=stable(r.dims);if(reportMap.has(k)){stats.duplicateReport++;errors.push('Duplicate report cut '+code+' '+k);}reportMap.set(k,r);}for(const r of api){if(Object.keys(r).some(k=>!allowed.has(k)))errors.push('Unreviewed API dimension '+code);const key=stable(Object.fromEntries(dims.map(k=>[k,r[k]??null])));if(apiMap.has(key)){stats.duplicateApi++;errors.push('Duplicate API report cut '+code+' '+key);}apiMap.set(key,r);}for(const [key,r]of reportMap){const a=apiMap.get(key);if(!a){stats.missingApi++;errors.push('Report cell missing from API '+code+' '+key);continue;}const av=parseNumber(a.value),rv=parseNumber(r.sourceValue);if(rv!==r.value||av!==rv||(av===null&&(a.value!=='-'||r.sourceValue!=='-'))){stats.valueMismatches++;errors.push('API/report value mismatch '+code+' '+key);}else stats.matched++;}for(const key of apiMap.keys())if(!reportMap.has(key)){stats.extraApi++;errors.push('API cell absent from report '+code+' '+key);}}
 for(const r of reportCells)if(!expectedCodes.includes(r.code))errors.push('Unexpected report indicator '+r.code);
 for(const code of apiByCode.keys())if(!expectedCodes.includes(code))errors.push('Unexpected API indicator '+code);
 return {errors,stats};
}
export function validateCmstReportArchive(root,{rawRoot=path.join(root,'data/raw/digital-access'),expectedPins}={}){
 if(!expectedPins)return {errors:['Reviewed report-archive pins required from verified source configuration; archive self-declarations are not approval'],stats:null};
 const file=path.join(rawRoot,'report-estimate-cells.json.gz');if(!fs.existsSync(file))return {errors:['Full CMST report-estimate archive missing; external receipt is not a production gate'],stats:null};const archive=read(file),receipt=read(path.join(rawRoot,'cmst-report.pdf.provenance.json')),document=fs.readFileSync(path.join(rawRoot,'cmst-report.pdf')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),errors=[];
 if(sha(fs.readFileSync(file))!==expectedPins.storedArchiveSha256||archive.sourceArtifactSha256!==expectedPins.sourceArtifactSha256||archive.extractionBodySha256!==expectedPins.extractionBodySha256||archive.sourceDocumentSha256!==expectedPins.sourceDocumentSha256)errors.push('Reviewed report archive/source/extraction pin mismatch');
 if(['reportNumber','surveyCode','referenceStart','referenceEnd','reportEditionDate'].some(k=>archive[k]!==expectedPins[k]))errors.push('Reviewed report reference-window pin mismatch');
 if(sha(document)!==receipt.sha256||archive.sourceDocumentSha256!==receipt.sha256)errors.push('CMST report source-document hash mismatch');
 if(archive.instrument!=='cmst2025'||archive.surveyCode!==1||archive.reportNumber!==593||archive.referenceStart!=='2025-01-01'||archive.referenceEnd!=='2025-03-31'||archive.reportEditionDate!=='2025-05-29')errors.push('CMST report instrument/reference contract mismatch');
 if(!Array.isArray(archive.cells)||sha(Buffer.from(JSON.stringify(archive.cells)))!==archive.extractionBodySha256)errors.push('CMST report extraction body hash mismatch');
 if(!/^[a-f0-9]{64}$/.test(archive.extractorSha256??''))errors.push('CMST report extractor provenance missing');
 if(errors.length)return {errors,stats:null};
 if(archive.cells.some(c=>!Number.isInteger(c.pdfPage)||!/^A\d+$/.test(c.printedPage??'')||!Number.isInteger(c.column)||!c.sourceLine||!c.dims))return {errors:['CMST report cell location/context missing'],stats:null};
 const api=new Map(Array.from({length:20},(_,i)=>[i+1,read(path.join(rawRoot,`indicator-${i+1}.json`)).rows]));const result=reconcileCmstCells(api,archive.cells);return {errors:result.errors,stats:result.stats};
}

export function verifyReportSupportSeries(expected,actual,slug,verifiedSourceSnapshots=new Map()){
 const errors=[];if(!actual||Object.keys(expected).length!==Object.keys(actual.series).length)return ['Report support source identity/count mismatch '+slug];
 for(const [key,source]of Object.entries(expected)){const stored=actual.series[key];if(!stored){errors.push('Report support source identity missing '+slug+':'+key);continue;}let compared=stored;if(Object.hasOwn(stored,'unavailable')){const problem=unpublishedSnapshotProblem(actual,key,verifiedSourceSnapshots.get(slug+':'+key));if(problem){errors.push('Unverified report support unavailable '+slug+':'+key+' '+problem);continue;}compared={...stored};delete compared.unavailable;}if(JSON.stringify(source)!==JSON.stringify(compared))errors.push('Report support original source field mismatch '+slug+':'+key);}
 return errors;
}
