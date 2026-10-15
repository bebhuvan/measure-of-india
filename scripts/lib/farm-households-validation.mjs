import {extractFarmReport} from '../farm-households-report.mjs';
import fs from 'node:fs';
import {readRaw} from './util.mjs';
import {CODES,keyOf,clean} from './products/farm-households.mjs';
export function validateFarmHouseholds(root){
 const errors=[],issues=[],stats={sourceCells:0,identities:0,withheld:0},manifest=JSON.parse(fs.readFileSync(root+'/data/coverage/farm-households.manifest.json'));
 const stable=x=>JSON.stringify(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
 const map=new Map();for(const it of manifest.bundles.filter(it=>Number.isInteger(it.code))){const b=JSON.parse(fs.readFileSync(root+'/data/series/'+it.slug+'.json'));let m=map.get(it.code);if(!m){m=new Map();map.set(it.code,m);}for(const [k,s]of Object.entries(b.series)){if(m.has(k))errors.push('Duplicate chunk grain '+it.code);m.set(k,s);}}
 if(map.size!==33||manifest.sourceRows!==471001)errors.push('Farm inventory count mismatch');
 for(const code of CODES){
  const raw=readRaw(root,`data/raw/profiles-mospi/nss77-0-${code}.json`),m=map.get(code),seen=new Set();
  if(raw.rows.length!==raw.indicator.expected||m.size!==raw.rows.length)errors.push('Incomplete farm table '+code);
  for(const r of raw.rows){
   const d=Object.fromEntries(Object.keys(r).filter(k=>!['indicator','value'].includes(k)).map(k=>[k,clean(r[k])])),key=keyOf(d),s=m.get(key);let v=String(r.value??'').trim().replaceAll(',','');const withheld=/^\([^)]*\)$/.test(v);const quarantine=code===33||code===47||code===21&&Number(v)>1000;v=quarantine||withheld||v===''||!Number.isFinite(Number(v))?null:Number(v);
   if(seen.has(key))errors.push('Duplicate archived joint grain '+code);seen.add(key);
   if(!s||s.data[0]!==v||stable(s.dims)!==stable(d)||s.sourceValue!==String(r.value))errors.push('Farm source replay mismatch '+code+' '+key);
   if(withheld)stats.withheld++;
   if(s&&s.unit==='per_1000'&&v>1000)issues.push({code,key,value:v,issue:'Source estimate exceeds per-thousand range; requires unit/denominator reconciliation.'});
   stats.sourceCells++;
  }
 }
 const identity=(code,dim,parts,total,tol)=>{
  const groups=new Map();for(const s of map.get(code).values()){const {[dim]:label,...dims}=s.dims,k=stable(dims),g=groups.get(k)??{};g[label]=s.data[0];groups.set(k,g);}
  for(const [grain,g] of groups)if(parts.every(p=>Number.isFinite(g[p]))&&Number.isFinite(g[total])){stats.identities++;const sum=parts.reduce((a,p)=>a+g[p],0);if(Math.abs(sum-g[total])>tol)issues.push({code,grain,sum,total:g[total],issue:'Published components do not reproduce total within rounding tolerance; retained and disclosed, not silently repaired.'});}
 };
 for(const c of [24,25])identity(c,'sub_indicator',['Income From Wages (rs.)','Income From Leasing Out of Land (rs.)','Net Receipt From Crop Production (rs.)','Net Receipt From Farming of Animals (rs.)','Net Receipt From Non-farm Business (rs.)'],'Total Income (rs.)',3);
 identity(29,'crop_production',['All other expenses*','Diesel','Electricity','Fertilizer /manure','Interest','Irrigation','Labour-animal','Labour-human','Lease rent for land','Minor repair and maintenance of machinery and equipment','Plant protection materials','Seeds'],'Total expenses',7);
 identity(32,'receipts_type',['Expenses (Rs.)','Net receipts (Rs.)'],'Receipts (Rs.)',2);
 identity(34,'ownership_holding_area',['Average Area Homestead land Owned per hh(ha)','Average area Land Owned, Excluding Homestead Land per hh (ha)'],'Average Area Owned per hh (ha)',0.011);
 identity(49,'crop_insurance',['Insured Additionally','Insured Only When Received Loan','Not Insured'],'All',2);
 const expected=extractFarmReport(readRaw(root,'data/raw/farm-households-report.json')).seriesByTable;
 for(const it of manifest.bundles.filter(it=>String(it.code).startsWith('report-'))){const b=JSON.parse(fs.readFileSync(root+'/data/series/'+it.slug+'.json'));const exp=expected[String(it.code).slice(7)];if(JSON.stringify(b.series)!==JSON.stringify(exp))errors.push('Official report replay failed '+it.code);stats.sourceCells+=Object.keys(exp).length;}
 // Detect duplicate state vectors over the whole family, preserving audit evidence.
 for(const code of CODES){const vectors=new Map();for(const s of map.get(code).values()){const {state,...d}=s.dims,k=stable(d);const arr=vectors.get(state)??[];arr.push([k,s.sourceValue]);vectors.set(state,arr);}const seenVectors=new Map();for(const [state,arr]of vectors){const v=JSON.stringify(arr.sort(([a],[b])=>a.localeCompare(b))),states=seenVectors.get(v)??[];states.push(state);seenVectors.set(v,states);}for(const states of seenVectors.values())if(states.length>1){issues.push({code,states,issue:'Identical complete state vectors; quarantined, report-native replacement required.'});if([...map.get(code).values()].some(s=>states.includes(s.dims.state)&&s.data[0]!=null))errors.push('Duplicated state vector remains numeric '+code);}}
 if(!stats.identities)errors.push('Farm identities were not exercised');
 return {errors,issues,stats};
}
