// Pensions primary XLSX expected-source factory. Explicit replay only; no import-time source or publication side effects.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';
import {loadExpectedContract,replayExpectedSchedule} from './source-expected-schedule.mjs';
const PIN='df90f07e566f217d4c8462e24bd238c580dc981e1a571c0397d1a33cfc29c7b0';
function projectFile(root,relative){
 let file=root;for(const part of relative.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('Expected source project path must not contain symlinks: '+relative);}
 if(!fs.statSync(file).isFile())throw Error('Expected source project file is missing: '+relative);
 return file;
}
export function replayPensionExpectedProofs(sourceRoot=process.cwd()){
 const root=fs.realpathSync(sourceRoot),descriptor='data/coverage/pensions.expected-schedule-source-contract.json';
 projectFile(root,descriptor);
 const parser=projectFile(root,'scripts/lib/pensions-source-xlsx.py');
 const c=loadExpectedContract(root,descriptor,PIN,{allowedFamilies:['pensions']});
 return replayExpectedSchedule(root,c,{
  parseSource:bytes=>JSON.parse(execFileSync(process.env.ATLAS_PYTHON || 'python3',[parser],{input:bytes,maxBuffer:3000000})),
  verifyContext:(source,c)=>{const sheet=source[c.sheet];return c.unit==='count'&&sheet?.[c.title.cell]===c.title.text&&sheet[c.method.cell]===c.method.text&&c.records.every(r=>sheet[r.sourceColumn+c.headerRow]===r.sourceLabel);},
  records:(source,c)=>c.records.map(r=>{const sheet=source[c.sheet],dates=[],values=[];
   for(const cell of r.sourceCells){const match=cell.match(/^([A-Z]+)(\d+)$/);if(!match||match[1]!==r.sourceColumn)throw Error('Expected source coordinate column differs');const period=String(sheet[c.sourceDateColumn+match[2]]).trim(),year=period.match(/^(\d{4})[-–](\d{2}|\d{4})$/);if(!year||+year[2]!==(+year[1]+1)%(year[2].length===2?100:10000))throw Error('Expected source fiscal-year label differs');dates.push(year[1]+'-04-01');const v=sheet[cell];if(v===null||v===undefined||v==='-')values.push(null);else if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)values.push(v);else throw Error('Expected source is not a literal count');}
   return {key:r.key,sourceLabel:r.sourceLabel,unit:c.unit,dates,values,sourceCells:r.sourceCells,canonicalFingerprint:r.canonicalFingerprint};})
 });
}
