export function householdFormat(v,u){
 if(v==null||!Number.isFinite(v))return '—';
 const n=v.toLocaleString('en-IN',{maximumFractionDigits:3});
 return u==='inr'?'₹'+n:u==='per_1000'?n+' / 1,000':u==='pct'?n+'%':u==='inr_lakh'?n:n;
}
