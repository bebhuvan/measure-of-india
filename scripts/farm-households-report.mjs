import {farmReportProvenance} from './lib/farm-households-provenance.mjs';
// Deterministic column extraction from official Report587, never API row positions.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readRaw,writeSeries} from './lib/util.mjs';
const REPORT_URL='https://www.mospi.gov.in/sites/default/files/publication_reports/Report_587m_0.pdf';
const keyOf=d=>'c_'+crypto.createHash('sha256').update(JSON.stringify(Object.entries(d).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,24);
export const reportColumns={
'29':['Commercial bank','Regional rural bank','Co-operative society','Co-operative bank','Insurance company','Provident fund','Employer','Financial institutions','NBFC microfinance','Bank-linked SHG/JLG','Non-bank-linked SHG/JLG','Other institutional agencies','Landlord','Agricultural moneylender','Professional moneylender','Input supplier','Relatives and friends','Chit fund','Market commission agent','Others','All loan sources','Indebted households per thousand agricultural households','Mean outstanding loan per agricultural household','Estimated indebted households (hundreds)','Sample indebted households'],
'18':['Aware of MSP','Not aware of MSP','Awareness not reported','All crop sellers','Sold to procurement agency','Agency not available','No local purchaser','Poor crop quality','Crop already pre-pledged','Received better price than MSP','Other non-sale reasons','Total did not sell (including not reported)','Aware of procurement agency','Output sold under MSP (%)','Average sale rate received','Estimated crop-selling households (hundreds)','Sample crop-selling households'],
'19':['Not aware','Not aware of facility','Not interested','No need','Facility unavailable','Lack of resources for premium','Not satisfied with terms','Bank too far','Complex procedures','Delayed claim payment','Other reasons','All non-insurance reasons','Households insuring crop','Estimated crop-growing households (hundreds)','Sample crop-growing households'],
'27A':['Animal seeds: paid-out cost','Animal feed: paid-out cost','Veterinary services: paid-out cost','Labour: paid-out cost','Other paid-out costs','Total paid-out costs','Milk receipts','Egg receipts','Wool receipts','Fish receipts','Livestock receipts','Other animal receipts','Total animal receipts','Households engaged in animal farming','Estimated animal-farming households (hundreds)','Sample animal-farming households'],
'27B':['Animal seeds: total cost','Animal feed: total cost','Veterinary services: total cost','Labour: total cost','Other total costs','Total costs including imputed inputs','Estimated animal-farming households (hundreds)','Sample animal-farming households']};
const units=(t,i)=>t==='29'?(i===22?'inr':i===23?'hundreds':i===24?'count':'per_1000'):t==='18'?(i===13?'pct':i===14?'source_sale_rate':i===15?'hundreds':i===16?'count':'per_1000'):t==='19'?(i===13?'hundreds':i===14?'count':'per_1000'):t==='27A'?(i===13?'per_1000':i===14?'hundreds':i===15?'count':'inr'):i===6?'hundreds':i===7?'count':'inr';
export function extractFarmReport(raw){
 const seriesByTable=Object.fromEntries(Object.keys(reportColumns).map(t=>[t,{}])),sections=[],rejected=[];
 const pages=raw.text.split('\f');let table=null,state=null,season=null;
 for(const [pi,page]of pages.entries())for(const line of page.split('\n')){
  const heading=line.match(/^\s*Table (\d+[AB]?):/);if(heading){table=heading[1];state=null;season=null;}
  if(!reportColumns[table])continue;
  const sh=line.match(/^\s*(.+?)\s+Season:\s*(July 2018-December 2018|January 2019-June 2019|July 2018-June 2019)/);
  if(sh){state=sh[1].trim().replace(/^all[- ]India$/i,'All India').replace(/^Group Of NE States$/i,'Group Of NE States').replace(/^Group Of UTs$/i,'Group Of UTs');season=sh[2];sections.push({table,state,season,pdfPage:pi+1});}
  if(!state||!season)continue;
  const n=reportColumns[table].length;
  const tokens=line.trim().split(/\s+/),j=tokens.length-n;
  if(j<1||!tokens.slice(j).every(v=>/^-?[\d,]+(?:\.\d+)?$/.test(v)))continue;
  let label=tokens.slice(0,j).join(' ');
  if(['29','27A','27B'].includes(table)){
   if(!/^(<\s?0\.01|0\.01 - 0\.(?:04|40)|0\.41 - 1\.00|1\.01 - 2\.00|2\.01 - 4\.00|4\.01 - 10\.00|10\.00\s?\+|all sizes)$/i.test(label))continue;
   if(label==='0.01 - 0.04')label='0.01 - 0.40'; // report29 typographical class, consistent with report headings and statement5.7
   if(/^all sizes$/i.test(label))label='All Size';if(label==='10.00 +')label='10.00+';
  }else if(!/^[a-z][a-z ]+$/i.test(label))continue;
  const values=tokens.slice(j).map(v=>Number(v.replaceAll(',','')));
  for(const [i,measure]of reportColumns[table].entries()){
   const dims={state,season,[['29','27A','27B'].includes(table)?'Land_Possessed(hectares)':'crop']:label,sub_indicator:measure},k=keyOf(dims);
   const s={name:'report_'+table+'_'+k,label:Object.entries(dims).map(([k,v])=>k.replaceAll('_',' ')+': '+v).join('; '),dims,unit:units(table,i),state,group:Object.values(dims).join(', '),data:[values[i]],source:{table,pdfPage:pi+1,column:i+2,line:line.trim(),sha256:raw.sha256}};
   if(seriesByTable[table][k]){if(seriesByTable[table][k].data[0]!==values[i])throw Error('Conflicting report cell '+table+' '+JSON.stringify(dims));continue;}
   seriesByTable[table][k]=s;
  }
 }
 for(const t of Object.keys(reportColumns)){
  const states=new Set(Object.values(seriesByTable[t]).map(s=>s.dims.state));if(states.size!==31)throw Error(`Report ${t}: ${states.size} states, expected31`);
  if(['29','27A','27B'].includes(t)){const expected=31*8*reportColumns[t].length*(t==='29'?1:3);if(Object.keys(seriesByTable[t]).length!==expected)throw Error(`Report ${t}: rows ${Object.keys(seriesByTable[t]).length}, expected${expected}`);}
 }
 return {seriesByTable,sections,rejected};
}
export function buildFarmReport(root){
 const raw=readRaw(root,'data/raw/farm-households-report.json'),result=extractFarmReport(raw),provenance=farmReportProvenance(root,'data/raw/farm-households-report.json',raw),bundles=[];
 for(const [t,series]of Object.entries(result.seriesByTable)){
  const slug='farm-households-report-'+t.toLowerCase();
  writeSeries(root,'data/series/'+slug+'.json',{meta:{dossier:'farm-households',product:'farm-households-report-'+t,source:'MoSPI Report 587, Appendix A, Table '+t,sourceUrl:REPORT_URL,base:'NSS77 Schedule33.1, rural India',frequency:'cross-sectional',unit:'see each series',...provenance,geo:'IND',latestPeriod:t==='29'?'Survey date in visit 1, January–August 2019':'July 2018–June 2019; seasonal references in each cell',releaseDate:'2021-09-10',revisionPolicy:'Official report snapshot; checksum and page/column/line retained for exact replay.',coverage:'All states, land classes/crops and reference periods printed in Table '+t,rawFile:'data/raw/farm-households-report.json',note:'Recovered directly from official PDF to complement/replace defective API views. Debt stock is as on interview date in visit1, not end of agricultural year. Counts supplied as control totals must not be treated as independently precise population counts. Class0.01–0.04 in Table29 is its repeated typographical label for0.01–0.40, reconciled with Statement5.7. Coconut sale rate has a different quantity basis; average sale rates retain the report unit label without a cross-crop ranking.'},dates:[t==='29'?'2019-08-31':'2019-06-30'],series});
  bundles.push({slug,code:'report-'+t,series:Object.keys(series).length,rawFile:'data/raw/farm-households-report.json'});
 }
 const inventory=new Map();for(const [i,page]of raw.text.split('\f').entries())for(const h of page.matchAll(/^\s*Table\s+(\d+[A-D]?):\s*([^\n]+)/gm)){const it=inventory.get(h[1])??{table:h[1],title:h[2].trim(),pdfPages:[]};it.pdfPages.push(i+1);inventory.set(h[1],it);}
 fs.writeFileSync(root+'/data/coverage/farm-households.report-inventory.json',JSON.stringify({sha256:raw.sha256,sections:result.sections,bundles,fullReportTables:[...inventory.values()],reportScopeLimit:'Named recovered tables only; other report-only measures and columns remain explicitly unfinished.'},null,1)+'\n');return bundles;
}
if(process.argv[1]?.endsWith('farm-households-report.mjs'))buildFarmReport(process.cwd());
