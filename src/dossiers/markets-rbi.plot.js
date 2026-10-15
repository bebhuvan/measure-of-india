// Family-local full-name charts. Labels are above each row, values in a separate column.
import * as Plot from '@observablehq/plot';
import {a11y,fmt,MONO,downloadSVG,downloadPNG,saveBlob} from '../charts/plumbing.js';
const wrap=(s,chars)=>{const lines=[];let line='';for(const word of String(s).split(/\s+/)){if((line+' '+word).trim().length>chars&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;};
export const rbiFormat=(v,unit)=>v==null?'—':unit==='count'?fmt.count(v):unit==='times'?fmt.x1(v):unit==='inr_crore'?'₹'+v.toLocaleString('en-IN',{maximumFractionDigits:0})+' crore':fmt.pct1Minus(v);
export function rbiComparison(figId,plotId,rows,unit) {
 const zone=document.getElementById(plotId);if(!zone)return;
 const width=Math.max(220,Math.min(1184,zone.getBoundingClientRect().width||Math.min(1184,(globalThis.innerWidth||1280)-96)));
 const chars=Math.max(20,Math.floor((width-24)/7.2));let y=38;const labels=[],marks=[];
 for(const r of rows){const lines=wrap(r.label,chars);for(const line of lines){labels.push({text:line,y});y+=16;}marks.push({...r,y:y+8});y+=42;}
 const values=rows.map(r=>r.value).filter(v=>v!=null),lo=Math.min(0,...values),hi=Math.max(0,...values),pad=(hi-lo||1)*.06,domain=[lo-pad,hi+pad];
 const moneyScale=unit==='inr_crore'&&Math.max(Math.abs(lo),Math.abs(hi))>=1e5?1e5:1;
 const h=y+8,base=marks.filter(r=>r.value!=null),plot=Plot.plot({width,height:h,marginTop:26,marginBottom:0,marginLeft:12,marginRight:unit==='inr_crore'?125:85,style:{fontFamily:MONO,fontSize:'12px',color:'#161A22',background:'transparent'},
  x:{domain,axis:'top',ticks:Math.max(2,Math.floor(width/160)),label:unit==='count'?'companies':unit==='times'?'times':unit==='inr_crore'?(moneyScale===1e5?'₹ lakh crore':'₹ crore'):'per cent',labelArrow:false,tickFormat:v=>String((v/moneyScale).toLocaleString('en-IN',{maximumFractionDigits:1})),tickSize:0},y:{domain:[h,0],axis:null},
  marks:[Plot.link(base,{x1:0,x2:'value',y1:'y',y2:'y',stroke:r=>r.value<0?'#C47A16':'#2E4BD8',strokeWidth:3}),Plot.dot(base,{x:'value',y:'y',fill:r=>r.value<0?'#C47A16':'#2E4BD8',r:3}),
   Plot.text(labels,{x:domain[0],y:'y',text:'text',textAnchor:'start',fill:'#161A22',fontSize:12}),
   Plot.text(marks,{x:domain[1],y:'y',text:r=>rbiFormat(r.value,unit),dx:10,textAnchor:'start',fill:'#161A22',fontSize:12})]});
 a11y(plot,document.querySelector(`#${figId} h3`)?.textContent??figId,rows.map(r=>`${r.label}: ${rbiFormat(r.value,unit)}`).join('; '));zone.append(plot);
 const csv=[['group','value','unit'],...rows.map(r=>[r.label,r.value??'',unit])].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
 wireRbiTools(figId,plot,csv);
 return plot;
}
export function rbiTime(figId,plotId,list,{unit='pct',dateFmt}={}) {
 const zone=document.getElementById(plotId);if(!zone)return;
 const width=Math.max(220,Math.min(1184,zone.getBoundingClientRect().width||Math.min(1184,(globalThis.innerWidth||1280)-96)));
 // Separate rows give every series its own readable axis and full name on a phone.
 const marks=[],values=list.flatMap(s=>s.data.map(p=>p.value)).filter(v=>v!=null),lo=Math.min(0,...values),hi=Math.max(0,...values),pad=(hi-lo||1)*.12;
 const height=260*list.length;
 const data=list.flatMap(s=>s.data.map(p=>({...p,series:s.label,color:s.color}))),last=list.map(s=>({...s.data.filter(p=>p.value!=null).at(-1),series:s.label}));
 const plot=Plot.plot({width,height,marginLeft:45,marginRight:14,marginTop:42,marginBottom:35,style:{fontFamily:MONO,fontSize:'12px',color:'#161A22',background:'transparent'},
  x:{type:'utc',ticks:Math.max(2,Math.floor(width/100)),label:null,tickFormat:d=>String(d.getUTCFullYear()),tickSize:0},y:{domain:[lo-pad,hi+pad],label:unit==='times'?'times':'per cent',labelArrow:false,ticks:4},fy:{domain:list.map(s=>s.label),label:null,axis:null},
  marks:[Plot.text(last.map(p=>({...p,text:p.series+': '+rbiFormat(p.value,unit)})),{fy:'series',frameAnchor:'top-left',dx:0,dy:-20,text:'text',textAnchor:'start',fill:'#161A22',fontSize:12}),Plot.ruleY([0],{stroke:'#D3D7DE'}),Plot.lineY(data,{x:'date',y:'value',fy:'series',stroke:'color',z:'series',strokeWidth:1.75}),Plot.dot(last,{x:'date',y:'value',fy:'series',r:3,fill:'#2E4BD8'})]});
 a11y(plot,document.querySelector(`#${figId} h3`)?.textContent??figId,last.map(p=>`${p.series}: ${rbiFormat(p.value,unit)} (${dateFmt?.(p.date)??p.date.toISOString().slice(0,10)})`).join('; '));zone.append(plot);
 const dates=[...new Set(data.map(p=>p.date.toISOString().slice(0,10)))].sort();const csv=[['date',...list.map(s=>s.label)],...dates.map(d=>[d,...list.map(s=>s.data.find(p=>p.date.toISOString().slice(0,10)===d)?.value??'')])].map(r=>r.join(',')).join('\n');
 wireRbiTools(figId,plot,csv);return plot;
}

function wireRbiTools(id,plot,csv){const block=document.getElementById(id);const meta={title:block.querySelector('h3')?.textContent,sub:block.querySelector('.sub')?.textContent,foot:block.querySelector('.src')?.textContent};for(const button of block.querySelectorAll('[data-dl]'))button.addEventListener('click',()=>{if(button.dataset.dl==='svg')downloadSVG(plot,id,meta);if(button.dataset.dl==='png')downloadPNG(plot,id,meta);if(button.dataset.dl==='csv')saveBlob(new Blob([csv],{type:'text/csv'}),id+'.csv');});}
