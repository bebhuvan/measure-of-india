export function farmFormat(v,u){
 if(v==null||!Number.isFinite(v))return '—';
 // household counts are published in hundreds; readers get households in lakh or crore
 if(u==='hundreds'){const h=v*100;return h>=1e7?(h/1e7).toLocaleString('en-IN',{maximumFractionDigits:2})+' crore households':h>=1e5?(h/1e5).toLocaleString('en-IN',{maximumFractionDigits:1})+' lakh households':h.toLocaleString('en-IN')+' households';}
 const n=v.toLocaleString('en-IN',{maximumFractionDigits:3});
 return u==='inr'?'₹'+n:u==='per_1000'?n+' / 1,000':u==='pct'?n+'%':u==='ha'?n+' ha':u==='kg'?n+' kg':u==='kg_per_ha'?n+' kg/ha':u==='thousand_ha'?n+" '000 ha":u==='hundreds'?n+' hundreds':u==='count_per_holding'?n+' / holding':u==='count_per_household'?n+' / household':u==='count_per_ha'?n+' / ha':u==='source_sale_rate'?n+' (source rate)':n;
}
