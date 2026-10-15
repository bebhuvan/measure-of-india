// Complete observed energy cubes. Source totals remain separate from components.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readRaw,writeSeries} from '../util.mjs';
import {parseCsv,parseNumber} from '../tabular.mjs';
import {energyVintageProvenance} from '../energy-provenance.mjs';
import {writeCatalogue} from '../catalogue.mjs';
export const clean=x=>String(x??'').trim().replace(/\s+/g,' ');
export const energyKey=dims=>'c_'+crypto.createHash('sha256').update(JSON.stringify(Object.entries(dims).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,20);
export const slugify=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function cube(rows,meta){
 const dates=[...new Set(rows.map(r=>r.date))].sort(),series={};
 for(const r of rows){const k=energyKey(r.dims);const s=series[k]??={name:k,label:Object.values(r.dims).filter(Boolean).join(' / '),dims:r.dims,unit:meta.unit,color:'#2E4BD8',data:dates.map(()=>null),sourceCells:0}; const i=dates.indexOf(r.date);if(s._seen?.has(i))throw Error('Duplicate energy cell '+k+' '+r.date);(s._seen??=new Set()).add(i);s.data[i]=r.value;s.sourceCells++;}
 const empty=[];for(const [k,s] of Object.entries(series)){
  delete s._seen;if(meta.geographicInstrument==='jk-includes-ladakh'&&s.dims.state==='Jammu and Kashmir')s.label=s.label.replace('Jammu and Kashmir','Jammu and Kashmir including Ladakh');if(meta.geographicInstrument==='jk-ladakh-transition')s.label+=' / mixed annual reporting scope';if(meta.fuelInstrument==='coal-includes-lignite'&&s.dims.fuel==='Coal')s.label=s.label.replace(/^Coal(?= \/|$)/,'Coal (including lignite)');const first=s.data.findIndex(v=>v!==null),last=s.data.findLastIndex(v=>v!==null);
  if(first<0){empty.push({key:k,...s});delete series[k];continue;}
  const gaps=dates.filter((d,i)=>i>first&&i<last&&s.data[i]===null);if(gaps.length){s.gaps=gaps;s.gapsNote='Unpublished source cells or explicit blanks; no interpolation.';}
 }
 return {bundle:{meta:{dossier:'energy',geo:'IND',base:'Published energy accounts; no base-year index',revisionPolicy:'Agency revisions retained as new raw vintages before rebaking.',...meta,latestPeriod:meta.frequency==='monthly'?dates.at(-1).slice(0,7):meta.calendar==='fiscal-apr'?`${dates.at(-1).slice(0,4)}–${String(+dates.at(-1).slice(0,4)+1).slice(2)}`:dates.at(-1).slice(0,4)},dates,series},empty};
}
export function mospiRows(raw,ind,use){return raw.rows.map(r=>({date:r.year.slice(0,4)+'-04-01',value:parseNumber(r.value),unit:r.end_use_sector==='Elect. Output in GWh'?(ind===1?'gwh':'source_scaled_gwh'):ind===1?'ktoe':'pj',dims:{fuel:clean(r.energy_commodities),subproduct:clean(r.energy_sub_commodities),flow:clean(r.end_use_sector),sector:clean(r.end_use_sub_sector)}}));}
export function emberCsvRows(raw){const table=parseCsv(raw.text),header=table.shift();return table.map(a=>Object.fromEntries(header.map((h,i)=>[h,a[i]]))).map(r=>({date:r.Date??r.Year+'-01-01',value:parseNumber(r.Value),unit:({'%':'pct','GWh':'gwh','MW':'mw','ktCO2':'kt_co2e','gCO2/kWh':'g_co2e_per_kwh'})[r.Unit],dims:{state:r.State,state_code:r['State code'],category:r.Category,subcategory:r.Subcategory,variable:r.Variable}}));}
export function energyGeographicScope(row,frequency){
 if(!['Jammu and Kashmir','Ladakh'].includes(row.dims.state))return 'other-states';
 if(frequency==='monthly')return row.date<'2021-07-01'?'jk-includes-ladakh':'jk-ladakh-separate';
 return row.date<'2021-01-01'?'jk-includes-ladakh':row.date<'2022-01-01'?'jk-ladakh-transition':'jk-ladakh-separate';
}
export function partitionEnergyGeography(groups){
 return groups.flatMap(g=>{if(g.meta.product!=='ember-india-states')return [g];
 const frequency=g.meta.frequency,scopes=[...new Set(g.rows.map(r=>energyGeographicScope(r,frequency)))];
 return scopes.map(scope=>({...g,slug:g.slug+(scope==='other-states'?'':'-geo-'+scope),rows:g.rows.filter(r=>energyGeographicScope(r,frequency)===scope),meta:{...g.meta,geographicInstrument:scope,base:'Ember India subnational electricity release, '+scope,note:g.meta.note+' Geographic instrument: '+scope+'. July 2021 is the first separate Ladakh monthly observation; annual 2021 is isolated as a mixed reporting-scope transition. No canonical history crosses this boundary.'}}));
 });
}
export function nationalRows(raw){const units={generation_twh:'twh',share_of_generation_pct:'pct',demand_twh:'twh',demand_mwh_per_capita:'mwh_per_person',emissions_mtco2:'mt_co2e',share_of_emissions_pct:'pct',emissions_intensity_gco2_per_kwh:'g_co2e_per_kwh'};return raw.body.data.flatMap(r=>raw.body.stats.available_metrics.map(metric=>({date:r.date+'-01-01',value:parseNumber(r[metric]),unit:units[metric],dims:{state:'India',variable:r.series??'Total',metric,aggregate:String(r.is_aggregate_series??false)}})));}
export function energyFuelEvidence(root){
 const raw=readRaw(root,'data/raw/energy-report-2025.json'),evidence=[];
 for(const [i,page] of raw.text.split('\f').entries()){
  const title=page.match(/Table[ -][^\n]*?:\s*Energy Balance of India for (20\d\d-\d\d)[^\n]*/i);if(!title||/All figures in Peta/i.test(page))continue;
  const header=page.slice(page.indexOf('Coal'),page.indexOf('Production')),combined=/Coal\s*#/.test(header)&&/#\s*Includes lignite/i.test(page),separate=/Coal\s+Lignite\s+Crude Oil/.test(header);
  if(!combined&&!separate)throw Error('Unresolved source coal definition '+title[1]);
  evidence.push({year:title[1],instrument:combined?'coal-includes-lignite':'coal-lignite-separate',table:title[0].trim(),pdfPage:i+1,printedPage:page.match(/(\d+)\s*\|\s*P a g e/)?.[1],columnHeading:clean(header),definition:combined?'Coal #; footnote: # Includes lignite':'Coal and Lignite are distinct table columns; coal excludes the separately reported lignite column.',sourceUrl:raw.url,sourceSha256:raw.sha256});
 }
 if(evidence.length!==12)throw Error('Incomplete twelve-year fuel-definition evidence');return evidence;
}
export function energySourceGroups(root){
 const methodEvidence=Object.fromEntries(['national','subnational'].map(tag=>{const rawFile='data/raw/energy-ember-methodology-'+tag+'.json',r=readRaw(root,rawFile);if(!/CO2e|CO2eq/.test(r.text))throw Error('Ember CO2-equivalent unit evidence missing '+tag);return[tag,{rawFile,sha256:r.sha256,sourceUrl:r.sourceUrl}]}));const groups=[];
 for(const ind of [1,2])for(const use of [1,2]){
  const rawFile=`data/raw/energy-records-${ind}-${use}.json`,raw=readRaw(root,rawFile),rows=mospiRows(raw,ind,use),definition=new Map(energyFuelEvidence(root).map(e=>[e.year.slice(0,4)+'-04-01',e.instrument]));if(rows.some(r=>!definition.has(r.date)))throw Error('API serves a year without independently established fuel definitions');const splitYears=new Set([...definition].filter(([date,instrument])=>instrument==='coal-lignite-separate').map(([date])=>date));
  const actualSplitYears=new Set(rows.filter(r=>r.dims.fuel==='Lignite').map(r=>r.date));if([...new Set(rows.map(r=>r.date))].some(d=>actualSplitYears.has(d)!==splitYears.has(d)))throw Error('API fuel columns conflict with explicit report definitions');
  for(const unit of [...new Set(rows.map(r=>r.unit))])for(const seam of ['coal-includes-lignite','coal-lignite-separate']){
   const own=rows.filter(r=>r.unit===unit&&(splitYears.has(r.date)?'coal-lignite-separate':'coal-includes-lignite')===seam);if(!own.length)continue;
   const prefix=`energy-mospi-${ind===1?'ktoe':'pj'}-${use===1?'supply':'consumption'}${unit==='gwh'||unit==='source_scaled_gwh'?'-gwh':''}`;
   groups.push({slug:prefix+'-'+seam,rows:own,meta:{source:'MoSPI, Energy Statistics India',sourceUrl:'https://www.mospi.gov.in/themes/product/60-energy-statistics',product:'energy-balance',frequency:'annual',calendar:'fiscal-apr',unit,rawFile,balanceUse:use===1?'supply':'consumption',fuelInstrument:seam,note:(unit==='source_scaled_gwh'?'Source defect: PJ table multiplies GWh electricity output by 0.041868 but retains the GWh heading. Values archived unchanged for audit; they are neither genuine GWh nor a defensible energy quantity. Excluded from analytical comparisons.':unit==='gwh'?'Electricity-output branch is GWh despite parent energy indicator. Thermal output is zero in this limited branch; Total is not all national generation.':'Signed exports and stock changes are retained. Total supply = production + imports + signed exports + signed stock changes. Totals and petroleum subproducts overlap. API does not publish transformation/loss rows. Latest API year provisional.')+' '+(seam==='coal-includes-lignite'?'Coal includes lignite; these years remain a separate instrument from the later coal/lignite split.':'Coal and lignite are separately published; never join this coal series to the older combined-fuel definition.') }});
  }
 }
 for(const dataset of ['electricity-generation','electricity-demand','power-sector-emissions','carbon-intensity']){const rawFile=`data/raw/energy-ember-national-${dataset}-yearly.json`,raw=readRaw(root,rawFile),rows=nationalRows(raw);for(const unit of [...new Set(rows.map(r=>r.unit))])groups.push({slug:`energy-ember-national-${dataset}-${unit}`,rows:rows.filter(r=>r.unit===unit),meta:{source:'Ember, national electricity data',sourceUrl:raw.sourceUrl,product:'ember-national-'+dataset,frequency:'annual',calendar:'calendar',unit,rawFile,unitDefinitionEvidence:methodEvidence.national,note:'Emissions and intensity are estimated lifecycle greenhouse gases expressed as CO2-equivalent, including upstream fuel and manufacturing impacts. Calendar years; original API metric names are retained in source dimensions. Fuel aggregates overlap individual fuels. Electricity demand includes net imports; negative net imports are retained. Power emissions are source estimates, not measured stack totals. Kept separate from MoSPI fiscal energy accounts and Ember state release.'}});}
 for(const freq of ['yearly','monthly']){const rawFile=`data/raw/energy-ember-states-${freq}.json`,raw=readRaw(root,rawFile),rows=emberCsvRows(raw);if(rows.some(r=>!r.unit))throw Error('Unresolved Ember unit');for(const category of [...new Set(rows.map(r=>r.dims.category))])for(const unit of [...new Set(rows.filter(r=>r.dims.category===category).map(r=>r.unit))])groups.push({slug:`energy-ember-states-${freq}-${slugify(category)}-${unit.replaceAll('_','-')}`,rows:rows.filter(r=>r.unit===unit&&r.dims.category===category),meta:{source:'Ember, India subnational electricity data',sourceUrl:raw.sourceUrl,product:'ember-india-states',frequency:freq==='monthly'?'monthly':'annual',calendar:'calendar',unit,rawFile,unitDefinitionEvidence:methodEvidence.subnational,note:'Emissions and intensity are estimated lifecycle greenhouse gases expressed as CO2-equivalent. The state release excludes captive generation that national estimates include. Historical renewable capacity can contain upstream imputation; cell-level imputation flags are unavailable. Earlier Ladakh and Jammu-and-Kashmir reporting combines jurisdictions. Complete original release, including India Total and Others. Generation is at plant location, not electricity consumed by residents. Capacity is installed MW, generation is GWh. Emissions/intensity are source estimates. Clean includes nuclear; Renewable excludes nuclear. Aggregate fuel rows overlap individual fuels; do not add both. Source blanks remain null; all-empty series stay in raw and the catalogue with a reason.'}});}
 const reportFile='data/raw/energy-report-balance-cells.json',report=readRaw(root,reportFile);
 for(const unit of ['ktoe','pj'])for(const seam of ['coal-includes-lignite','coal-lignite-separate']){
  const ts=report.tables.filter(t=>t.unit===unit&&(t.fuels.includes('Lignite')?'coal-lignite-separate':'coal-includes-lignite')===seam);if(!ts.length)continue;
  const rows=ts.flatMap(t=>t.rows.filter(r=>['Statistical differences','Main activity producer electricity plants','Autoproducer electricity plants','Oil refineries','Energy industry own use','Losses'].includes(r.flow)).flatMap(r=>t.fuels.map((fuel,i)=>({date:t.year.slice(0,4)+'-04-01',unit,value:r.values[i],dims:{fuel,flow:r.flow}}))));
  groups.push({slug:`energy-report-transformation-${unit}-${seam}`,rows,meta:{source:'MoSPI, Energy Statistics India 2025 balance tables',sourceUrl:report.url,product:'energy-report-transformation',frequency:'annual',calendar:'fiscal-apr',unit,rawFile:reportFile,note:'Report-only transformation, energy-industry own use, losses and statistical differences. Whole-number report precision, separate from decimal API cells. Coal includes lignite before the published split; instruments remain separate. Inputs negative and outputs positive; source identities may contain discrepancies.'}});
 }
 const wbFile='data/raw/energy-report-2026-workbook-rows.json',wb=readRaw(root,wbFile),wg=new Map();
 for(const [tag,sheets] of Object.entries(wb.tables))for(const sheet of sheets){
  const title=clean(sheet.rows[0][0]),year=title.match(/20\d\d-\d\d/)?.[0];if(!year)throw Error('Workbook year missing');
  const commodity=/Commodity/i.test(title),petroleum=/Petroleum Products/i.test(title);
  const hi=sheet.rows.findIndex(row=>row.some(x=>clean(x)===(petroleum?'LPG':'Coal')));if(hi<0)throw Error('Workbook named fuel header missing');
  const headers=sheet.rows[hi];const columns=headers.map((v,i)=>({fuel:clean(v),i})).filter(c=>c.i>0&&c.fuel&&!/^-?\d/.test(c.fuel));
  let sector='',end=false;
  for(const row of sheet.rows.slice(hi+1)){
   const flow=clean(row[0]);if(commodity && /Industry|Transport|Other Sectors/.test(flow) && flow.length<30)sector=flow;if(!flow||(!columns.some(c=>typeof row[c.i]==='number')&&!['Transfer','Other energy sector'].includes(flow)))continue;
   if(/Final consumption refers|Statistical Difference is defined/.test(flow))break;
   if(['Industry','Transport','Other Sectors','Other','Final consumption'].includes(flow))sector=flow;
   for(const c of columns){const isOutput=/^Elec(t\.| output)/i.test(flow);const unit=commodity?(c.fuel==='Natural Gas'?'mmscm':c.fuel==='Electricity'?'gwh':'thousand_tonnes'):isOutput?(sheet.rows.flat().some(x=>/All figures in Peta/i.test(clean(x)))?'source_scaled_gwh':'gwh'):sheet.rows.flat().some(x=>/All figures in Peta/i.test(clean(x)))?'pj':'ktoe';
    const kind=commodity?'commodity':petroleum?'petroleum':'balance',id=`energy-report-2026-${kind}-${unit.replaceAll('_','-')}`,arr=wg.get(id)??{slug:id,rows:[],meta:{source:'MoSPI, Energy Statistics India 2026, original Excel tables',sourceUrl:wb.sources[tag].url,product:'energy-report-2026-'+kind,frequency:'annual',calendar:'fiscal-apr',unit,rawFile:wbFile,note:'2026 report edition; revised historical balances kept separate from the 2025 API edition. Workbook precision retained without rounding source cells. Latest year provisional. Nested totals overlap parts; blanks are unpublished, not zeros. Bunkers have source sign/total inconsistencies disclosed by validation. PJ electricity-output rows are scaled despite GWh headings and are audit-only.'}};
    arr.rows.push({date:year.slice(0,4)+'-04-01',unit,value:parseNumber(row[c.i]),dims:{fuel:c.fuel,flow,sector:commodity?sector:''}});wg.set(id,arr);
   }
  }
 }
 groups.push(...wg.values());
 return partitionEnergyGeography(groups).map(g=>({...g,meta:{...g.meta,...energyVintageProvenance(root,g)}}));}
export async function buildEnergy(root){const bundles=[],items=[];fs.writeFileSync(path.join(root,'data/coverage/energy.fuel-definition-evidence.json'),JSON.stringify(energyFuelEvidence(root),null,2)+'\n');
 for(const g of energySourceGroups(root)){g.meta.base=g.slug.startsWith('energy-mospi-')?'MoSPI API 2025 balance, '+g.meta.fuelInstrument:g.slug.startsWith('energy-report-transformation-')?'MoSPI report 2025 transformation, '+(g.slug.endsWith('coal-includes-lignite')?'coal-includes-lignite':'coal-lignite-separate'):g.slug.startsWith('energy-report-2026-')?'Energy Statistics India 2026 edition':g.slug.startsWith('energy-ember-national-')?'Ember national electricity API, calendar-year estimates':'Ember India subnational electricity release, '+g.meta.geographicInstrument;const {bundle,empty}=cube(g.rows,g.meta);if(!Object.keys(bundle.series).length)throw Error('Empty energy bundle '+g.slug);writeSeries(root,`data/series/${g.slug}.json`,bundle);bundles.push({slug:g.slug,rows:g.rows.length,nonNull:g.rows.filter(r=>r.value!==null).length,series:Object.keys(bundle.series).length,emptySeries:empty.length});for(const [key,s] of Object.entries(bundle.series))items.push({id:g.slug+':'+key,label:s.label,dims:s.dims,bundle:g.slug,series:key});for(const s of empty)items.push({id:g.slug+':empty:'+s.key,label:s.label,dims:s.dims,empty:true});}
 writeCatalogue('energy',{source:'MoSPI complete observed balances and Ember original national/state release tables',generator:'scripts/lib/products/energy.mjs',items});fs.writeFileSync(path.join(root,'data/coverage/energy.manifest.json'),JSON.stringify({bundles,sourceRows:bundles.reduce((n,b)=>n+b.rows,0),note:'Catalogue enumerates observed source dimensions, never invented Cartesian combinations.'},null,1)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildEnergy(process.cwd());
