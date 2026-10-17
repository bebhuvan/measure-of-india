// Full NSS77 observed cubes. No averages of state ratios, no Cartesian fill.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readRaw,writeSeries,writeRaw,rawExists,splitEmptySeries} from '../util.mjs';
import {parseNumber} from '../tabular.mjs';
import {mospi,mospiAll} from '../mospi.mjs';
import {writeCatalogue} from '../catalogue.mjs';
import {farmApiProvenance} from '../farm-households-provenance.mjs';
import {LABEL_CORRECTIONS,correctFarmRow,correctionNote,reconcileFarmLabels} from '../farm-households-corrections.mjs';
// Why a source cell is withheld, and the id segment its catalogue item carries.
export const WITHHELD={'API repeats Andhra Pradesh cells under every state':'repeated-state','API category labels conflict with the report':'label-conflict','rate exceeds its per-thousand base':'over-base','parenthesised source cell':'parenthesised','no figure published':'no-figure'};
export const REPORT_URL='https://www.mospi.gov.in/sites/default/files/publication_reports/Report_587m_0.pdf';
export const CODES=[16,17,18,19,21,22,23,24,25,26,27,28,29,31,32,33,34,35,36,37,39,40,41,42,43,44,45,46,47,48,49,50,51];
export const clean=x=>x==null?'Not applicable':String(x).trim().replace(/\s+/g,' ');
export const keyOf=d=>'c_'+crypto.createHash('sha256').update(JSON.stringify(Object.entries(d).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,24);
export const dimensions=r=>Object.keys(r).filter(k=>!['indicator','value'].includes(k)).sort();
export function sourceValue(v){if(/^\s*\([^)]*\)\s*$/.test(String(v)))return null;return parseNumber(v);}
export function farmUnit(code,r){
 if(code===18&&r['Land_Possessed(hectares)']==null)return 'hundreds';
 const measure=clean(r.sub_indicator??r.ownership_holding_area??r.terms_lease??r.loan_outstanding??r.expenses_recipt??r.receipts_type??r.major_disposal??r.major_procurement??r.possession),heading=clean(r.indicator);
 if(/Average Sale Rate Received/.test(measure))return 'source_sale_rate';
 if(/Percentage of Output/.test(measure))return 'pct';
 if(/Yield Rate/.test(measure))return r.crop==='Coconut'?'count_per_ha':'kg_per_ha';
 if(code===42&&/Average Per Household/.test(measure)){
  if(/Gross Cropped Area/.test(r.harvested))return 'ha';
  if(/Value of/.test(r.harvested))return 'inr';
  return r.crop==='Coconut'?'count':'kg';
 }
 if(/Average Household Size/.test(measure))return 'count_per_household';
 if(/Area|area/.test(measure)&&!/per 1000/i.test(measure))return /000 ha/.test(measure)?'thousand_ha':'ha';
 if(/per\s*1000/i.test(measure)||/Distribution/.test(measure)&&![37,40].includes(code))return 'per_1000';
 if([16,17].includes(code)||code===18&&r.household_employment==='Number of Households')return 'hundreds';
 if(code===19)return /No\. of Parcels|No\. of Crops/.test(measure)?'count_per_holding':'per_1000';
 if([24,25,26,27,28,29,31,32].includes(code)||code===33&&/Average Amount/.test(measure))return 'inr';
 if([37,40].includes(code))return 'pct';
 if([18,21,22,23,33,39,41,43,44,45,46,47,48,49,50,51].includes(code))return 'per_1000';
 throw Error(`Unresolved farm unit ${code}: ${measure} / ${heading}`);
}
// r is the raw API row after correctFarmRow; changes are its label corrections (kept in the note).
export function farmCell(code,r,dims,changes=[]){
 const d=Object.fromEntries(dims.map(k=>[k,clean(r[k])])),key=keyOf(d),value=sourceValue(r.value);
 const warnings=[];
 const corrected=correctionNote(code,changes);if(corrected)warnings.push(corrected);
 if(code===33)warnings.push('API repeats Andhra Pradesh debt cells under every state; quarantined from numerical interpretation, report29 is the replacement.');
 if(code===21&&sourceValue(r.value)>1000)warnings.push('Source rate exceeds its per-thousand base; confirmed in official report Table 13A and quarantined as a source inconsistency.');
 if(code===47)warnings.push('API MSP category labels conflict with the report; not used for interpreted category comparisons.');
 if(/^\s*\(/.test(String(r.value)))warnings.push('Parenthesised source cell withheld from numerical interpretation pending report reconciliation. Original source value preserved.');
 const quarantined=code===33||code===47||code===21&&value>1000;
 const withheld=quarantined?(code===33?'API repeats Andhra Pradesh cells under every state':code===47?'API category labels conflict with the report':'rate exceeds its per-thousand base'):/^\s*\(/.test(String(r.value))?'parenthesised source cell':value==null?'no figure published':null;
 const label=dims.map(k=>k.replaceAll('_',' ')+': '+d[k]).join('; ');
 return [key,{name:`nss77_${code}_${key}`,label,unit:farmUnit(code,r),dims:d,state:d.state,group:dims.filter(k=>k!=='state').map(k=>d[k]).join(', '),data:[quarantined?null:value],sourceValue:String(r.value),...(warnings.length?{note:warnings.join(' ')}:{}),...(withheld?{withheld}:{})}];
}
export async function buildFarmHouseholds(root,dcfg={},archiveCapturedDate=new Date().toISOString().slice(0,10)){
 const bundles=[],items=[];let sourceRows=0;
 // API tables whose labels are corrected must match the printed report cell for cell first.
 const reconciliation=reconcileFarmLabels(readRaw(root,'data/raw/farm-households-report.json').text,Object.fromEntries(Object.keys(LABEL_CORRECTIONS).map(c=>[c,readRaw(root,`data/raw/profiles-mospi/nss77-0-${c}.json`).rows])));
 const list=readRaw(root,'data/raw/farm-households-list-1.json').body.data;
 if(list.length!==CODES.length||list.some(x=>!CODES.includes(+x.indicator_code)))throw Error('Farm source listing changed');
 for(const code of CODES){
  const rel=`data/raw/profiles-mospi/nss77-0-${code}.json`;
  if(!rawExists(root,rel)){
   if(process.env.FARM_HOUSEHOLDS_FROM_RAW==='1')throw Error(`Missing offline farm archive ${code}`);
   const rows=await mospiAll('nss-77/getNss77Records',{indicator_code:code});writeRaw(root,rel,{vintage:archiveCapturedDate,archiveCapturedDate,indicator:{code,expected:rows.length},rows});
  }
  const raw=readRaw(root,rel),provenance=farmApiProvenance(root,rel,raw),fixed=raw.rows.map(r=>correctFarmRow(code,r)),dims=dimensions(fixed[0].row),cells=new Map();
  if(raw.rows.length!==raw.indicator.expected)throw Error('Incomplete farm source '+code);
  for(const {row:r,changes} of fixed){const [key,s]=farmCell(code,r,dims,changes);if(cells.has(key))throw Error('Duplicate farm cell '+code+' '+key);cells.set(key,s);}
  sourceRows+=raw.rows.length;
  // Cells with no usable figure are catalogued as withheld, with the reason, never baked as empty series.
  const {kept,empty}=splitEmptySeries(Object.fromEntries(cells));
  for(const [key,s] of Object.entries(empty))items.push({id:`farm-households-nss77-${code}:withheld:${WITHHELD[s.withheld??'no figure published']}:${key}`,bundle:null,series:key,withheld:s.withheld??'no figure published',sourceValue:s.sourceValue});
  const sorted=Object.entries(kept).map(([k,s])=>{delete s.withheld;return [k,s];}).sort(([a],[b])=>a.localeCompare(b));
  // Chunking protects the renderer/download file budget; no statistical selection.
  for(let start=0;start<sorted.length;start+=8000){
   const slug=`farm-households-nss77-${code}-${String(start/8000+1).padStart(2,'0')}`,series=Object.fromEntries(sorted.slice(start,start+8000));
   const b={meta:{dossier:'farm-households',product:`farm-households-nss77-${code}`,source:'MoSPI, NSS 77 Situation Assessment and Land and Livestock Holdings',sourceUrl:REPORT_URL,base:'NSS 77, Schedule 33.1, rural India',frequency:'cross-sectional',unit:'see each series',...provenance,geo:'IND',latestPeriod:'July 2018–June 2019; seasonal/visit references in each cell',releaseDate:'2021-09-10',revisionPolicy:'Published survey estimates; changed source bodies must be archived before rebaking.',coverage:raw.indicator.label??raw.rows[0].indicator,dimensions:dims,rawFile:rel,indicator:{code,sourceRows:raw.rows.length},...(reconciliation[code]?{labelCorrection:{reportTable:'Report 587 Table '+LABEL_CORRECTIONS[code].table,...reconciliation[code],method:'Corrected labels replayed against the printed table by state, social group, classification, season, class and column; every matched cell agrees. Unmatched rows are classes or geographies the report prints on pages the parser does not read.'}}:{}),note:'Historical rural survey. Agricultural-household measures exclude wage-only households; land/livestock tables also include all/non-agricultural rural households where labelled. Annual and half-year season/visit references remain separate dimensions; the shared endpoint is an indexing date, not a universal observation date. Means may condition on activity/reporting. Source zeros retained; dashes and unresolved parenthesised cells null, with original value attached. All observed cross-tabs retained; no Cartesian expansion or state averaging. MSP category labels have known API defects. Tables 18, 19, 34, 36 and 39 carry corrected API labels (household classification swap, Himachal Pradesh social groups, leasing-in, cattle and buffalo in milk, visit-1 season), each proven against the printed report; original API labels are in each series note.'},dates:['2019-06-30'],series};
   writeSeries(root,`data/series/${slug}.json`,b);bundles.push({slug,code,series:Object.keys(series).length,rawFile:rel});
   for(const key of Object.keys(series))items.push({id:slug+':'+key,bundle:slug,series:key});
  }
 }
 if(sourceRows!==471001)throw Error('NSS77 archive count changed; review complete listing');
 // Chunks are rewritten whole: a chunk this run no longer writes (all its cells withheld, or the
 // table shrank) must not linger in data/series as a stale canonical bundle.
 const written=new Set(bundles.map(b=>b.slug+'.json'));
 for(const f of fs.readdirSync(path.join(root,'data/series')))if(/^farm-households-nss77-\d+-\d+\.json$/.test(f)&&!written.has(f)){fs.rmSync(path.join(root,'data/series',f));console.log('removed stale chunk',f);}
 const {buildFarmReport}=await import('../../farm-households-report.mjs');
 const reportBundles=buildFarmReport(root);bundles.push(...reportBundles);
 for(const it of reportBundles){const b=JSON.parse(fs.readFileSync(path.join(root,'data/series/'+it.slug+'.json')));for(const key of Object.keys(b.series))items.push({id:it.slug+':'+key,bundle:it.slug,series:key});}
 writeCatalogue('farm-households',{source:'MoSPI NSS77 complete observed archived cubes, all 33 listed visualisation indicators',generator:'scripts/lib/products/farm-households.mjs',note:'API visualisation inventory; report and non-visualisation tables require separate accounting.',items});
 fs.writeFileSync(path.join(root,'data/coverage/farm-households.manifest.json'),JSON.stringify({sourceIndicators:CODES.length,sourceRows,labelCorrections:reconciliation,bundles},null,1)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildFarmHouseholds(process.cwd());
