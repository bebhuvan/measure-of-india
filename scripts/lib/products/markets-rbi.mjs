// Offline, publication-aware RBI listed-company adapter. Never invokes RBI or Data Bank writes.
// Read docs/reference/markets-rbi.md for source semantics and overlap decisions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { databankRoot, databankQuery } from '../databank.mjs';
import { parseCsv } from '../tabular.mjs';
import { writeRaw, readRaw, writeSeries } from '../util.mjs';
import { assemble, emit, ser, slug, num, quarterStartOfEnd } from './markets-lib.mjs';
import { LISTED_TABLES } from './markets-hub.mjs';
import { writeCatalogue, idPart } from '../catalogue.mjs';
import YAML from 'yaml';
import { marketsRbiSlices } from '../../../src/dossiers/markets-rbi.model.js';

export const REPORTS = {1067:['q',null],1117:['q','sector'],1072:['q','industry'],1071:['q','sales'],1069:['q','puc'],1074:['a',null],1118:['a','sector'],1073:['a','industry'],1070:['a','sales'],1068:['a','puc']};
const DIM = {sector:'ind_clasf_rn',industry:'inds_grp_rn',sales:'sale_sz_cls_rn',puc:'puc_cls_rn'};
const LAB = {sector:'Industry Wise classification',industry:'Industry Group',sales:'Sales Size Class',puc:'PUC Class'};
const ITEM = {'11':'SALES','22':'VAL_OF_PROD','33':'EXPD','44':'EXPD_RAW_MATR','55':'EXPD_STAFF_COST','66':'EXPD_PNF','77':'OPR_PFT','88':'OTH_INC','89':'EBITDA','99':'DEPRC','111':'GROSS_PFT_EBIT','121':'INT','131':'EBT_BEFORE_NOP','141':'TAX_PROV','151':'NET_PFT','161':'CORM_TO_SAL','171':'SC_TO_SAL','181':'INT_BURDEN','191':'TAX_PROV_TO_EBT','201':'OTH_INC_NET_PFT','210':'CSH_CVG_RATIO','211':'INT_TO_SAL','221':'INT_CVG','230':'OPR_PFTS_TO_SAL','231':'EBITDA_TO_SAL','241':'EBIT_TO_SAL','251':'NET_PFT_TO_SAL','32':'PUC_SHARE','34':'SAL_SHARE','-97':'PC_SHARE_SAL','-98':'SALES','-99':'companies'};
const shares = new Set(['PUC_SHARE','SAL_SHARE','PC_SHARE_SAL']);
const times = new Set(['CSH_CVG_RATIO','INT_CVG']);
const norm = s => String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const alias = s => ({'it computer software and related services':'services it','services other than it':'services non it','precious and non ferrous metals':'precious and non ferrous metals'}[norm(s)]??norm(s));
const pick = (o,...keys) => keys.map(k=>o[k]).find(v=>v!=null && String(v).trim()!=='');
const tableMeta = Object.fromEntries(LISTED_TABLES.map(([table,kind,cut,f])=>[table.toUpperCase(),{table,kind,cut,f}]));
export function periodStart(text,f) {
 let m=/^(\d{4})-\d{2}(?::Q([1-4]))?$/.exec(String(text).trim());
 if(!m){const n=/^Q([1-4])\.(\d{4})-\d{2}$/.exec(String(text).trim());if(n)m=[n[0],n[2],n[1]];}
 if(!m)throw Error(`markets-rbi: invalid period ${text}`);
 const y=+m[1],q=f==='a'?1:+m[2]; if(!q)throw Error(`quarter missing: ${text}`);
 return `${q===4?y+1:y}-${String([4,7,10,1][q-1]).padStart(2,'0')}-01`;
}
export function cleanValue(value,{source,measure,item,zeroBlock=false}={}) {
 const v=num(value);if(v==null)return {value:null,reason:'source missing or non-numeric'};
 if(source==='report' && Math.abs(v)===999999999)return {value:null,reason:'DBIE not-meaningful sentinel 999999999'};
 if(measure==='share' && (v<0 || v>100.05))return {value:null,reason:'Published share outside conventional 0–100 range; denominator/population comparability unverified. Isolated from comparable share series; exact source value retained, not clamped'};
 if(source==='cas' && measure==='amount' && zeroBlock)return {value:null,reason:'CAS whole cut-period amount vector zero-filled'};
 if(source==='cas' && measure==='growth' && item==='EXPD_OTH' && Math.abs(v)>=1e6)return {value:null,reason:'CAS rupee amount mislabelled as growth'};
 return {value:v,reason:null};
}
const cellKey = x => [x.f,x.cut??'all',x.groupCode??'all',x.item,x.measure,x.date].join('|');
const bundleName = x => `markets-listed-${x.f}${x.cut?'-'+x.cut:''}${x.measure==='ratio'?'-ratios':''}${x.measure==='amount'?'-levels':''}`;
const seriesKey = x => `${x.groupCode?slug(x.groupCode,30)+'__':''}${slug(x.item)}`;
export function deduplicatePublished(rows,fields) {
 const m=new Map();for(const r of rows){const k=fields.map(f=>r[f]).join('|');const old=m.get(k);if(!old||r.source_retrieved_at>old.source_retrieved_at)m.set(k,r);else if(r.source_retrieved_at===old.source_retrieved_at && (r.record_json!==old.record_json || r.value_text!==old.value_text))throw Error(`publication tie disagrees: ${k}`);}return [...m.values()];
}
export function normalizeSources(casRows,reportRows) {
 const labels=new Map(), groupMaps=new Map(), metadata=new Map(), quarantine=[],cas=[],reports=[];
 const amountGroups=new Map();
 for(const r of casRows){const t=tableMeta[r.dsd_code];if(!t)throw Error(`Unknown corporate element ${r.dsd_code}`);const c=JSON.parse(r.dimension_codes_json),l=JSON.parse(r.dimension_labels_json);const item=c.perf_ind_rn??c.typ_ratio_rn,g=t.cut?c[DIM[t.cut]]:null;
  const gl=t.cut?l[LAB[t.cut]]:null;labels.set(`${t.kind}|${item}`,l['Performance Indicators']??l['Type of Ratios']);
  if(t.cut){const k=`${t.f}|${t.kind}|${t.cut}|${alias(gl)}`;if(groupMaps.has(k)&&groupMaps.get(k)!==g)throw Error(`Ambiguous group label ${k}`);groupMaps.set(k,g);metadata.set(`${t.f}|${t.kind}|${t.cut}|${g}`,{group:gl==='Others'?`${l[LAB[t.cut]+'_Level1']}: Others`:gl,parent:l[LAB[t.cut]+'_Level1']??null});}
  const date=t.f==='a'?`${+r.observation_date.slice(0,4)-1}-04-01`:quarterStartOfEnd(r.observation_date);
  let measure=t.kind==='ratio'?'ratio':shares.has(item)?'share':r.unit_code==='INR'?'amount':'growth';
  const x={...t,date,groupCode:g,group:t.cut?metadata.get(`${t.f}|${t.kind}|${t.cut}|${g}`).group:null,item,label:labels.get(`${t.kind}|${item}`),measure,rawValue:r.value_text,companies:num(l['Company Count']),source:'cas',artifact:r.source_artifact_id,retrieved:r.source_retrieved_at,dsd:r.dsd_code};
  if(measure==='amount'){const k=[t.f,t.cut,g,date].join('|');if(!amountGroups.has(k))amountGroups.set(k,[]);amountGroups.get(k).push(x);}cas.push(x);
 }
 const amountFamilies=new Map();for(const xs of amountGroups.values())for(const x of xs){const k=[x.f,x.cut,x.date].join('|');if(!amountFamilies.has(k))amountFamilies.set(k,[]);amountFamilies.get(k).push(x);}
 const zero=new Set([...amountGroups].filter(([,xs])=>xs.every(x=>num(x.rawValue)===0)&&(xs.length>=2||amountFamilies.get([xs[0].f,xs[0].cut,xs[0].date].join('|')).every(x=>num(x.rawValue)===0))).map(([k])=>k));
 for(const x of cas){const clean=cleanValue(x.rawValue,{...x,zeroBlock:zero.has([x.f,x.cut,x.groupCode,x.date].join('|'))});Object.assign(x,clean);if(clean.reason)quarantine.push({...x});}
 let auxiliary=0,displayDuplicates=0;
 for(const r of reportRows){const def=REPORTS[r.report_id];if(!def)throw Error(`Unreviewed report ${r.report_id}`);const [f,cut]=def,o=JSON.parse(r.record_json);
  if(!('Amount' in o)&&!('Item Value' in o)&&!('Copy of Item Value' in o)){auxiliary++;continue;}
  if(o.Unit && o.Unit!=='1'){displayDuplicates++;continue;}
  const code=String(pick(o,'Item Code',...Object.keys(o).filter(k=>k.endsWith('.Item Code')))??'').trim();let item=ITEM[code];if(!item)throw Error(`Unknown report item ${r.report_id} ${code}`);
  const part=String(o['Item Part A B Flag']??'').trim(),kind=part==='B'?'ratio':'perf';
  let measure=item==='companies'?'count':kind==='ratio'?'ratio':shares.has(item)?'share':(pick(o,'Dim Item Account Amount.Item Description','Item Description')==='Amount'||code==='-98')?'amount':'growth';
  // The industry share uses -97; its plain label is checked independently below.
  const il=pick(o,'Dim Csd Indicator 1ab 2ab 3ab 4ab 5ab.Item Description','Item Hierarchy Level 2','Item Hierarchy Level 1');
  if(/per cent share in sales/i.test(il??'')){item='PC_SHARE_SAL';measure='share';}
  const group=pick(o,'Csd Industry Name','Puc Sales Class Description');const groupCode=cut?groupMaps.get(`${f}|${kind}|${cut}|${alias(group)}`):null;
  if(cut&&!groupCode)throw Error(`Unmapped group ${r.report_id}: ${group} (${kind})`);
  const date=periodStart(f==='a'?o.Year:pick(o,'Fiscal Quarter','Quater 3a 3b','Time Fis Quarter Year'),f);
  const x={f,cut,kind,date,groupCode,group:cut?metadata.get(`${f}|${kind}|${cut}|${groupCode}`)?.group:null,item,label:item==='companies'?'number of companies in the period':labels.get(`${kind}|${item}`)??il,measure,rawValue:pick(o,'Amount','Item Value','Copy of Item Value'),companies:num(pick(o,'No Of Companies','No Of Companies_average','No Of Companies avg','No Of Companies Average')),source:'report',report:r.report_id,prompt:r.prompt_answer.trim(),provider:r.dataprovider_id,row:r.row_no,artifact:r.source_artifact_id,retrieved:r.source_retrieved_at};
  Object.assign(x,cleanValue(x.rawValue,x));if(x.reason)quarantine.push({...x});reports.push(x);
 }
 for(const xs of [cas,reports])for(const x of xs){
  if(x.measure!=='share'||!x.reason?.startsWith('Published share'))continue;
  const denominator=xs.find(y=>y.f===x.f&&y.cut===x.cut&&y.groupCode===x.groupCode&&y.date===x.date&&y.measure==='amount'&&y.item==='SALES'&&(x.source==='cas'||(y.artifact===x.artifact&&y.prompt===x.prompt)));
  if(denominator&&denominator.companies!==x.companies){
   x.reason='Noncomparable published sales share: share and available sales denominator use different company counts. Exact source value retained in raw/quality evidence; isolated from comparable share series, not clamped.';
   x.sharePopulationEvidence={shareCompanies:x.companies,salesCompanies:denominator.companies,salesAmount:denominator.value,salesArtifact:denominator.artifact,salesRow:denominator.row??null};
   for(const defect of quarantine)if(cellKey(defect)===cellKey(x)&&defect.artifact===x.artifact&&defect.row===x.row){defect.reason=x.reason;defect.sharePopulationEvidence=x.sharePopulationEvidence;}
  }
 }
 return {cas,reports,quarantine,auxiliary,displayDuplicates,metadata};
}
// CAS aggregates with SUM. A ratio whose source mirror has duplicate dimension keys
// cannot be treated as a source revision. Preserve the inherited mirror selection, disclose
// its ambiguity, and let an unambiguous official report supersede it where available.
export function preserveAmbiguousRatioHistory(parsed,mirror) {
 const groups=new Map(), inherited=[], defects=[];
 for(const t of mirror.listed){if(!t.table.startsWith('ratio_'))continue;const csv=parseCsv(t.csv,','),head=csv.shift();for(const row of csv){const r=Object.fromEntries(head.map((k,i)=>[k,row[i]]));if(!r.time_period)continue;const k=[t.table.toUpperCase(),Object.keys(r).filter(k=>['typ_ratio_rn','ind_clasf_rn','inds_grp_rn','puc_cls_rn','sale_sz_cls_rn','unit_measure'].includes(k)).sort().map(k=>`${k}=${r[k]}`).join('|'),r.time_period.slice(0,10)].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}}
 for(const x of parsed.cas){if(x.measure!=='ratio')continue;const t=tableMeta[x.dsd],dim={typ_ratio_rn:x.item,unit_measure:'RPT',...(x.cut?{[DIM[x.cut]]:x.groupCode}:{})};const end=x.f==='a'?`${+x.date.slice(0,4)+1}-03-31`:new Date(Date.UTC(+x.date.slice(0,4),+x.date.slice(5,7)+2,0)).toISOString().slice(0,10);const k=[x.dsd,Object.keys(dim).sort().map(d=>`${d}=${dim[d]}`).join('|'),end].join('|'),rows=groups.get(k);if(!rows||rows.length<2)continue;
  const values=rows.map(r=>num(r.obs_value));if(values.some(v=>v==null))throw Error(`Non-numeric duplicate ratio ${k}`);const sum=values.reduce((a,b)=>a+b,0);if(Math.abs(sum-x.value)>1e-8)throw Error(`Duplicate ratio does not reconcile to CAS SUM ${k}`);
  const defect={key:cellKey(x),casValue:x.value,mirrorValues:values,mirrorSourceLines:rows.map(r=>r.src_line),retainedInheritedValue:values.at(-1),reason:'CAS SUM of duplicate non-additive ratios. Existing Atlas inherited last mirror row; retained with ambiguity disclosure pending historical official report.'};defects.push(defect);parsed.quarantine.push({...x,reason:defect.reason});x.value=null;x.reason=defect.reason;
  inherited.push({...x,value:values.at(-1),reason:null,source:'mirror_inherited',artifact:'markets-hub.json.gz',ambiguity:defect,mirrorSourceLine:rows.at(-1).src_line});
 }
 parsed.cas.push(...inherited);return defects;
}
export function reconcileSources(parsed) {
 const cells=new Map(),overlap=[],conflicts=[],reportDuplicates=[];
 for(const x of parsed.cas)cells.set(cellKey(x),x);
 // Prefer the newest prompt's restatement of an observation, then retrieval time.
 const reports=[...parsed.reports].sort((a,b)=>a.prompt.localeCompare(b.prompt)||a.retrieved.localeCompare(b.retrieved));
 for(const x of reports){const k=cellKey(x),prev=cells.get(k);
  if(prev&&prev.value!=null&&x.value!=null){const tolerance=x.measure==='growth'?0.050001:Math.max(1e-6,1e-6*Math.abs(x.value));const gap=Math.abs(prev.value-x.value);const e={key:k,oldSource:prev.source,old:prev.value,new:x.value,gap,tolerance,companiesOld:prev.companies,companiesNew:x.companies,report:x.report,artifact:x.artifact};if(prev.source==='cas'||prev.source==='mirror_inherited'){overlap.push(e);if(gap>tolerance)conflicts.push(e);}else if(gap>tolerance)reportDuplicates.push(e);}
  // A meaningful official report cell supersedes CAS/mirror; an explicit report omission
  // also wins over CAS's conflicting value, so missing never silently acquires a fallback.
  cells.set(k,x);
 }
 if(conflicts.length)throw Error(`CAS/report mapping conflict: ${conflicts.length}/${overlap.length}`);
 return {cells,overlap,conflicts,reportDuplicates};
}
function archiveLineage(dbroot,rows) {
 const wanted=new Set(rows.map(r=>r.source_artifact_id)),out=[];
 for(const ds of ['rbi_dbie_cas_money','rbi_dbie_webi_prompted_rows']){const base=path.join(dbroot,'data/raw/metadata/rbi_dbie',ds);for(const run of fs.readdirSync(base)){const dir=path.join(base,run);if(!fs.statSync(dir).isDirectory())continue;for(const f of fs.readdirSync(dir)){if(!f.endsWith('.json'))continue;const j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(!wanted.has(j.artifact_id))continue;const digest=crypto.createHash('sha256').update(fs.readFileSync(j.content_path)).digest('hex');if(digest!==j.sha256)throw Error(`Raw lineage SHA mismatch ${j.artifact_id}`);out.push({dataset:ds,artifact:j.artifact_id,sha256:j.sha256,retrieved:j.retrieved_at,source_url:j.url??j.source_url,content_path:j.content_path,metadata_path:path.join(dir,f),bytes:fs.statSync(j.content_path).size});wanted.delete(j.artifact_id);}}}
 if(wanted.size)throw Error(`${wanted.size} published artifacts lack verified raw lineage`);return out;
}
export function marketsRbiCoverage(name,series) {
 const match=/^markets-listed-([qa])(?:-(sector|industry|puc|sales))?(?:-(?:ratios|levels))?$/.exec(name);
 if(!match)throw Error(`Unknown listed-company coverage dimension: ${name}`);
 const frequency=match[1]==='q'?'Quarterly':'Annual';
 const group={sector:' by manufacturing, IT and other services',industry:' by industry',puc:' by paid-up capital size',sales:' by sales size'}[match[2]]??'';
 const measures=new Set(Object.values(series).map(s=>s.measure));
 const descriptions=[];
 if(measures.has('amount'))descriptions.push('rupee totals for the companies reporting in each period');
 if(measures.has('growth'))descriptions.push('growth on a year earlier for the same companies');
 if(measures.has('share')){
  const items=new Set(Object.values(series).filter(s=>s.measure==='share').map(s=>s.itemCode));
  descriptions.push(items.has('PUC_SHARE')?'shares of paid-up capital':'shares of sales');
 }
 if(measures.has('ratio'))descriptions.push('profit margins, interest coverage and other financial ratios');
 if(measures.has('count'))descriptions.push('reporting-company counts');
 if(!descriptions.length)throw Error(`No published measures for coverage: ${name}`);
 const measuresText=descriptions.length===1?descriptions[0]:descriptions.slice(0,-1).join(', ')+' and '+descriptions.at(-1);
 return `${frequency} results of listed non-government non-financial companies${group}: ${measuresText}.`;
}

export function marketsRbiVintage(cas,report) {
 const captures=[...cas,...report].map(r=>r.source_retrieved_at?.slice(0,10)).filter(Boolean).sort();
 return {
  vintage:null,
  vintageStatus:'unknown',
  vintageNote:'The archived RBI CAS and prompted report exports do not publish a source revision timestamp. Archive capture is recorded separately and does not establish when estimates were revised.',
  archiveCapturedDate:captures.at(-1)??null,
 };
}

export async function buildMarketsRbi(root,dcfg,VINTAGE,cfg,{replay=false,cache=null}={}) {
 let cas,report,provenance;
 if(replay){const a=readRaw(root,'data/raw/markets-rbi-cas.json');cas=a.rows;provenance=a.provenance;report=Object.keys(REPORTS).flatMap(id=>readRaw(root,`data/raw/markets-rbi-report-${id}.json`).rows);}
 else {
  const dbroot=databankRoot(cfg.families.databank);
  const query=(ds,sql)=>cache?JSON.parse(fs.readFileSync(path.join(cache,`markets-rbi-${ds}.json`),'utf8')):databankQuery(dbroot,ds,sql);
  const a=query('rbi_dbie_cas_money',"SELECT DISTINCT * FROM {table} WHERE domain_group='corporate' ORDER BY dsd_code, series_key, observation_date");
  const b=query('rbi_dbie_webi_prompted_rows','SELECT DISTINCT * FROM {table} ORDER BY report_id, prompt_answer, dataprovider_id, row_no');
  cas=deduplicatePublished(a.rows,['dsd_code','series_key','observation_date']);report=deduplicatePublished(b.rows,['report_id','prompt_answer','dataprovider_id','row_no']);
  provenance={casQuery:a.provenance,reportQuery:b.provenance,queriedCas:a.rows.length,queriedReports:b.rows.length,lineage:archiveLineage(dbroot,[...cas,...report])};
  const vintageMeta=marketsRbiVintage(cas,report);
  writeRaw(root,'data/raw/markets-rbi-cas.json',{...vintageMeta,rows:cas,provenance});
  for(const id of Object.keys(REPORTS))writeRaw(root,`data/raw/markets-rbi-report-${id}.json`,{...vintageMeta,rows:report.filter(r=>r.report_id===id)});
 }
 if(new Set(cas.map(r=>r.dsd_code)).size!==20||new Set(report.map(r=>r.report_id)).size!==10)throw Error('Incomplete reviewed source family');
 const parsed=normalizeSources(cas,report);const duplicateRatioDefects=preserveAmbiguousRatioHistory(parsed,readRaw(root,'data/raw/markets-hub.json'));
 const reconciled=reconcileSources(parsed),bundles=new Map(),catalogue=new Map();
 for(const x of reconciled.cells.values()){
  const name=bundleName(x),key=seriesKey(x);if(!bundles.has(name))bundles.set(name,new Map());
  const unit=x.measure==='amount'?'inr_crore':x.measure==='count'?'count':times.has(x.item)?'times':'pct';
  const what=x.measure==='amount'?`${x.label}, ₹ crore (this period's companies)`:x.measure==='growth'?`${x.label}: growth on a year earlier, same companies`:x.measure==='share'?`${x.label} (share, per cent)`:x.label;
  const init={label:`${x.group?x.group+': ':''}${what}`,unit,...(x.group?{group:x.group}:{}),measure:x.measure,itemCode:x.item,groupCode:x.groupCode,sourceByDate:{}};
  const s=ser(bundles.get(name),key,init);s.values.set(x.date,x.value==null?null:x.measure==='amount'?Math.round(x.value/1e5)/100:x.value);
  s.sourceByDate[x.date]={source:x.source,artifact:x.artifact,...(x.source==='report'?{report:x.report,prompt:x.prompt,provider:x.provider,row:x.row}: {dsd:x.dsd}),companies:x.companies,...(x.sharePopulationEvidence?{sharePopulationEvidence:x.sharePopulationEvidence,reportedValue:num(x.rawValue)}:{}),...(x.ambiguity?{ambiguity:x.ambiguity,mirrorSourceLine:x.mirrorSourceLine}:{}),...(x.reason?{omission:x.reason}:{})};
  const id=`rbi:listed:${x.f}:${x.cut??'all'}:${idPart(x.groupCode??'all')}:${idPart(x.item)}:${x.measure}`;
  catalogue.set(id,{id,label:init.label,dims:{frequency:x.f,cut:x.cut??'all',group:x.groupCode??'all',item:x.item,measure:x.measure},bundle:name,series:key});
  // Preserve the published count beside every measure in provenance; a separate series
  // counts the sales/growth sample, never an employment or same-company panel count.
  if(x.measure==='growth'&&x.item==='SALES' || x.measure==='ratio'&&x.item==='EBITDA_TO_SAL'){
   const ck=`${x.groupCode?slug(x.groupCode,30)+'__':''}companies`;
   const count=ser(bundles.get(name),ck,{label:`${x.group?x.group+': ':''}number of companies in the period`,unit:'count',measure:'count',...(x.group?{group:x.group}:{}),sourceByDate:{}});count.values.set(x.date,x.companies);count.sourceByDate[x.date]=s.sourceByDate[x.date];
  }
 }
 const out=[],vintageMeta=marketsRbiVintage(cas,report);
 const note='Direct RBI DBIE: CAS full history, newest prompted report restatements preferred. Growth compares common companies; period totals and ratios use changing samples. Amounts are not a comparable time series. CAS omits some zero or |rate| ≥150 cells; reports preserve meaningful numeric cells and quarantine the exact 999999999 sentinel. Zero-filled CAS amount vectors and rupee-valued growth are missing, never true zero. Historical duplicate-key ratios retain the inherited mirror selection with an ambiguity flag until official reports resolve them. See sourceByDate for each cell; full source defects and overlap in markets-rbi.source-quality.json.';
 for(const [name,map] of bundles){const built=assemble(map,{gapsNote:'Not published, not meaningful, or quarantined source defect; see sourceByDate and the source-quality download.'});if(!built.dates.length)continue;
  for(const series of Object.values(built.series)){const dates=Object.entries(series.sourceByDate??{}).filter(([,p])=>p.ambiguity).map(([d])=>d);if(dates.length){series.ambiguousInherited=dates;series.note='These dated historical values are an ambiguous inherited last-mirror-row selection, not a verified historical estimate. The source repeats this non-additive ratio key; CAS sums the duplicates. Official prompted reports supersede where held. See sourceByDate and markets-rbi.source-quality.json.';series.label+=' [historical values: ambiguous inherited selection]';}}
  out.push(emit(root,name,{dossier:'markets-listed',source:'Reserve Bank of India, DBIE (official CAS and prompted statistical reports), via the local Data Bank',...vintageMeta,geo:'IND',mock:false,base:'as published',releaseDate:null,revisionPolicy:dcfg.revision_policy},{frequency:name.startsWith('markets-listed-q')?'quarterly':'annual',unit:name.endsWith('-levels')?'inr_crore':'pct',product:'Listed non-government non-financial companies',coverage:marketsRbiCoverage(name,built.series),note},built));
 }
 const items=[...catalogue.values()];writeCatalogue('markets-rbi',{source:'Reserve Bank of India, DBIE',generator:'scripts/lib/products/markets-rbi.mjs --replay',note:'Source-native CAS/report series inventory including entirely quarantined series. Every canonical cell carries raw artifact lineage.',items});
 const baked=new Map(out.map(x=>[x.slug,JSON.parse(fs.readFileSync(path.join(root,'data/series',x.slug+'.json'),'utf8'))]));
 const views=marketsRbiSlices(sl=>baked.get(sl));
 const rules=items.map(it=>{const b=baked.get(it.bundle);/*const b=fs.existsSync(path.join(root,'data/series',it.bundle+'.json'))?JSON.parse(fs.readFileSync(path.join(root,'data/series',it.bundle+'.json'),'utf8')):null;*/return b?.series[it.series]?{match:it.id,status:views.some(v=>v.bundle===it.bundle&&v.item===it.dims.item.toLowerCase())?'shown':'baked',bundle:it.bundle,series:[it.series],...(views.some(v=>v.bundle===it.bundle&&v.item===it.dims.item.toLowerCase())?{plate:'Markets listed-company full-name plates'}:{})}:{match:it.id,status:'blocked',reason:'The reviewed source publishes no meaningful numeric cell after quarantining its source defects; see markets-rbi.source-quality.json.'};});
 fs.writeFileSync(path.join(root,'data/coverage/markets-rbi.yml'),YAML.stringify({family:'markets-rbi',guides:['markets'],catalogue:'data/coverage/markets-rbi.catalogue.json',rules}));
 const quality={counts:{queriedCas:provenance.queriedCas,queriedReports:provenance.queriedReports,casRows:cas.length,reportRows:report.length,elements:20,reports:10,exports:new Set(report.map(r=>r.report_id+'|'+r.prompt_answer)).size,auxiliaryRows:parsed.auxiliary,displayDuplicateRows:parsed.displayDuplicates,casCells:cas.length,inheritedAmbiguousRatioCells:duplicateRatioDefects.length,reportCells:parsed.reports.length,canonicalCells:[...reconciled.cells.values()].filter(x=>x.value!=null).length,quarantinedCells:parsed.quarantine.length,overlapCells:reconciled.overlap.length,conflicts:reconciled.conflicts.length,reportRestatements:reconciled.reportDuplicates.length},bundles:out,duplicateRatioDefects,conflicts:reconciled.conflicts,reportRestatements:reconciled.reportDuplicates,quarantine:parsed.quarantine,lineage:provenance.lineage};
 fs.writeFileSync(path.join(root,'data/coverage/markets-rbi.source-quality.json'),JSON.stringify(quality,null,1)+'\n');
 console.log('markets-rbi',JSON.stringify(quality.counts));return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');const cfg=YAML.parse(fs.readFileSync(path.join(root,'data/sources.yml'),'utf8'));await buildMarketsRbi(root,cfg.dossiers['markets-listed'],'2026-10-11',cfg,{replay:process.argv.includes('--replay'),cache:process.argv.includes('--cache')?'/tmp':null});}
