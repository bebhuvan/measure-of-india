import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {readRaw} from './util.mjs';
import {energyVintageProvenance,energyVintageMismatches} from './energy-provenance.mjs';
import {energyReportCells} from './energy-report-cells.mjs';
import {energySourceGroups,cube,energyKey} from './products/energy.mjs';
export function validateEnergy(root){const errors=[],issues=[],stats={sourceCells:0,identities:0,bundles:0};const groups=energySourceGroups(root);
 if(JSON.stringify(energyReportCells(readRaw(root,'data/raw/energy-report-2025.json')))!==JSON.stringify(readRaw(root,'data/raw/energy-report-balance-cells.json').tables))errors.push('Historical report cell extraction replay failed against archived original page text');
 const originals=Object.fromEntries(['balance','annex-balance'].map(tag=>[tag,readRaw(root,`data/raw/energy-report-2026-${tag}-xlsx.json`)]));
 for(const [tag,b] of Object.entries(originals))if(crypto.createHash('sha256').update(Buffer.from(b.base64,'base64')).digest('hex')!==b.sha256)errors.push('Original workbook hash failed '+tag);
 const replayed=JSON.parse(execFileSync(process.env.ATLAS_PYTHON??'python3',[path.join(root,'scripts/energy-replay-workbooks.py')],{input:JSON.stringify(originals),maxBuffer:20e6}).toString());
 if(JSON.stringify(replayed)!==JSON.stringify(readRaw(root,'data/raw/energy-report-2026-workbook-rows.json').tables))errors.push('Workbook cell extraction replay failed against original XLSX bytes');
 const load=slug=>JSON.parse(fs.readFileSync(path.join(root,'data/series/'+slug+'.json')));
 const issue=(bundle,date,identity,observed,expected)=>issues.push({bundle,date,identity,observed,expected,residual:observed-expected,classification:'Published source discrepancy; raw cells replay exactly, no correction made.'});
 for(const g of groups){stats.bundles++;const actual=load(g.slug),expected=cube(g.rows,g.meta).bundle;for(const key of energyVintageMismatches(actual.meta,energyVintageProvenance(root,g)))errors.push(g.slug+': source vintage/capture provenance failed '+key);if(JSON.stringify(actual.dates)!==JSON.stringify(expected.dates))errors.push(g.slug+': date axis replay failed');
 if(Object.keys(actual.series).length!==Object.keys(expected.series).length)errors.push(g.slug+': series inventory replay failed');
 for(const [k,s] of Object.entries(expected.series)){const a=actual.series[k];if(!a||JSON.stringify(a.dims)!==JSON.stringify(s.dims)||JSON.stringify(a.data)!==JSON.stringify(s.data)||a.unit!==s.unit)errors.push(g.slug+': source replay failed '+k);stats.sourceCells+=s.sourceCells; if(a?.data.length!==actual.dates.length)errors.push(g.slug+': parallel-array mismatch '+k);}
 const find=(dims,i)=>{const s=Object.values(actual.series).find(s=>Object.entries(dims).every(([k,v])=>s.dims[k]===v));return s?.data[i];};
 const test=(date,id,observed,parts,tolerance)=>{if(observed==null||parts.some(v=>v==null))return;stats.identities++;const exp=parts.reduce((a,v)=>a+v,0);if(Math.abs(observed-exp)>tolerance)issue(g.slug,date,id,observed,exp);};
 if(g.slug.includes('mospi')&&!['gwh','source_scaled_gwh'].includes(g.meta.unit))for(const [i,date] of actual.dates.entries()){
  if(g.meta.balanceUse==='supply')for(const fuel of [...new Set(Object.values(actual.series).map(s=>s.dims.fuel))])test(date,fuel+': primary supply signed identity',find({fuel,flow:'Total primary energy supply'},i),['Production','Imports','Exports','Stock changes'].map(flow=>find({fuel,flow},i)),0.05);
  else for(const fuel of [...new Set(Object.values(actual.series).map(s=>s.dims.fuel))])test(date,fuel+': final consumption sector identity',find({fuel,subproduct:'',flow:'Final consumption',sector:''},i),['Industry','Transport','Others','Non-energy use'].map(flow=>find({fuel,subproduct:'',flow,sector:''},i)),0.05);
 }
 if(g.slug==='energy-report-2026-balance-ktoe')for(const [i,date] of actual.dates.entries())for(const fuel of [...new Set(Object.values(actual.series).map(s=>s.dims.fuel))]){
 test(date,fuel+': supply includes workbook signed bunkers',find({fuel,flow:'Total primary energy supply'},i),['Production','Imports','Exports','Stock changes','International marine bunkers','International aviation bunkers'].map(flow=>find({fuel,flow},i)??0),1e-5);
 test(date,fuel+': full transformation bridge',find({fuel,flow:'Final consumption'},i),['Total primary energy supply','Statistical differences','Main activity producer electricity plants','Autoproducer electricity plants','Oil refineries','Energy industry own use','Losses'].map(flow=>find({fuel,flow},i)),1e-5);
 test(date,fuel+': final end-use sectors',find({fuel,flow:'Final consumption'},i),['Industry','Transport','Other','Non-energy use'].map(flow=>find({fuel,flow},i)),1e-5);
 }
 if(g.slug.includes('ember')&&(g.meta.unit==='gwh'||g.slug.includes('generation-twh'))){const states=[...new Set(Object.values(actual.series).map(s=>s.dims.state))];for(const state of states)for(const [i,date] of actual.dates.entries()){
 const vars=Object.values(actual.series).filter(s=>s.dims.state===state),n=vars.find(s=>/^(Total generation|Total Generation)$/.test(s.dims.variable));if(!n)continue;
 const fuels=vars.filter(s=>s.dims.subcategory==='Fuel'||(s.dims.aggregate==='false'&&s.dims.variable!=='Net imports'));test(date,state+': generation fuels sum',n.data[i],fuels.map(s=>s.data[i]),0.11);
 const clean=vars.find(s=>s.dims.variable==='Clean'),fossil=vars.find(s=>s.dims.variable==='Fossil');test(date,state+': clean plus fossil',n.data[i],[clean?.data[i],fossil?.data[i]],0.11);
 }}
 }
 // Independently identify the API's fuel definition using printed footnotes and source-rounded production cells.
 const apiSupply=readRaw(root,'data/raw/energy-records-1-1.json').rows,printed=readRaw(root,'data/raw/energy-report-balance-cells.json').tables;
 for(const t of printed.filter(t=>t.unit==='ktoe')){const api=apiSupply.find(r=>r.year===t.year&&r.energy_commodities==='Coal'&&r.end_use_sector==='Production'),cell=t.rows.find(r=>r.flow==='Production')?.values[0];stats.identities++;if(!api||cell==null||Math.abs(api.value-cell)>0.501)errors.push('API coal definition/source edition fails independent printed production check '+t.year);}
 // Cross-ruler conversion: independently rounded API PJ and KToE values.
 for(const group of groups.filter(g=>g.slug.startsWith('energy-mospi-ktoe-')&&g.meta.unit==='ktoe')){
 const a=load(group.slug),peer=group.slug.replace('energy-mospi-ktoe-','energy-mospi-pj-'),b=load(peer);
 for(const [k,s] of Object.entries(a.series))for(let i=0;i<a.dates.length;i++){const p=b.series[k]?.data[i],v=s.data[i];if(p==null||v==null)continue;stats.identities++;if(Math.abs(p-v*0.041868)>0.011)issue(peer,a.dates[i],s.label+': PJ = KToE × 0.041868',p,v*0.041868);}}
 const canary=load('energy-mospi-ktoe-supply-coal-lignite-separate'),key=Object.entries(canary.series).find(([k,s])=>s.dims.fuel==='Total'&&s.dims.flow==='Total primary energy supply')[0];if(canary.series[key].data.at(-1)!==903157.89)errors.push('2025 API primary supply canary changed; review source revision');
 issues.push({bundle:groups.filter(g=>g.meta.unit==='source_scaled_gwh').map(g=>g.slug),identity:'GWh source-heading defect',classification:'PJ source scales GWh output by 0.041868. Audit-only source_scaled_gwh; excluded from charts and physical facts.'});
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'docs/reference/energy-reviewed-source-discrepancies.json'))).issues;
 if(JSON.stringify(issues)!==JSON.stringify(reviewed))errors.push('Energy source discrepancies changed: human review of the source cells and disclosure is required.');
 return {errors,issues,stats};}
