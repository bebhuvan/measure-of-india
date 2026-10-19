// Percentages keep their published decimal (at least one place, so 26.0% reads as the chart does);
// relative standard errors are published to two places.
export const timeUseFormat=(v,unit)=>v==null?'—':v.toLocaleString('en-IN',{minimumFractionDigits:unit==='pct'?1:unit==='pct_rse'?2:0,maximumFractionDigits:unit==='minutes'?0:2})+(unit==='minutes'?' min':unit==='pct'||unit==='pct_rse'?'%':'');
