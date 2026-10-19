// Report-native source of truth. Direct API responses are independently reconciled,
// never allowed to override a published workbook cell or its denominator.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readRaw,writeRaw,writeSeries} from '../util.mjs';
import {writeCatalogue} from '../catalogue.mjs';
export const timeUseKey=d=> 'c_'+crypto.createHash('sha256').update(JSON.stringify(Object.entries(d).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,24);
export function timeUseBundles(extraction,labels=extraction.activityLabels??{}){
 const bundles=[],items=[];
 for(const t of extraction.tables){
  const sectors=['t4','t5'].includes(t.id)?['Rural','Urban','Combined']:[null];
  for(const sector of sectors){
  for(const unit of [...new Set(t.records.map(r=>r.unit))]){
   const slug=`time-use-2024-${t.id}${sector?'-'+sector.toLowerCase():''}-${unit}`,series={},seen=new Set();
   for(const r of t.records.filter(r=>r.unit===unit&&(!sector||r.dims.sector===sector))){
    const dims={...r.dims,measure:/^percentage distribution of persons/i.test(r.dims.source_row)?'Source group composition':r.dims.measure};
    const key=timeUseKey(dims),id=slug+':'+key;
    if(seen.has(key))throw Error('Duplicate source dimensions '+id+' '+r.cell);seen.add(key);
    items.push({id,bundle:slug,series:key,table:t.id,cell:r.cell,withheld:r.value===null,reason:r.value===null?'The original report prints a dash for this exact cut; no sample observation.':''});
    if(r.value===null)continue;
    if(!Number.isFinite(r.value)||r.value<0||r.value>(unit==='minutes'?1440:unit==='pct'?100:unit==='pct_rse'?1000:1e13))throw Error('Source range/unit conflict '+id+' '+r.value);
    const activityLabel=labels[r.dims.source_row.replace(/^Division:\s*/,'')];
    // A leaf can have the same wording as its parent. Retain the official code
    // so CSV columns and reader labels distinguish those genuine source cuts.
    const rowLabel=activityLabel?'ICATUS '+r.dims.source_row+': '+activityLabel:r.dims.source_row;
    const label=Object.values({...dims,source_row:rowLabel}).join(' / ');
    series[key]={name:label,label,color:'#2E4BD8',unit,dims,data:[r.value],sourceCell:{sheet:r.sheet,cell:r.cell}};
   }
   if(!Object.keys(series).length)continue;
   bundles.push({slug,bundle:{meta:{dossier:'time-use',source:'National Statistics Office, Ministry of Statistics and Programme Implementation',sourceUrl:t.sourceUrl,product:'time-use-report',coverage:(t.id==='rse8_india'?'Relative standard errors of participation and participant time in economic production, domestic and care services, and other activities; all recorded activities':t.title.replace(/^Table\s*\([^)]+\)[^:]*:\s*/,''))+(sector?' · '+sector:'')+' · '+(unit==='pct_rse'?'relative standard error (%)':unit==='minutes'?'minutes':unit==='pct'?'per cent':'source counts'),base:'Time Use Survey 2024; ICATUS 2016',geo:'IND',frequency:'irregular',unit,vintage:'2025-03-28',vintageBasis:'report-edition',reportEditionDate:'2025-03-28',releaseDate:'2025-03-28',latestPeriod:'2024',sourceTable:t.id,sourceTitle:t.title,sourceSha256:t.sourceSha256,rawFile:t.rawFile,documentSha256:t.documentSha256,csvHeaderMode:'series-name',everyCutLabelMode:'series-name',note:'January–December 2024 survey, age 6 and above unless the source header names another universe. Snapshot axis is an annual anchor, not an observation on 1 January. All-activities time is equally allocated across recorded activities within each slot; major-only time assigns the whole slot to its major activity. Source dashes are catalogued as unavailable and never changed to zero. Source revision date beyond this report edition is not supplied.'+(t.id==='rse8_india'?' The original RSE8 India workbook repeats the title of Table 36. Its attachment identity and statistical meaning follow the report’s Appendix B listing; the original header is preserved as sourceTitle.':'')},dates:['2024-01-01'],series}});
  }
  }
 }
 return {bundles,items};
}
export async function buildTimeUse(root){
 const extraction=readRaw(root,'data/raw/time-use/extracted-2024.json');
 const classification=readRaw(root,'data/raw/time-use/classification-2024.json');
 if(Object.keys(classification.labels).length!==230||classification.reportSha256!==extraction.tables[0].documentSha256)throw Error('Unbound original-report activity classification');
 const {bundles,items}=timeUseBundles(extraction,classification.labels);
 if(extraction.tables.length!==62||!bundles.length)throw Error('Incomplete 46-table / 16-RSE source family');
 for(const {slug,bundle} of bundles)writeSeries(root,'data/series/'+slug+'.json',bundle);
 // These two former files exceed the deployed-file budget. Replaced in full by
 // explicit rural/urban/combined partitions; no source cell is dropped.
 for(const old of ['time-use-2024-t4-pct','time-use-2024-t5-minutes']){
  const file=path.join(root,'data/series/'+old+'.json');if(fs.existsSync(file))fs.unlinkSync(file);
 }
 const manifest={generator:'scripts/lib/products/time-use.mjs',source:'46 detailed tables and 16 sampling-error workbooks linked by the official report',tables:extraction.tables.map(t=>({id:t.id,title:t.title,sourceUrl:t.sourceUrl,sourceSha256:t.sourceSha256,rawFile:t.rawFile,sheets:t.sheets,cells:t.records.length})),bundles:bundles.map(({slug,bundle})=>({slug,table:bundle.meta.sourceTable,unit:bundle.meta.unit,series:Object.keys(bundle.series).length})),sourceCells:items.length,withheld:items.filter(i=>i.withheld).length};
 fs.writeFileSync(path.join(root,'data/coverage/time-use.manifest.json'),JSON.stringify(manifest,null,1)+'\n');
 fs.writeFileSync(path.join(root,'data/coverage/time-use.labels.json'),JSON.stringify(classification.labels,null,1)+'\n');
 writeCatalogue('time-use',{source:manifest.source,generator:'scripts/lib/products/time-use.mjs',items});
 console.log('time-use: offline replay of the archived, report-checked edition; no live source revision is implied');
 return manifest;
}
if(process.argv.includes('--import-extraction')){
 const extraction=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--import-extraction')+1],'utf8'));
 const metadata=readRaw(process.cwd(),'data/raw/time-use/discovery-4.json').metadata.data.icatus_activity;
 extraction.activityLabels=Object.fromEntries(metadata.map(r=>{const m=r.icatus_activity_name.match(/^\((\d{3}|Division:\s*\d{2}|Major Division:\s*\d)\)\s*(.*)$/);if(!m)throw Error('Unknown official activity label');return [m[1].replace(/^Division:\s*/,''),m[2]];}));
 // Fail on ambiguous dimensions before retaining a derived extraction revision.
 timeUseBundles(extraction);
 writeRaw(process.cwd(),'data/raw/time-use/extracted-2024.json',extraction);
 await buildTimeUse(process.cwd());
}
if(process.argv.includes('--import-classification')){
 const value=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--import-classification')+1],'utf8'));
 const report=readRaw(process.cwd(),'data/raw/time-use/report-2024.json');
 if(value.reportSha256!==report.sha256||Object.keys(value.labels??{}).length!==230)throw Error('Classification is not bound to the complete original report');
 writeRaw(process.cwd(),'data/raw/time-use/classification-2024.json',value);
}
