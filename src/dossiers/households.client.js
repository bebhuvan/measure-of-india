import {householdPlot} from './households.plot.js';
import {a11y,downloadSVG,downloadPNG,saveBlob,queueCharts} from '../charts/plumbing.js';
import {householdFormat} from './households.format.js';
function wirePlate(blockEl, plot, filename, csvText) {
  const meta = {
    title: blockEl.querySelector(".plate-head h3")?.textContent.trim(),
    sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg" && plot) downloadSVG(plot, filename, meta);
      if (kind === "png" && plot) downloadPNG(plot, filename, meta);
      if (kind === "csv") saveBlob(new Blob([csvText], { type: "text/csv" }), filename + ".csv");
    });
  });
}

const model=JSON.parse(document.getElementById('households-data').textContent);
for(const [id,f] of Object.entries(model.facts)){
 const el=document.getElementById('n-'+id);if(el)el.textContent=householdFormat(f.value,f.unit);
}
// Measure all containers before inserting charts: avoid one full style/layout pass per plate.
const plotWidths=new Map(model.plates.map(p=>{const el=document.getElementById('plot-'+p.id);return [p.id,el?.clientWidth || 1120];}));
queueCharts(model.plates,p=>{
 const el=document.getElementById('plot-'+p.id);if(!el)return;
 const rows=p.rows.map((r,i)=>({...r,index:i}));
 const plot=householdPlot(p,rows,plotWidths.get(p.id));
 el.append(plot);a11y(plot,p.title,rows.map(r=>r.name+': '+householdFormat(r.value,r.unit)).join('; '));
 const pv=document.getElementById('pv-'+p.id);if(pv)pv.textContent=householdFormat(rows[0].value,rows[0].unit);
 const csv='measure,value,unit,period\n'+rows.map(r=>[r.name,r.value,r.unit,p.period].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
 wirePlate(document.getElementById('cb-'+p.id),plot,'india-atlas_households_'+p.id,csv);
});
