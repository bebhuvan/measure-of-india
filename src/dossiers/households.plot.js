import * as Plot from '@observablehq/plot';
import {MONO} from '../charts/plumbing.js';
import {householdFormat} from './households.format.js';

// Choose geometry once at load: a phone puts the label above the measure,
// preserving readable type and the full comparison within the available width.
export function householdLabelLines(text, width) {
 const limit=Math.max(18,Math.floor((width-40)/7.2));
 const lines=[];let line='';
 for(const word of text.split(/\s+/)){
  if(line && (line+' '+word).length>limit){lines.push(line);line=word;}
  else line=line?line+' '+word:word;
 }
 if(line)lines.push(line);
 return lines;
}
export function householdPlot(p, rows, availableWidth=1120) {
 const compact=availableWidth>0 && availableWidth<=680;
 const width=compact?Math.floor(availableWidth):1120;
 const max=Math.max(...rows.map(r=>r.value),0.1), end=max*1.18;
 const lines=rows.map(r=>householdLabelLines(r.name,compact?width:340));
 const lineCount=Math.max(...lines.map(l=>l.length));
 const rowHeight=compact?lineCount*15+34:Math.max(29,lineCount*15+12);
 const top=compact?lineCount*15+30:22;
 const unit=p.unit==='per_1000'?'Per 1,000 →':p.unit==='inr'?'Rupees →':'Rupee lakh (aggregate amount) →';
 const labelMarks=Array.from({length:lineCount},(_,i)=>Plot.text(rows,{x:0,y:'name',text:(_,j)=>lines[j][i]??'',dx:compact?0:-16,dy:compact?-(lineCount-i)*15-8:i*15-(lineCount-1)*7.5,textAnchor:compact?'start':'end',fill:'#4A5160',fontSize:12}));
 const plot=Plot.plot({narrow:false,width,height:Math.max(210,rows.length*rowHeight+top+52),marginLeft:compact?20:340,marginRight:compact?100:120,marginTop:top,marginBottom:52,style:{fontFamily:MONO,fontSize:'12px',background:'white',color:'#4A5160'},
  x:{domain:[0,end],grid:!compact,ticks:compact?[0,max]:5,label:unit,tickFormat:v=>compact && v===0?'0':compact && p.unit==='count' && v>=1e5?householdFormat(v,v>=1e7?'crore':'lakh'):householdFormat(v,p.unit)},
  y:{domain:rows.map(r=>r.name),label:null,axis:null,tickSize:0,tickFormat:t=>t},
  marks:[compact?Plot.ruleY(rows,{y:'name',x1:0,x2:end,stroke:'#D3D7DE'}):Plot.ruleX([0],{stroke:'#D3D7DE'}),...labelMarks,Plot.dot(rows,{x:'value',y:'name',r:3.5,fill:'#2E4BD8',title:r=>r.name+'\n'+householdFormat(r.value,r.unit)}),Plot.text(rows,{x:compact?end:'value',y:'name',text:r=>householdFormat(r.value,r.unit),dx:compact?88:10,textAnchor:compact?'end':'start',fill:'#161A22',fontSize:12})]});
 if(compact)plot.setAttribute('data-compact','households');
 return plot;
}
