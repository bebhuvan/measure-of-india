// Removed from src/dossiers/headline.js when the guide was parked (2026-10-15).
import {investorFormat} from "./investor-participation.format.js";

function investorHeadlineRecord(b){
 const bundle='investor-monthly-categories-2026-inr-crore',key='71c202ab560558e4e0f6',record=b.series[key],q=getSourceQuality(bundle,b,{...record,key});
 if(!record||q.canInterpret!==true||q.canCompare!==false||q.observationKind!=='observed-stock'||q.binding?.records?.[key]!==sourceRecordFingerprint(b,{...record,key}))throw Error('Investor headline requires an exact reviewed observed stock');
 const i=record.data.findLastIndex(Number.isFinite);if(i<0)throw Error('Investor headline has no source observation');return{value:record.data[i],date:b.dates[i],period:month({...b,dates:[b.dates[i]]})};
}

  "investor-participation": {value:b=>investorFormat(investorHeadlineRecord(b).value,"inr_crore"),what:"Conventional mutual-fund assets at month end",period:b=>investorHeadlineRecord(b).period,asOf:b=>investorHeadlineRecord(b).date},

  if(d.slug==='investor-participation'){
    const h=headlineOf(d),key=d.spark.series,s=h.bundle.series[key];return{dates:[...h.bundle.dates],values:[...s.data],slope:false};
  }
