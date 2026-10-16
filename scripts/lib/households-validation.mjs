import fs from 'node:fs';
import {readRaw} from './util.mjs';
import {keyOf,householdUnit,flowCodes,indebtedMeans,noEstimateRows} from './products/households.mjs';
const stable=d=>JSON.stringify(Object.entries(d).sort(([a],[b])=>a.localeCompare(b)));
export function validateHouseholds(root){
 const errors=[],issues=[],stats={sourceCells:0,identities:0},bundles=new Map();
 const fail=s=>errors.push(s);
 const load=c=>bundles.get(c)??(bundles.set(c,JSON.parse(fs.readFileSync(`${root}/data/series/households-aidis-${c}.json`))),bundles.get(c));
 const manifest=JSON.parse(fs.readFileSync(`${root}/data/coverage/households.manifest.json`));
 if(manifest.bundles.filter(x=>x.code!=='release').length!==22)fail('AIDIS inventory incomplete');
 for(const it of manifest.bundles){
  const b=load(it.code),raw=readRaw(root,b.meta.rawFile),seen=new Set();
  if(it.code==='release'){
   const expected=indebtedMeans(raw.html);
   if(JSON.stringify(b.series)!==JSON.stringify(expected))fail('AIDIS conditional means: release body replay failed');
   stats.sourceCells+=Object.keys(expected).length;continue;
  }
  const none=noEstimateRows(raw.rows);
  if(raw.rows.length!==raw.indicator.expected||Object.keys(b.series).length+none.size!==raw.rows.length||(it.withheld??0)!==none.size)fail(`${it.slug}: source row coverage mismatch`);
  if(b.dates[0]!== (flowCodes.has(it.code)?'2019-06-30':'2018-06-30'))fail(`${it.slug}: stock/flow reference date incorrect`);
  for(const r of raw.rows){
   const dims=Object.fromEntries(b.meta.dimensions.map(d=>[d,String(r[d]??'').trim().replace(/\s+/g,' ')])),k=keyOf(dims),s=b.series[k];
   const n=Number(String(r.value).replaceAll(',','')),v=String(r.value).trim()===''||!Number.isFinite(n)?null:n;
   if(seen.has(k))fail(`${it.slug}: duplicate source grain`);seen.add(k);
   if(none.has(r)){if(s)fail(`${it.slug}: share of a nil amount baked as a figure ${k}`);stats.sourceCells++;continue;}
   if(!s||s.data[0]!==v||stable(s.dims)!==stable(dims)||s.unit!==householdUnit(r))fail(`${it.slug}: source replay failed ${k}`);
   if(s&&s.data[0]!=null){if(s.data[0]<0)issues.push({bundle:it.slug,series:k,dims:s.dims,value:s.data[0],issue:'Negative asset estimate published by source; retained for audit, unsuitable as literal ownership value.'});if(s.unit==='per_1000'&&s.data[0]>1000)fail(`${it.slug}: per-thousand estimate exceeds base`);}
   stats.sourceCells++;
  }
 }
 const groups=c=>{const g=new Map();for(const s of Object.values(load(c).series)){const {sub_indicator,...dims}=s.dims,k=stable(dims);const v=g.get(k)??{};v[sub_indicator]=s.data[0];g.set(k,v);}return g;};
 const identity=(label,sum,total,tolerance)=>{
  if(!Number.isFinite(sum)||!Number.isFinite(total))return;
  stats.identities++;if(Math.abs(sum-total)>tolerance)fail(`${label}: component sum ${sum} differs from total ${total} beyond rounding tolerance ${tolerance}`);
 };
 for(const g of groups(11).values()){
  const parts=Object.entries(g).filter(([k])=>/Average value of assets/.test(k)&&!k.endsWith('any asset'));
  if(parts.length===8&&parts.every(([,v])=>v!=null))identity('Physical and financial asset components',parts.reduce((a,[k,v])=>a+v,0),g['Average value of assets (Rs.) - any asset'],5);
 }
 for(const g of groups(19).values()){
  const parts=Object.entries(g).filter(([k])=>/average value/.test(k)&&!k.endsWith(' - all'));
  if(parts.length===3&&parts.every(([,v])=>v!=null))identity('Fixed capital expenditure components',parts.reduce((a,[k,v])=>a+v,0),g['FCE - average value per household (Rs.) - all'],2);
 }
 // Mutually exclusive creditor amount shares; household incidence is deliberately not added.
 for(const c of [29,34]){
  const dim=c===29?'credit_agency':'purpose_of_loan',g=new Map();
  for(const s of Object.values(load(c).series))if(/per Rs\. 1000/.test(s.dims.sub_indicator)){
   const {[dim]:part,...dims}=s.dims,k=stable(dims),v=g.get(k)??{};v[part]=s.data[0];g.set(k,v);
  }
  for(const v of g.values()){
   const total=v[c===29?'All agencies (incl. n.r.)':'All (incl. n.r.)'];
   const parts=Object.entries(v).filter(([k])=>c===29?!k.startsWith('All'):!['All (incl. n.r.)','Expenditure in farm business','Expenditure in non-farm business'].includes(k));
   if(parts.length && parts.every(([,n])=>n!=null)){const sum=parts.reduce((a,[k,n])=>a+n,0);stats.identities++;if(sum>total+parts.length/2+1)fail('Debt amount components exceed inclusive total');if(total-sum>parts.length/2+1)issues.push({label:c===29?'Creditor':'Purpose',sum,total,issue:'Inclusive total contains unreported category residual; components are not forced to sum to the total.'});}
  }
 }
 // Conditional means are published separately; incidence is rounded per thousand.
 for(const s of Object.values(load('release').series)){
  const src=Object.values(load(9).series).find(x=>x.dims.state==='All-India'&&x.dims.sector===s.dims.sector&&x.dims.occupational_category===s.dims.occupational_category&&x.dims.asset_quintile_class==='All (Asset Holding Class)'&&x.dims.sub_indicator==='Average value (Rs.) of cash loan outstanding');
  const incidence=Object.values(load(8).series).find(x=>x.dims.state==='All-India'&&x.dims.sector===s.dims.sector&&x.dims.occupational_category===s.dims.occupational_category&&x.dims.asset_quintile_class==='All (Asset Holding Class)'&&/cash loan outstanding/.test(x.dims.sub_indicator));
  if(!src||!incidence){fail('Missing conditional-debt identity source');continue;}
  stats.identities++;if(Math.abs(1000*src.data[0]/s.data[0]-incidence.data[0])>0.51)fail('Conditional debt mean and all-household mean disagree with rounded incidence');
 }
 return {errors,issues,stats};
}
