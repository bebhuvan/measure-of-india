#!/usr/bin/env node
// Bounded direct-API/report reconciliation. Ambiguous or unmatched cuts never
// count as agreement. This is a canary audit, not certification of the full API.
import fs from 'node:fs';
import {readRaw} from './lib/util.mjs';
const root=process.cwd(),extraction=readRaw(root,'data/raw/time-use/extracted-2024.json');
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^allindia$/,'allindia');
const activity=s=>{const m=String(s).match(/^\((\d{3}|Division:\s*\d{2}|Major Division:\s*\d)\)/i);return m?norm(m[1].replace(/^Division:\s*/i,'')):norm(s);};
const rowCode=s=>norm(s.replace(/^Division:\s*/i,''));
const metric=s=>/per participant/i.test(s)?'Minutes per participant':/per person/i.test(s)?'Minutes per person':'Participation rate';
const report=[];
for(let code=4;code<=44;code++){
 const raw=readRaw(root,`data/raw/time-use/discovery-${code}.json`),table=extraction.tables.find(t=>t.id==='t'+code);
 const candidates=table.records,stats={code,checked:0,matched:0,valueMismatch:0,unitMismatch:0,unmatched:0,ambiguous:0,alternateAllActivitiesMatches:0,examples:[]};
 for(const r of raw.firstPage.data){if(r.year!=='2024')continue;stats.checked++;
  const hits=candidates.filter(c=>{
   const d=c.dims;
   if(norm(d.state)!==norm(r.state)||norm(d.sector)!==norm(r.sector)||norm(d.gender)!==norm(r.gender))return false;
   if(r.icatus_activity&&rowCode(d.source_row)!==activity(r.icatus_activity))return false;
   if(r.sub_indicator&&d.measure!==metric(r.sub_indicator))return false;
   if(r.day_of_week&&norm(d.day_type)!==norm(r.day_of_week.replace(/ Day$/i,'')))return false;
   if(r.broad_principal_activity_status&&norm(d.broad_status)!==norm(r.broad_principal_activity_status))return false;
   if(r.sna_activity&&norm(d.source_row)!==norm(r.sna_activity))return false;
   for(const k of ['age_group','usual_principal_activity','marital_status','quintile_class_of_umpce','level_of_education','social_group'])if(r[k]){
    const v=norm(r[k]);if(!c.headers.some(h=>norm(h)===v)&&norm(c.headers.slice(1).join(' '))!==v)return false;
   }
   if(r.activity&&norm(d.source_row)!==norm(r.activity))return false;
   if(r.place_of_activity&&!c.headers.some(h=>norm(h)===norm(r.place_of_activity)))return false;
   return true;
  });
  let status;if(!hits.length){stats.unmatched++;status='unmatched';}else if(hits.length!==1){stats.ambiguous++;status='ambiguous';}else{
   const h=hits[0],v=String(r.value).trim(),n=['-','nan',''].includes(v.toLowerCase())?null:Number(v);
   if(n!==h.value){stats.valueMismatch++;status='value mismatch';
    if(code===32){const alternate=extraction.tables.find(t=>t.id==='t34').records.find(c=>JSON.stringify(c.dims)===JSON.stringify(h.dims));if(alternate?.value===n)stats.alternateAllActivitiesMatches++;}
   }else{stats.matched++;status='match';}
   const unit=r.unit==='mins'?'minutes':r.unit==='%'?'pct':r.unit;
   if(unit!==h.unit){stats.unitMismatch++;if(status==='match')status='unit mismatch';}
  }
  if(status!=='match'&&stats.examples.filter(x=>x.status===status).length<3)stats.examples.push({status,api:r,report:hits.length===1?{cell:hits[0].cell,value:hits[0].value,unit:hits[0].unit,dims:hits[0].dims}:null});
 }
 report.push(stats);
}
const result={methodology:'First 100 API records per indicator, restricted to 2024; matched only on explicit observed dimensions and report header labels. Unmatched and ambiguous cuts remain unverified. This is not a full API census or a report quality certificate.',indicators:report,totals:Object.fromEntries(['checked','matched','valueMismatch','unitMismatch','unmatched','ambiguous'].map(k=>[k,report.reduce((n,r)=>n+r[k],0)]))};
fs.writeFileSync('docs/reference/time-use-api-report-audit.json',JSON.stringify(result,null,1)+'\n');console.log(result.totals);
