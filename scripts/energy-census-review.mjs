import fs from 'node:fs';
const census=JSON.parse(fs.readFileSync('pipeline/out/census-energy.json')),review=[];
for(const b of census.bundles){const bundle=JSON.parse(fs.readFileSync("data/series/"+b.slug+".json"));const stats={slug:b.slug,series:b.series.length,observations:0,gaps:0,lead:[],show:[],summarize:[],skip:[]};for(const s of b.series){stats.observations+=s.nonNull;stats.gaps+=s.nullShare>0?1:0; const dims=bundle.series[s.key].dims;
 if(bundle.meta.unit==='source_scaled_gwh')stats.skip.push({key:s.key,reason:'Published PJ branch scales GWh values under an unchanged GWh label; audit only.'});
 else if(dims.fuel==='Total' || ['Total','Demand','Emissions intensity'].includes(dims.variable) || dims.state==='India Total'||dims.state==='India')stats.lead.push(s.key);
 else if(dims.state)stats.summarize.push(s.key);else stats.show.push(s.key);
 }review.push(stats);}
fs.writeFileSync('docs/status/energy-census-review.json',JSON.stringify(review,null,1));console.log(review.map(({lead,show,summarize,skip,...s})=>({...s,lead:lead.length,show:show.length,summarize:summarize.length,skip:skip.length})));
