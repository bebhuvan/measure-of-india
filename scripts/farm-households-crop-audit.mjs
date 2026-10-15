// Reconcile every nested crop measure to original cells and source-native analytical plates.
import fs from 'node:fs';
import {readRaw} from './lib/util.mjs';
const facts=JSON.parse(fs.readFileSync('pipeline/out/facts-farm-households.json'));
const bundle='farm-households-nss77-42-01',b=JSON.parse(fs.readFileSync(`data/series/${bundle}.json`)),combos=new Map();
const shown=new Map();for(const p of facts.plates)for(const r of p.rows)if(r.bundle===bundle){const ids=shown.get(r.series)??[];ids.push(p.id);shown.set(r.series,ids);}
for(const [key,s]of Object.entries(b.series)){
 const dims=Object.fromEntries(['sub_indicator','harvested','sub_harvested'].map(k=>[k,s.dims[k]])),id=JSON.stringify(dims);
 const x=combos.get(id)??{dims,cells:0,units:{},national:0,numericalNational:0,nationalUnits:new Set(),analyticalUnits:new Set(),analyticalPlates:new Set()};
 x.cells++;x.units[s.unit]=(x.units[s.unit]??0)+1;if(s.dims.state==='All India'){x.national++;if(Number.isFinite(s.data[0])){x.numericalNational++;x.nationalUnits.add(s.unit);}}
 for(const p of shown.get(key)??[]){x.analyticalPlates.add(p);x.analyticalUnits.add(s.unit);}combos.set(id,x);
}
const entries=[...combos.values()].map(x=>({...x,nationalUnits:[...x.nationalUnits],analyticalUnits:[...x.analyticalUnits],analyticalPlates:[...x.analyticalPlates],unmappedUnits:[...x.nationalUnits].filter(u=>!x.analyticalUnits.has(u))})),uncovered=entries.filter(x=>x.numericalNational&&(!x.analyticalPlates.length||x.unmappedUnits.length));
const report=readRaw(process.cwd(),'data/raw/farm-households-report.json'),text=report.text;
const evidence=text.match(/for all crops except coconut, harvested quantity is reported in kg and for coconut harvested quantity is reported in\s+numbers\./);
if(!evidence)throw Error('Official crop unit footnote missing');
const checks={},conflicts=[];
for(const [key,s]of Object.entries(b.series)){
 const d=s.dims,measure=d.sub_indicator;let expected;
 if(/Yield Rate/.test(measure))expected=d.crop==='Coconut'?'count_per_ha':'kg_per_ha';
 else if(/Average Per Household/.test(measure))expected=/Gross Cropped Area/.test(d.harvested)?'ha':/Value of/.test(d.harvested)?'inr':d.crop==='Coconut'?'count':'kg';
 else expected='per_1000';
 const category=(d.crop==='Coconut'?'coconut':'other crops')+':'+expected;checks[category]=(checks[category]??0)+1;
 if(s.unit!==expected)conflicts.push({key,dims:d,expected,actual:s.unit});
}
if(conflicts.length)throw Error('Canonical crop unit conflicts');
const unitEvidence={source:report.url,report:'Report 587, Statement 3.4; Appendix Table 11',pdfPage:text.slice(0,evidence.index).split('\f').length,sourceText:evidence[0],canonicalChecks:checks,conflicts,method:'Table 11 explicitly separates quantity kg/number and yield kg/ha or number/ha. Original API labels are retained in dims; commodity-specific canonical units follow the official report footnote. Area, value, quantity, yield and incidence are checked independently for every original cell.'};
const result={unitEvidence,bundle,sourceCells:Object.keys(b.series).length,jointMeasures:entries.length,entries,unmappedNationalMeasures:uncovered,method:'Joint identity of sub_indicator, harvested and sub_harvested; all original observed cells retained. Source-native national crop comparisons use one observed season/visit. Means are per household reporting crop production, not national totals. Coconut numbers and number/ha remain distinct from kg and kg/ha.'};
fs.writeFileSync('docs/status/farm-households-crop-measures-audit.json',JSON.stringify(result,null,1)+'\n');
if(result.sourceCells!==3211||result.jointMeasures!==13||uncovered.length)throw Error('Crop-measure scope or mapping changed');
console.log('All 13 nested crop measures / 3211 original cells accounted for; no unmapped national measures.');
