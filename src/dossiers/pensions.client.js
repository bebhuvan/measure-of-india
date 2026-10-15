import {unpackGovernedPensionPayload} from './pensions.payload.js';
import {pensionClientCSV} from './pensions.client-record.js';
import {pensionPlot,pensionFormat} from './pensions.plot.js';
import {a11y,downloadSVG,downloadPNG,saveBlob,queueCharts,SANS} from '../charts/plumbing.js';
import {measurePeriodLabels} from '../charts/source-period-ticks.js';
const plates=unpackGovernedPensionPayload(JSON.parse(document.getElementById('pensions-data').textContent));
// Measure formatted source labels and container sizes before queued SVG writes.
const labelWidths=measurePeriodLabels(plates.flatMap(p=>p.dates.map(d=>p.meta.periodLabels[d])),{fontFamily:SANS,fontSize:12});
const widths=new Map(plates.map(p=>[p.id,document.getElementById('plot-'+p.id)?.clientWidth||1120]));
queueCharts(plates,p=>{
 const csv=pensionClientCSV(p),zone=document.getElementById('plot-'+p.id),block=document.getElementById('cb-'+p.id);
 if(!zone||!block)throw Error('Missing governed pension plate '+p.id);
 const plot=pensionPlot(p,widths.get(p.id),labelWidths),title=block.querySelector('h3').textContent.trim();zone.append(plot);
 a11y(plot,title,p.rows.map(r=>r.name+': '+pensionFormat(r.value,r.unit)).join('; '));
 const meta={title,sub:block.querySelector('.sub').textContent.trim(),foot:block.querySelector('.plotfoot .src').textContent.trim()};
 for(const button of block.querySelectorAll('[data-dl]'))button.addEventListener('click',()=>{
  const name='india-atlas_'+p.id;
  if(button.dataset.dl==='svg')downloadSVG(plot,name,meta);
  if(button.dataset.dl==='png')downloadPNG(plot,name,meta);
  if(button.dataset.dl==='csv')saveBlob(new Blob([csv],{type:'text/csv'}),name+'.csv');
 });
});
