import fs from 'node:fs';
import path from 'node:path';
import { readRaw } from './util.mjs';
import { nationalHighlights } from './products/schools.mjs';
import { parseNumber } from './tabular.mjs';
const sorted = d => JSON.stringify(Object.fromEntries(Object.entries(d).sort(([a],[b])=>a.localeCompare(b))));
const dimsOf = r => Object.fromEntries(Object.entries(r).filter(([k])=>!['value','year','indicator'].includes(k)).map(([k,v])=>[k,String(v??'').trim().replace(/\s+/g,' ')]));
export function validateSchools(root) {
  const errors=[],stats={bundles:0,sourceCells:0,identities:0};
  const fail=s=>errors.push(s);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/schools.manifest.json')));
  const load=slug=>JSON.parse(fs.readFileSync(path.join(root,'data/series',slug+'.json')));
  const memo=new Map(), b=slug=>memo.get(slug)??(memo.set(slug,load(slug)),memo.get(slug));
  for(const it of manifest.bundles) {
    const B=b(it.slug);stats.bundles++;
    const ranges={count:[0,1e9],pct:[0,100.1],pupils_per_teacher:[0,1000],count_per_school:[0,100000],gpi:[0,10],inr_per_year:[0,1e6]};
    if(new Set(B.dates).size!==B.dates.length||B.dates.some((d,i)=>i&&d<=B.dates[i-1]))fail(`${it.slug}: invalid date axis`);
    for(const [key,s] of Object.entries(B.series)){
      const range=s.unit==='pct'&&it.family==='udise'&&it.code===31?[0,10000]:s.unit==='pct'&&it.family==='udise'&&[32,33,43].includes(it.code)?[0,300]:s.unit==='pct'&&it.family==='cmse'&&it.code===41?[-0.11,100.1]:ranges[s.unit];
      if(!range)fail(`${it.slug}: unrecognised unit ${s.unit}`);
      if(s.data.length!==B.dates.length)fail(`${it.slug}: series/axis length mismatch`);
      for(const v of s.data)if(v!==null&&(!Number.isFinite(v)||range&&(v<range[0]||v>range[1])))fail(`${it.slug}:${key}: invalid value ${v}`);
    }
    if(it.family==='udise-report'){
      const expected=nationalHighlights(readRaw(root,'data/raw/schools-udise-report-2024.json').text);
      if(Object.keys(B.series).length!==Object.keys(expected).length)fail(`${it.slug}: national table series count mismatch`);
      for(const [key,s] of Object.entries(expected))if(B.series[key]?.unit!==s.unit||B.series[key]?.data[0]!==s.data[0])fail(`${it.slug}:${key}: national report replay mismatch`);
      continue;
    }
    const raw=readRaw(root,B.meta.rawFile??(it.family==='udise'?`data/raw/profiles-mospi/udise-0-${it.code}.json`:`data/raw/schools/cmse-${it.code}.json`));
    const rows=raw.rows.filter(r=>it.family!=='udise'||(it.slug.includes('-institution-')?r.year<'2022-23':r.year>='2022-23'));
    const cells=new Map();
    for(const s of Object.values(B.series)) {
      if(!s.unit||!s.dims)fail(`${it.slug}: missing unit or dimensions`);
      for(let i=0;i<B.dates.length;i++)cells.set(sorted(s.dims)+':'+B.dates[i],s.data[i]);
      const first=s.data.findIndex(v=>v!=null),last=s.data.findLastIndex(v=>v!=null);
      for(let i=first+1;i<last;i++)if(s.data[i]==null&&!s.gaps?.includes(B.dates[i]))fail(`${it.slug}: undeclared gap`);
    }
    const wanted=new Set();
    for(const r of rows) {
      const key=sorted(dimsOf(r))+':'+(it.family==='udise'?`${r.year.slice(0,4)}-04-01`:'2025-04-01');wanted.add(key);
      let value=parseNumber(r.value);if(it.family==='udise'&&it.code===31&&value===0)value=null;
      if(!cells.has(key)||cells.get(key)!==value)fail(`${it.slug}: missing or changed source cell ${key}`);
      stats.sourceCells++;
    }
    // Cube axes deliberately include absent year cells as null, never fabricated values.
    for(const [key,value] of cells)if(!wanted.has(key)&&value!=null)fail(`${it.slug}: invented source cell ${key}`);
    if(B.meta.indicator.sourceRows!==rows.length)fail(`${it.slug}: source count mismatch`);
    if(it.family==='udise'&&B.dates.some(d=>it.slug.includes('-institution-')?d>='2022-04-01':d<'2022-04-01'))fail(`${it.slug}: crosses collection seam`);
    for(const s of Object.values(B.series)) if(it.family==='cmse' && it.code===42 && /Average expenditure/.test(s.dims.subindicator) && s.unit!=='inr_per_year')fail(`${it.slug}: rupee subindicator mislabelled`);
  }
  const national=b('schools-national').series;
  for(const [code,key] of [[1,'schools_total_number_of_schools'],[2,'enrolments_total_number_of_enrolments_pre_primary_to_higher_secondary'],[3,'teachers_total_number_of_teachers']]) {
    const B=b(`schools-udise-student-${code}`),i=B.dates.indexOf('2024-04-01'),sum=Object.values(B.series).reduce((a,s)=>a+(s.data[i]??0),0);
    if(sum!==national[key].data[0])fail(`UDISE ${code}: state sum ${sum} != report national ${national[key].data[0]}`);stats.identities++;
  }
  const e=national.enrolments_total_number_of_enrolments_pre_primary_to_higher_secondary.data[0];
  if(national.enrolments_number_of_girl_students_pre_primary_to_higher_secondary.data[0]+national.enrolments_number_of_boys_students_pre_primary_to_higher_secondary.data[0]!==e)fail('UDISE national: girls + boys != enrolment');stats.identities++;
  for(const f of ['institution','student']) {
    const B=b(`schools-udise-${f}-28`),groups=new Map();
    for(const s of Object.values(B.series)){const {gender,...rest}=s.dims;const key=sorted(rest);const g=groups.get(key)??{};g[gender]=s;groups.set(key,g);}
    for(const g of groups.values())for(let i=0;i<B.dates.length;i++)if(['Total','Boys','Girls'].every(k=>g[k]?.data[i]!=null)){if(g.Total.data[i]!==g.Boys.data[i]+g.Girls.data[i])fail(`UDISE ${f}: enrolment gender identity failed`);stats.identities++;}
  }
  const school=b('schools-cmse-24');
  const shares=new Map();for(const s of Object.values(school.series)){const {type_of_school,...d}=s.dims;const k=sorted(d);const g=shares.get(k)??[];g.push(s.data[0]);shares.set(k,g);}
  for(const vals of shares.values())if(vals.length===4&&vals.every(v=>v!=null)){if(Math.abs(vals.reduce((a,v)=>a+v,0)-100)>0.25)fail('CMSE school-type shares do not sum to 100');stats.identities++;}
  const parts=b('schools-cmse-33'),groups=new Map();for(const s of Object.values(parts.series)){const {expenditure_item,...d}=s.dims;const k=sorted(d);const g=groups.get(k)??{};g[expenditure_item]=s.data[0];groups.set(k,g);}
  for(const g of groups.values())if(Object.keys(g).length===6&&Object.values(g).every(v=>v!=null)){const sum=Object.entries(g).filter(([k])=>k!=='All items').reduce((a,[k,v])=>a+v,0);if(Math.abs(sum-g['All items'])>4)fail(`CMSE item spending ${sum} != total ${g['All items']}`);stats.identities++;}
  return {errors,stats};
}
