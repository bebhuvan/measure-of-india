import * as Plot from '../charts/plot.js';
import {sourcePeriodTicks,measurePeriodLabels} from '../charts/source-period-ticks.js';
import {SANS} from '../charts/plumbing.js';
import {pensionClientCSV} from './pensions.client-record.js';
import {pensionFormat} from './pensions.format.js';
export {pensionFormat} from './pensions.format.js';
function axis(v){const a=Math.abs(v);for(const [scale,suffix]of[[1e12,'tn'],[1e9,'bn'],[1e6,'m'],[1e3,'k']])if(a>=scale)return (v<0?'−':'')+(a/scale).toLocaleString('en-IN',{maximumSignificantDigits:3})+suffix;return v.toLocaleString('en-IN',{maximumSignificantDigits:3});}
export function pensionPlot(p,width=1120,labelWidths){
 pensionClientCSV(p); // Numeric eligibility and one-record scope precede every mark.
 const W=Math.max(240,Math.floor(width)),mobile=W<=680,expected=p.observationKind==='expected-schedule';
 const source=p.lines[0].points,first=source.findIndex(r=>r.value!==null),last=source.findLastIndex(r=>r.value!==null);
 if(first<0)throw Error('Pension plot has no source observation');
 const data=source.slice(first,last+1).map(r=>({...r,date:new Date(r.date+'T00:00:00Z')})),published=data.filter(r=>r.value!==null);
 const label=d=>p.meta.periodLabels[d.toISOString().slice(0,10)];
 const widths=labelWidths??measurePeriodLabels(published.map(d=>label(d.date)),{fontFamily:SANS,fontSize:12});
 const ticks=sourcePeriodTicks(data,{range:[66,W-48],canvasWidth:W,maxTicks:mobile?3:6,format:label,measure:text=>widths.get(text)});
 const hi=Math.max(...published.map(r=>r.value)),lo=Math.min(0,...published.map(r=>r.value));
 const marks=[Plot.line(data,{x:'date',y:'value',stroke:'#2E4BD8',strokeWidth:1.8,strokeDasharray:expected?'6,3':undefined})];
 const dots=expected?published:[published.at(-1)];
 marks.push(Plot.dot(dots,{x:'date',y:'value',r:3.4,stroke:'#2E4BD8',strokeWidth:1.7,fill:expected?'#FAF9F6':'#2E4BD8',tip:{format:{date:label,value:v=>pensionFormat(v,p.unit)}}}));
 const svg=Plot.plot({narrow:false,width:W,height:mobile?310:340,marginLeft:66,marginRight:48,marginTop:20,marginBottom:54,style:{fontFamily:SANS,fontSize:12,color:'#5F6675',background:'transparent'},x:{type:'utc',label:'Published source period',ticks,tickFormat:label},y:{domain:[lo,hi>lo?hi+(hi-lo)*.08:lo+1],label:p.unit==='inr_crore'?'Rupees, crore':expected?'Expected count':'Published count',grid:true,ticks:mobile?4:5,tickFormat:axis},marks});
 svg.setAttribute('data-pension-record',p.id);svg.setAttribute('data-observation-kind',p.sourceQuality.observationKind);svg.setAttribute('data-compact','pensions');
 return svg;
}
