import * as fmt from '../charts/format.js';
export function schoolFormat(value,unit){
 if(value==null || !Number.isFinite(value))return '—';
 if(unit==='crore')return (value/1e7).toFixed(2)+' crore';
 if(unit==='lakh')return (value/1e5).toFixed(2)+' lakh';
 if(unit==='pct')return fmt.pct1(value);
 if(unit==='gpi')return value.toFixed(2);
 if(unit==='inr_per_year')return fmt.inrR(value);
 if(unit==='count_per_school')return value.toLocaleString('en-IN',{maximumFractionDigits:1});
 return Math.round(value).toLocaleString('en-IN');
}
