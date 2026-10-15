// Exact guide-chart CSV. Expected source schedules require the governed single-record policy.
import {assertExpectedPolicy,expectedAsOf} from '../explore/model.js';
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
export function pensionChartCSV(p){
 const rows=p.kind==='history'?p.lines.flatMap(l=>l.points.map(point=>({date:point.date,name:l.name,value:point.value,key:l.key}))):p.rows.map(r=>({date:r.date,name:r.name,value:r.value,key:r.key}));
 if(p.observationKind!=='expected-schedule'){
  if(p.sourceQuality!==undefined){
   const q=p.sourceQuality,keys=new Set(rows.map(r=>r.key));
   if(keys.size!==1||q.canInterpret!==true||q.canCompare!==false||!['observed-stock','observed-activity'].includes(q.observationKind)||!q.review?.sourceVersion||q.binding?.rawSha256!==p.meta?.sourceSha256||![...keys].every(key=>/^[a-f0-9]{64}$/.test(q.binding?.records?.[key]||'')))throw Error('Observed pension export requires one reviewed source record');
   return 'date,cut,value,unit,bundle,series,reference_period,observation_kind,reference_basis,source_version,source_record_fingerprint\n'+rows.map(r=>{
    const period=p.meta.periodLabels?.[r.date];if(!period)throw Error('Observed pension source period missing');
    return [r.date,r.name,r.value,p.unit,p.bundle,r.key,period,q.observationKind,q.referencePeriod,q.review.sourceVersion,q.binding.records[r.key]].map(quote).join(',');
   }).join('\n');
  }
  return 'date,cut,value,unit,bundle,series\n'+rows.map(r=>[r.date,r.name,r.value,p.unit,p.bundle,r.key].map(quote).join(',')).join('\n');
 }
 if(new Set(rows.map(r=>r.key)).size!==1)throw Error('Expected guide-chart exports must contain one governed source series');
 for(const key of new Set(rows.map(r=>r.key)))assertExpectedPolicy({key,meta:p.meta,quality:p.sourceQuality});expectedAsOf(p.meta);
 const head='date,cut,value,unit,bundle,series,reference_period,observation_kind,forecast_as_of_status,forecast_as_of_date,expected,forecast_method,forecast_window_note';
 return head+'\n'+rows.map(r=>{const period=p.meta.periodLabels?.[r.date];if(!period)throw Error('Expected guide source period missing');return [r.date,r.name,r.value,p.unit,p.bundle,r.key,period,p.observationKind,p.meta.forecastAsOfStatus,p.meta.forecastAsOfDate??'',r.value!==null,p.meta.note||'',p.meta.forecastWindowNote||''].map(quote).join(',');}).join('\n');
}
