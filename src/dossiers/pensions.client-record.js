// Browser-safe single governed source record. Calling this guard precedes plotting and every download.
import {pensionChartCSV} from './pensions.exports.js';
export function pensionClientCSV(p){
 const keys=new Set([...(p.rows??[]).map(r=>r.key),...(p.lines??[]).map(l=>l.key)]);
 if(keys.size!==1||(p.lines?.length??0)>1||(p.rows?.length??0)>1)throw Error('Pension client requires one governed source record');
 const key=[...keys][0],q=p.sourceQuality;
 if(!p.meta||q?.canInterpret!==true||!q.review?.sourceVersion||!/^[a-f0-9]{64}$/.test(q.binding?.records?.[key]??''))throw Error('Pension client requires reviewed source quality and canonical metadata');
 if((p.meta.observationKind??null)!==(p.observationKind??null))throw Error('Pension client observation kind differs from canonical metadata');
 return pensionChartCSV(p);
}
