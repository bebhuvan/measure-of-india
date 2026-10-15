import * as Plot from '@observablehq/plot';
import {MONO} from '../charts/plumbing.js';
import {digitalFormat} from './digital-access.format.js';

// Choose geometry once at load: a phone puts the label above the measure,
// preserving readable type and the full comparison within the available width.
export function digitalLabelLines(text, width) {
 const limit=Math.max(18,Math.floor((width-40)/7.2));
 const lines=[];let line='';
 for(const word of text.split(/\s+/)){
  if(line && (line+' '+word).length>limit){lines.push(line);line=word;}
  else line=line?line+' '+word:word;
 }
 if(line)lines.push(line);
 return lines;
}
export function digitalPlot(p, rows, availableWidth=1120) {
 const width=Number.isFinite(availableWidth)&&availableWidth>0?Math.floor(availableWidth):1120;
 const compact=width<=680;
 const published=rows.filter(r=>r.value!==null),max=Math.max(...published.map(r=>r.value),0.1), min=0, end=p.unit==='pct'?110:max*1.18, start=0;
 const lines=rows.map(r=>digitalLabelLines(r.name,compact?width:340));
 const lineCount=Math.max(...lines.map(l=>l.length));
 const rowHeight=compact?lineCount*15+34:Math.max(29,lineCount*15+12);
 const top=compact?lineCount*15+30:22;
 const unit=p.unit==='pct'?'Per cent →':p.unit==='pct_rse'?'Relative standard error (%) →':'Households surveyed →';
 const labelMarks=Array.from({length:lineCount},(_,i)=>Plot.text(rows,{x:start,y:'name',text:(_,j)=>lines[j][i]??'',dx:compact?0:-16,dy:compact?-(lineCount-i)*15-8:i*15-(lineCount-1)*7.5,textAnchor:compact?'start':'end',fill:'#4A5160',fontSize:12}));
 const plot=Plot.plot({narrow:false,width,height:Math.max(210,rows.length*rowHeight+top+52),marginLeft:compact?20:340,marginRight:compact?100:120,marginTop:top,marginBottom:52,style:{fontFamily:MONO,fontSize:'12px',background:'white',color:'#4A5160'},
  x:{domain:[start,end],grid:!compact,ticks:compact?(p.unit==='pct'?[0,100]:[0,max]):5,label:unit,tickFormat:v=>v.toLocaleString('en-IN',{maximumFractionDigits:3})},
  y:{domain:rows.map(r=>r.name),label:null,axis:null,tickSize:0,tickFormat:t=>t},
  marks:[compact?Plot.ruleY(rows,{y:'name',x1:start,x2:end,stroke:'#D3D7DE'}):Plot.ruleX([0],{stroke:'#D3D7DE'}),...labelMarks,Plot.dot(published,{x:'value',y:'name',r:3.5,fill:'#2E4BD8',title:r=>r.name+'\n'+digitalFormat(r.value,r.unit)}),Plot.text(rows,{x:compact?end:r=>r.value??0,y:'name',text:r=>digitalFormat(r.value,r.unit),dx:compact?88:10,textAnchor:compact?'end':'start',fill:'#161A22',fontSize:12})]});
 if(compact)plot.setAttribute('data-compact','digital-access');
 return plot;
}
