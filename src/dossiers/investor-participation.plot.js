import * as Plot from '../charts/plot.js';
import {MONO} from '../charts/plumbing.js';
import {sourcePeriodTicks,measurePeriodLabels} from '../charts/source-period-ticks.js';
import {assertInvestorPlate} from './investor-participation.guard.js';
import {investorFormat} from './investor-participation.format.js';
const axis=v=>v.toLocaleString('en-IN',{maximumSignificantDigits:3});
const ns='http://www.w3.org/2000/svg';
const graphics=new WeakMap();
export function assertInvestorGraphic(p,svg){assertInvestorPlate(p);if(graphics.get(svg)!==p)throw Error('Investor graphic is not bound to this verified source record');return svg;}
function bindGraphic(p,svg){graphics.set(svg,p);svg.dataset.compact="true";svg.dataset.investorRecord=p.id;svg.dataset.qualityVersion=p.qualityVersion;return svg;}
export function investorSourceRows(p){assertInvestorPlate(p);return p.source.dates.map((date,i)=>({date,label:p.periodLabels[date],value:p.source.record.data[i]}));}
function labelCandidates(text){const words=String(text).trim().split(/\s+/);return words.flatMap((_,i)=>words.slice(i).map((_,n)=>words.slice(i,i+n+1).join(' ')));}
export function wrapInvestorLabel(text,available,measure){const lines=[];let line='';for(const word of text.trim().split(/\s+/)){if(measure(word)>available)return null;const next=line?line+' '+word:word;if(line&&measure(next)>available){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
export function wrapInvestorCharacters(text,available,measure){const lines=[];let line='',advance=0;for(const char of String(text)){const w=!char.trim()?8:/[\p{Cf}\p{M}]/u.test(char)?0:measure(char)+.5;if(line&&advance+w>available){lines.push(line);line='';advance=0;}line+=char;advance+=w;}if(line)lines.push(line);return lines;}
export function prepareInvestorGeometry(plates,widthOf,{document=globalThis.document}={}){
 // All container reads and all native SVG text reads happen before queued chart writes.
 const widths=new Map(plates.map(p=>{assertInvestorPlate(p);const w=Math.floor(widthOf(p));if(!Number.isFinite(w)||w<=0)throw Error('Investor requires a measured positive container width');return[p.id,w];}));
 const labelSets=plates.map(p=>{const values=p.source.record.data.filter(v=>v!==null),lo=Math.min(0,...values),hi=Math.max(0,...values),ticks=lo===hi?[lo]:[lo,(lo+hi)/2,hi];return{p,ticks,lo,hi};});
 const labels=labelSets.flatMap(({p,ticks})=>[...Object.values(p.periodLabels),...ticks.map(axis),p.rows[0].name,...labelCandidates(p.rows[0].name),...investorSourceRows(p).map(r=>investorFormat(r.value,p.unit))]);
 const glyphs=[...new Set(labels.join(''))].filter(c=>c.trim()&&!/[\p{Cf}\p{M}]/u.test(c));
 const measures=measurePeriodLabels([...labels,...glyphs],{document,fontFamily:MONO,fontSize:12});
 const measure=text=>{const v=measures.get(text);if(v===undefined)throw Error('Investor label was not premeasured');return v;};
 const exportWrap=(text,available)=>wrapInvestorCharacters(text,available,measure);
 const wrap=(text,available)=>wrapInvestorLabel(text,available,measure);
 return new Map(labelSets.map(({p,ticks,lo,hi})=>{
  const width=widths.get(p.id),available=Math.max(1,width-32),lines=wrap(p.rows[0].name,available);
  const sourceRows=investorSourceRows(p),exportRows=sourceRows.map(r=>({label:exportWrap(r.label,available),value:exportWrap(investorFormat(r.value,p.unit),available)}));
  const marginLeft=Math.max(56,...ticks.map(v=>measure(axis(v))+18)),marginRight=Math.max(32,...Object.values(p.periodLabels).map(t=>measure(t)/2+8));
  const fallback=width<240||!lines||marginLeft+marginRight+48>width||sourceRows.some(r=>measure(investorFormat(r.value,p.unit))>available);
  const base={width,height:width<700?330:370,sourceRows,exportRows,exportName:exportWrap(p.rows[0].name,available),lines,fallback,marginLeft,marginRight,yTicks:ticks,yDomain:lo===hi?[lo,lo+1]:[lo,hi]};
  if(fallback)return[p.id,base];
  if(p.type==='history'){
   const points=p.rows[0].points,dates=points.map(p=>+new Date(p.date+'T00:00:00Z')),start=dates[0],end=dates.at(-1),published=points.filter(p=>p.value!==null),left=marginLeft,right=width-marginRight;
   const x=time=>end===start?(left+right)/2:left+(time-start)/(end-start)*(right-left);
   const first=+new Date(published[0].date+'T00:00:00Z'),last=+new Date(published.at(-1).date+'T00:00:00Z');
   const tickDates=first===last?([published[0]].filter(r=>{const w=measure(p.periodLabels[r.date]);return x(first)-w/2>=0&&x(first)+w/2<=width;}).map(r=>new Date(r.date+'T00:00:00Z'))):sourcePeriodTicks(points,{range:[x(first),x(last)],canvasWidth:width,maxTicks:width<700?3:6,format:date=>p.periodLabels[date.toISOString().slice(0,10)],measure});
   return[p.id,{...base,ticks:tickDates,xDomain:[new Date(start),new Date(end)]}];
  }
  return[p.id,{...base,height:Math.max(220,lines.length*18+160)}];
 }));
}
function sourceTable(p,{document=globalThis.document,caption=p.title}={}){
 const table=document.createElement('table');table.className='investor-source-table';table.style.cssText='width:100%;table-layout:fixed;overflow-wrap:anywhere;font-size:12px';const c=document.createElement('caption');c.textContent=caption;table.append(c);
 const thead=document.createElement('thead'),tr=document.createElement('tr');for(const text of ['Published reference period',p.unit==='inr_crore'?'Value, ₹ crore':'Value, '+p.unit]){const th=document.createElement('th');th.scope='col';th.textContent=text;tr.append(th);}thead.append(tr);table.append(thead);const body=document.createElement('tbody');
 for(const r of investorSourceRows(p)){const row=document.createElement('tr'),period=document.createElement('th'),value=document.createElement('td');period.scope='row';period.textContent=r.label;value.textContent=investorFormat(r.value,p.unit);value.dataset.sourceValue=r.value===null?'null':String(r.value);row.append(period,value);body.append(row);}table.append(body);return table;
}
export function investorSourceTable(p,opts){assertInvestorPlate(p);return sourceTable(p,opts);}
function tableSVG(p,g,document){
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('width',String(g.width));svg.style.fontFamily=MONO;svg.style.fontSize='12px';svg.style.background='white';let y=22;
 const line=(text,color='#161A22')=>{const t=document.createElementNS(ns,'text');t.setAttribute('x','16');t.setAttribute('y',String(y));t.setAttribute('fill',color);t.setAttribute('font-size','12');t.textContent=text;svg.append(t);y+=18;};
 for(const name of g.exportName)line(name);y+=10;for(const row of g.exportRows){for(const text of row.label)line(text,'#4A5160');for(const text of row.value)line(text);y+=12;}
 svg.setAttribute('height',String(y+8));svg.setAttribute('viewBox',`0 0 ${g.width} ${y+8}`);svg.dataset.investorFallback='full-label-source-table';return svg;
}
export function investorPlot(p,g,{document=globalThis.document}={}){
 assertInvestorPlate(p);if(!g||!Number.isFinite(g.width))throw Error('Investor requires prepared geometry');
 if(g.fallback)return{element:sourceTable(p,{document}),svg:bindGraphic(p,tableSVG(p,g,document)),fallback:true};
 const style={fontFamily:MONO,fontSize:'12px',color:'#4A5160',background:'white'},unit=p.unit==='inr_crore'?'₹ crore':p.unit;
 let svg;
 if(p.type==='history'){
  const points=p.rows[0].points.map(r=>({...r,date:new Date(r.date+'T00:00:00Z')}));
  svg=Plot.plot({document,narrow:false,width:g.width,height:g.height,marginLeft:g.marginLeft,marginRight:g.marginRight,marginTop:25,marginBottom:60,style,x:{type:'utc',domain:g.xDomain,ticks:g.ticks,tickPadding:10,tickFormat:date=>p.periodLabels[date.toISOString().slice(0,10)],label:null},y:{domain:g.yDomain,ticks:g.yTicks,label:unit,labelArrow:false,grid:true,tickFormat:axis},marks:[Plot.ruleY([0],{stroke:'#C9CED6'}),Plot.line(points,{x:'date',y:'value',stroke:'#2E4BD8',strokeWidth:2}),Plot.dot(points.filter(r=>r.value!==null).slice(-1),{x:'date',y:'value',r:3.5,fill:'#2E4BD8',title:r=>p.periodLabels[r.date.toISOString().slice(0,10)]+'\n'+investorFormat(r.value,p.unit)})]});
 }else{
  const labels=g.lines.map((line,i)=>({line,y:18+i*18})),pointY=labels.length*18+50,valueText=investorFormat(p.rows[0].value,p.unit);
  svg=Plot.plot({document,narrow:false,width:g.width,height:g.height,marginLeft:16,marginRight:16,marginTop:0,marginBottom:45,style,x:{domain:g.yDomain,ticks:g.yTicks,label:unit,labelArrow:false,tickFormat:axis},y:{domain:[g.height-45,0],axis:null},marks:[Plot.text(labels,{x:g.yDomain[0],y:'y',text:'line',textAnchor:'start',fontSize:12}),Plot.ruleY([pointY],{stroke:'#ECEEF1'}),Plot.dot([{value:p.rows[0].value,y:pointY}],{x:'value',y:'y',r:3.5,fill:'#2E4BD8'}),Plot.text([{text:valueText,y:pointY+24}],{x:g.yDomain[1],y:'y',text:'text',textAnchor:'end',fontSize:12})]});
 }
 bindGraphic(p,svg);return{element:svg,svg,fallback:false};
}
