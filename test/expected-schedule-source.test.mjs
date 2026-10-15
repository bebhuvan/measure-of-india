import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {parse} from 'acorn';import {unpublishedSnapshotProblem} from '../scripts/lib/source-unpublished-snapshot.mjs';
import {loadExpectedContract,replayExpectedSchedule,expectedScheduleProblem} from '../scripts/lib/source-expected-schedule.mjs';import {sourceRecordFingerprint} from '../src/explore/source-quality.js';
import {envelopeOf,envelopeRanges} from '../scripts/lib/unit-envelope.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('portable independent XLSX proof binds expected points and rejects flag-only, source and schema drift',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-expected-source-'));
 try{
  fs.mkdirSync(path.join(root,'data/raw'),{recursive:true});fs.mkdirSync(path.join(root,'data/coverage'),{recursive:true});
  const make=String.raw`import io,sys,zipfile
b=io.BytesIO()
with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Source" r:id="r1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
 z.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Expected administrative schedule</t></is></c></row><row r="2"><c r="B2" t="inlineStr"><is><t>Source sector A</t></is></c></row><row r="3"><c r="B3"><v>10</v></c></row><row r="4"><c r="B4" t="inlineStr"><is><t>-</t></is></c></row><row r="6"><c r="A6" t="inlineStr"><is><t>Eligibility from the source retirement date; snapshot unknown.</t></is></c></row></sheetData></worksheet>')
sys.stdout.buffer.write(b.getvalue())`;
  const bytes=execFileSync(process.env.ATLAS_PYTHON||'python3',['-c',make]),rawFile='data/raw/source.xlsx';fs.writeFileSync(path.join(root,rawFile),bytes);
  const B={meta:{dossier:'fixture',sourceTable:'F',sourceUrl:'https://example.invalid/source.xlsx',sourceSha256:sha(bytes),note:'Eligibility from the source retirement date; snapshot unknown.',base:'source ruler',frequency:'annual',geo:'IND',observationKind:'expected-schedule',forecastAsOfDate:null,forecastAsOfStatus:'unknown'},dates:['2026-04-01','2027-04-01'],series:{key:{name:'key',label:'Source sector A',unit:'count',data:[10,null],sourceCells:['B3','B4'],expected:['2026-04-01'],expectedNote:'Source eligibility schedule.'}}};
  const c={version:1,family:'fixture',kind:'expected-schedule',bundle:'fixture-bundle',sourceTable:'F',sourceUrl:B.meta.sourceUrl,rawFile,rawSha256:sha(bytes),unit:'count',ruler:{base:'source ruler',frequency:'annual',geo:'IND'},forecastAsOfDate:null,forecastAsOfStatus:'unknown',title:{cell:'A1',text:'Expected administrative schedule'},method:{cell:'A6',text:B.meta.note},records:[{key:'key'}]};
  const relative='data/coverage/source.expected.json';fs.writeFileSync(path.join(root,relative),JSON.stringify(c));const contract=loadExpectedContract(root,relative,sha(fs.readFileSync(path.join(root,relative))),{allowedFamilies:['fixture']});
  const replay=()=>replayExpectedSchedule(root,contract,{parseSource:body=>JSON.parse(execFileSync(process.env.ATLAS_PYTHON||'python3',[path.resolve('scripts/lib/pensions-source-xlsx.py')],{input:body})),verifyContext:s=>s.Source.A1===c.title.text&&s.Source.A6===c.method.text,records:s=>[{key:'key',sourceLabel:s.Source.B2,unit:'count',dates:B.dates,values:[s.Source.B3,s.Source.B4==='-'?null:s.Source.B4],sourceCells:['B3','B4'],canonicalFingerprint:sourceRecordFingerprint(B,{...B.series.key,key:'key'})}]});
  const proof=replay().get('fixture-bundle:key');
  const validator=fs.readFileSync('scripts/validate.mjs','utf8'),ast=parse(validator,{ecmaVersion:'latest',sourceType:'module'}),fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return validator.slice(n.start,n.end);},errors=[];
  const rangeCheck=new Function('expectedScheduleProblem','unpublishedSnapshotProblem','registeredExpectedSchedules','fail','RANGE_CHECKED',fn('trailingEst')+';return '+fn('checkRange'))(expectedScheduleProblem,unpublishedSnapshotProblem,new Map(),m=>errors.push(m),new Set());
  rangeCheck(B,0,1000000,'fixture-bundle',{},new Map(),new Map([['fixture-bundle:key',proof]]));assert.deepEqual(errors,[]);
  rangeCheck(B,0,1000000,'fixture-bundle',{});assert.ok(errors.some(e=>e.includes('Unproved')));errors.length=0;
  const globalNode=ast.body.find(n=>n.type==='BlockStatement'&&validator.slice(n.start,n.end).includes('const PLACEHOLDER')&&validator.slice(n.start,n.end).includes('unsupported observationKind'));
  const globalGuardWith=new Function('fs','path','ROOT','cfg','expectedScheduleProblem','registeredExpectedSchedules','fail','ok','RANGE_CHECKED','checkRange','envelopeOf','envelopeRanges',validator.slice(globalNode.start,globalNode.end));
  const globalGuard=(...a)=>globalGuardWith(...a,new Set(),()=>{},envelopeOf,envelopeRanges);
  fs.mkdirSync(path.join(root,'data/series'));const outside=structuredClone(B);outside.meta.dossier='unregistered-family';fs.writeFileSync(path.join(root,'data/series/outside-family.json'),JSON.stringify(outside));globalGuard(fs,path,root,{dossiers:{}},expectedScheduleProblem,new Map(),m=>errors.push(m),()=>{});assert.ok(errors.some(e=>e.includes('Unproved')));errors.length=0;
  outside.meta.observationKind='expected-schdule';fs.writeFileSync(path.join(root,'data/series/outside-family.json'),JSON.stringify(outside));globalGuard(fs,path,root,{dossiers:{}},expectedScheduleProblem,new Map(),m=>errors.push(m),()=>{});assert.ok(errors.some(e=>e.includes('unsupported observationKind')));errors.length=0;

  const ordinary=structuredClone(B);delete ordinary.meta.observationKind;delete ordinary.series.key.expected;ordinary.series.key.estimated=[ordinary.dates[0]];rangeCheck(ordinary,0,1000000,'fixture-bundle',{});assert.ok(errors.some(e=>e.includes('neither interior')));errors.length=0;
assert.equal(expectedScheduleProblem(B,'key',proof,'fixture-bundle'),null);assert.ok(Object.isFrozen(proof)&&Object.isFrozen(proof.values));assert.match(expectedScheduleProblem(B,'key',structuredClone(proof),'fixture-bundle'),/Unproved/);
  for(const mutate of [b=>b.series.key.expected.push(b.dates[1]),b=>b.series.key.expected.push(b.dates[0]),b=>b.series.key.data[0]=11,b=>b.series.key.unit='inr_crore',b=>b.meta.base='other ruler',b=>b.meta.forecastAsOfDate='2024-03-31',b=>b.meta.observationKind='expected-schdule']){const b=structuredClone(B);mutate(b);assert.notEqual(expectedScheduleProblem(b,'key',proof,'fixture-bundle'),null);}
  assert.match(expectedScheduleProblem(B,'key',null,'fixture-bundle'),/Unproved/);assert.match(expectedScheduleProblem(B,'key',proof,'different-bundle'),/identity/);assert.throws(()=>loadExpectedContract(root,'README.md',sha(bytes),{allowedFamilies:['fixture']}),/registered data\/coverage/);
  fs.writeFileSync(path.join(root,rawFile),Buffer.from('different source'));assert.throws(()=>replay(),/body hash differs/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
