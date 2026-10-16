// AIDIS: complete observed cubes, never profile headline aggregation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readRaw,rawExists,writeRaw,writeSeries} from '../util.mjs';
import {parseNumber} from '../tabular.mjs';
import {mospi,mospiAll} from '../mospi.mjs';
import {getBuffer} from '../net.mjs';
import {writeCatalogue} from '../catalogue.mjs';
import {JSDOM,VirtualConsole} from 'jsdom';
export const REPORT_URL='https://www.mospi.gov.in/sites/default/files/publication_reports/Report_no588-AIDIS-77R-SeptFinal_0.pdf';
export const flowCodes=new Set([16,17,18,19,24]);
export const clean=x=>String(x??'').trim().replace(/\s+/g,' ');
export const keyOf=dims=>'c_'+crypto.createHash('sha256').update(JSON.stringify(Object.entries(dims).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,24);
export function householdUnit(r){
 const m=clean(r.sub_indicator);
 if(/per\s*(?:Rs\.?\s*)?1000|per thousand/i.test(m))return 'per_1000';
 if(/Rs\.\s*lakhs/i.test(m))return 'inr_lakh';
 if(/Rs\./i.test(m))return 'inr';
 throw Error('AIDIS unit unresolved: '+m);
}
export function householdApiVintage(raw){
 return {vintage:null,vintageStatus:'unknown',vintageNote:'The archived AIDIS API rows contain no publisher revision timestamp. The survey report was released on 2021-09-10, but the current API body has not been established as that exact publication version.',archiveCapturedDate:raw.vintage,reportEditionDate:'2021-09-10',apiRevisionDate:null};
}
// A "per Rs. 1000 of <amount>" breakdown splits an amount into shares that add to 1,000. Where the
// API prints every share of one state, sector and group as 0, the amount was nil or unsampled and
// the shares do not exist (0/0): those cells are withheld, never baked as zero. A single 0 inside a
// breakdown that adds up is a published figure that rounds to zero, and stays.
export const SHARE_OF_AMOUNT=/per Rs\.? ?1,?000 of/i;
export function noEstimateRows(rows){
 const g=new Map();
 for(const r of rows)if(SHARE_OF_AMOUNT.test(r.sub_indicator??'')){const k=[r.state,r.sector,r.sub_indicator].map(clean).join('|');(g.get(k)??g.set(k,[]).get(k)).push(r);}
 return new Set([...g.values()].filter(rs=>rs.length>1&&rs.every(r=>parseNumber(r.value)===0)).flat());
}
export function householdCube(raw){
 const code=+raw.indicator.code,rows=raw.rows;
 if(!rows?.length || rows.length!==raw.indicator.expected)throw Error(`AIDIS ${code}: incomplete archived rows`);
 const dimensions=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!['indicator','value'].includes(k)).sort(),series={},withheld={},none=noEstimateRows(rows);
 for(const r of rows){
  const dims=Object.fromEntries(dimensions.map(k=>[k,clean(r[k])])),key=keyOf(dims);
  if(series[key]||withheld[key])throw Error(`AIDIS ${code}: duplicate/colliding cell ${key}`);
  if(none.has(r)){withheld[key]={label:dimensions.map(k=>dims[k]).join(', '),dims,printed:r.value};continue;}
  series[key]={name:`aidis_${code}_${key}`,label:dimensions.map(k=>dims[k]).join(', '),unit:householdUnit(r),dims,state:dims.state,geo:dims.state,group:dimensions.filter(k=>!['state','sub_indicator'].includes(k)).map(k=>dims[k]).join(', '),data:[parseNumber(r.value)]};
 }
 const flow=flowCodes.has(code),date=flow?'2019-06-30':'2018-06-30';
 return {meta:{dossier:'households',product:'households-aidis',source:'MoSPI, NSS 77 All India Debt and Investment Survey',sourceUrl:REPORT_URL,base:'NSS 77 AIDIS 2019, Schedule 18.2',frequency:'cross-sectional',unit:'see each series',...householdApiVintage(raw),geo:'IND',latestPeriod:flow?'July 2018–June 2019':'30 June 2018',revisionPolicy:'Published survey estimates may be revised by MoSPI; changed source bodies are archived before rebaking.',coverage:clean(raw.indicator.label)+': all observed '+dimensions.map(d=>d.replaceAll('_',' ')).join(', '),note:'Interviewed in 2019. Stock reference: 30 June 2018; expenditure/borrowing flow reference: July 2018–June 2019. Means use all households unless the measure explicitly conditions on reporting. Source zeros are retained; dashes are null. No Cartesian expansion. State and small-group estimates need sample-size and RSE caution. Valuables are separate from the report’s physical and financial asset total. API indicator headings can conflict with cell units; sub-indicator units control.',dimensions,indicator:{code,sourceRows:rows.length},rawFile:`data/raw/profiles-mospi/nss77aidis-1-${code}.json`},dates:[date],series,withheld};
}
export function indebtedMeans(html){
 const text=new JSDOM(html,{virtualConsole:new VirtualConsole()}).window.document.body.textContent.replace(/\s+/g,' ');
 const start=text.indexOf('Average amount of Debt per indebted household (AODL)');
 if(start<0)throw Error('AIDIS release: conditional debt heading missing');
 const section=text.slice(start,start+1100),series={};
 for(const [sector,rx,groups] of [
  ['Rural',/Average amount of debt was Rs\. ([\d,]+) among indebted households in Rural India \(Rs\. ([\d,]+) for cultivator households, Rs\. ([\d,]+) for non-cultivator households\)/,['All','Cultivator','Non-cultivator']],
  ['Urban',/Average amount of debt was Rs\. ([\d,]+) among indebted households in Urban India \(Rs\. ([\d,]+) for self-employed households, Rs\. ([\d,]+) for other households\)/,['All','Self-employed','Others']]]){
  const m=section.match(rx);if(!m)throw Error('AIDIS release: conditional means cannot be parsed for '+sector);
  groups.forEach((g,i)=>{const key=sector.toLowerCase()+'_'+g.toLowerCase().replaceAll('-','_');series[key]={name:key,label:`Mean cash debt per indebted household, ${sector}, ${g}`,unit:'inr',dims:{state:'All-India',sector,occupational_category:g,sub_indicator:'Mean cash debt per indebted household'},data:[parseNumber(m[i+1])]};});
 }
 return series;
}
export async function buildHouseholdRelease(root){
 const url='https://www.pib.gov.in/PressReleasePage.aspx?PRID=1753935',rel='data/raw/households-release.json';
 if(!rawExists(root,rel)){const html=(await getBuffer(url,{maxBytes:5e6})).toString();writeRaw(root,rel,{vintage:'2021-09-10',url,html});}
 const raw=readRaw(root,rel);
 writeSeries(root,'data/series/households-aidis-release.json',{meta:{dossier:'households',product:'households-aidis-release',source:'MoSPI, AIDIS release published by PIB',sourceUrl:url,base:'NSS 77 AIDIS 2019, Schedule 18.2',frequency:'cross-sectional',unit:'inr',vintage:raw.vintage,geo:'IND',latestPeriod:'30 June 2018',releaseDate:'2021-09-10',revisionPolicy:'Published national survey estimates may be revised by MoSPI; the release body is archived for replay.',coverage:'All six explicitly published national conditional debt means, rural and urban occupational groups',note:'Mean debt per indebted household is published directly, not reconstructed by dividing rounded incidence rates.',dimensions:['state','sector','occupational_category','sub_indicator'],rawFile:rel},dates:['2018-06-30'],series:indebtedMeans(raw.html)});
}
export async function buildHouseholds(root,dcfg,vintage){
 await buildHouseholdRelease(root);
 const offline=process.env.HOUSEHOLDS_FROM_RAW==='1',listingRel='data/raw/households-list.json',reportRel='data/raw/households-report.json';
 if(!offline){
  const body=await mospi('nss-77/getNss77AidisIndicatorList',{survey_code:1});writeRaw(root,listingRel,{vintage,body});
 }
 const list=readRaw(root,listingRel).body.data;
 if(!Array.isArray(list)||list.length!==22)throw Error('AIDIS source indicator inventory changed: review coverage');
 const bundles=[],items=[];
 for(const ind of list){
  const code=+(ind.indicator_code??ind.id),rel=`data/raw/profiles-mospi/nss77aidis-1-${code}.json`;
  if(!rawExists(root,rel)){
   const rows=await mospiAll('nss-77/getNss77AidisRecords',{survey_code:1,indicator_code:code});
   writeRaw(root,rel,{vintage,indicator:{code,label:ind.description??ind.label,expected:rows.length},rows});
  }
  const raw=readRaw(root,rel),{withheld,...b}=householdCube(raw),slug=`households-aidis-${code}`;
  writeSeries(root,`data/series/${slug}.json`,b);bundles.push({slug,code,rows:raw.rows.length,series:Object.keys(b.series).length,withheld:Object.keys(withheld).length});
  for(const [key,s] of Object.entries(b.series))items.push({id:slug+':'+key,bundle:slug,series:key});
  for(const [key,w] of Object.entries(withheld))items.push({id:slug+':'+key,bundle:slug,series:key,label:w.label,dims:w.dims,withheld:'share of a nil amount'});
 }
 if(!rawExists(root,reportRel)){
  const pdf=await getBuffer(REPORT_URL,{maxBytes:55e6});
  const text=execFileSync('pdftotext',['-layout','-','-'],{input:pdf,maxBuffer:30e6}).toString();
  writeRaw(root,reportRel,{vintage,url:REPORT_URL,sha256:crypto.createHash('sha256').update(pdf).digest('hex'),extractor:'pdftotext -layout',text});
 }
 const rb=JSON.parse(fs.readFileSync(path.join(root,'data/series/households-aidis-release.json')));
 for(const key of Object.keys(rb.series))items.push({id:'households-aidis-release:'+key,bundle:'households-aidis-release',series:key});
 bundles.push({slug:'households-aidis-release',code:'release',rows:6,series:6});
 writeCatalogue('households',{source:'MoSPI NSS 77 AIDIS official indicator listing and complete observed archived cubes',generator:'scripts/lib/products/households.mjs',note:'API inventory scope; report-only tables are recorded separately in the status packet.',items});
 fs.writeFileSync(path.join(root,'data/coverage/households.manifest.json'),JSON.stringify({sourceIndicators:list.length,bundles},null,1)+'\n');
 execFileSync(process.execPath,['scripts/households-editorial.mjs'],{cwd:root,stdio:'inherit'});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.includes('--release-only'))await buildHouseholdRelease(process.cwd());else await buildHouseholds(process.cwd(),{},'2026-10-11');}
