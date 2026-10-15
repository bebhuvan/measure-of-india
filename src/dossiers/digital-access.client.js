import {unpackDigitalPayload} from './digital-access.payload.js';
import {digitalPlot} from './digital-access.plot.js';import {digitalFormat} from './digital-access.format.js';
import {a11y,downloadSVG,downloadPNG,saveBlob,queueCharts} from '../charts/plumbing.js';
const model=unpackDigitalPayload(JSON.parse(document.getElementById('digital-access-data').textContent));
for(const [id,f]of Object.entries(model.facts)){const el=document.getElementById('n-'+id);if(el)el.textContent=digitalFormat(f.value,f.unit);}
const widths=new Map(model.plates.map(p=>[p.id,document.getElementById('plot-'+p.id)?.clientWidth||1120]));
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
queueCharts(model.plates,p=>{
 p.rows=p.rows.map(r=>({...r,unit:p.unit}));
 const target=document.getElementById('plot-'+p.id);if(!target)throw Error('Missing digital plot '+p.id);const block=document.getElementById('cb-'+p.id),title=block.querySelector('h3').textContent.trim(),plot=digitalPlot(p,p.rows,widths.get(p.id));target.append(plot);a11y(plot,title,p.rows.map(r=>r.name+': '+digitalFormat(r.value,r.unit)).join('; '));document.getElementById('pv-'+p.id).textContent=digitalFormat(p.rows[0].value,p.unit);
 const meta={title,sub:block.querySelector('.plate-head .sub').textContent.trim(),foot:block.querySelector('.plotfoot .src').textContent.trim()};const csv='cut,value,unit,period,bundle,series,state_survey_households,rse_percent\n'+p.rows.map(r=>[r.name,r.value,r.unit,p.period,r.bundle??p.bundle,r.series,r.quality?.households,r.quality?.rse].map(quote).join(',')).join('\n');
 block.querySelectorAll('[data-dl]').forEach(button=>button.addEventListener('click',()=>{const name='india-atlas_digital-access_'+p.id;if(button.dataset.dl==='svg')downloadSVG(plot,name,meta);if(button.dataset.dl==='png')downloadPNG(plot,name,meta);if(button.dataset.dl==='csv')saveBlob(new Blob([csv],{type:'text/csv'}),name+'.csv');}));
});
