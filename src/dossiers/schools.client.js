import {schoolPlot} from './schools.plot.js';
import {a11y,downloadSVG,downloadPNG,saveBlob} from '../charts/plumbing.js';
import {schoolFormat} from './schools.format.js';
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

const model=JSON.parse(document.getElementById('schools-data').textContent);
for(const [id,f] of Object.entries(model.facts)){
 const el=document.getElementById('n-'+id);if(el)el.textContent=schoolFormat(f.value,f.unit);
}
for(const p of model.plates){
 const el=document.getElementById('plot-'+p.id);if(!el)continue;
 const rows=p.rows.map((r,i)=>({...r,index:i}));
 const plot=schoolPlot(p,rows,el.clientWidth || 1120);
 el.append(plot);a11y(plot,p.title,rows.map(r=>r.name+': '+schoolFormat(r.value,r.unit)).join('; '));
 const pv=document.getElementById('pv-'+p.id);if(pv)pv.textContent=schoolFormat(rows[0].value,rows[0].unit);
 const csv='measure,value,unit,period\n'+rows.map(r=>[r.name,r.value,r.unit,p.period].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
 wirePlate(document.getElementById('cb-'+p.id),plot,'india-atlas_schools_'+p.id,csv);
}
