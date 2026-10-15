import {a11y,downloadSVG,downloadPNG,saveBlob,queueCharts} from '../charts/plumbing.js';
import {verifyInvestorPayload,assertInvestorPlate} from './investor-participation.guard.js';
import {investorCSV} from './investor-participation.export.js';
import {investorPlot,prepareInvestorGeometry,assertInvestorGraphic} from './investor-participation.plot.js';
import {investorFormat} from './investor-participation.format.js';
export function exportInvestorPlate(p,svg,kind,{filename,meta,actions={downloadSVG,downloadPNG,saveBlob},Blob:BlobType=globalThis.Blob}={}){
 assertInvestorPlate(p);assertInvestorGraphic(p,svg);if(!['svg','png','csv'].includes(kind))throw Error('Unknown investor download type');
 const csv=investorCSV(p);
 // Shared card wrapping handles spaces; introduce line-break opportunities in an oversized source token without dropping any character.
 const width=Number(svg?.getAttribute('width'));if(!Number.isFinite(width)||width<=0)throw Error('Investor image export requires its verified graphic');
 const wrap=(text,size)=>String(text??'').split(/(\s+)/).map(word=>word.length>Math.max(4,Math.floor(width/(size*.65)))?[...word].reduce((lines,char,i)=>lines+(i&&i%Math.max(4,Math.floor(width/(size*.65)))===0?' ': '')+char,''):word).join('');
 meta={title:wrap(p.title,30),sub:wrap(p.sub,15),foot:wrap(p.source.meta.source+'. '+p.sourceQuality.definition,12.5),val:investorFormat(p.rows[0].value,p.unit),valCap:p.period}; // Same verified source guard before every format, including image exports.
 if(kind==='svg')return actions.downloadSVG(svg,filename,meta);
 if(kind==='png')return actions.downloadPNG(svg,filename,meta);
 return actions.saveBlob(new BlobType([csv],{type:'text/csv;charset=utf-8'}),filename+'.csv');
}
export function mountInvestor(doc=globalThis.document,{crypto=globalThis.crypto,actions,measureWidth=el=>el.clientWidth}={}){
 const node=doc?.getElementById('investor-participation-data');if(!node)return null;
 // Register preparation synchronously so QC/print readiness cannot race asynchronous fingerprint verification.
 const job={total:0,completed:0,errors:[],promise:null};(doc.__atlasChartJobs??=[]).push(job);
 job.promise=(async()=>{
  const parsed=JSON.parse(node.textContent);if(!node.dataset.qualityVersion||parsed.qualityVersion!==node.dataset.qualityVersion)throw Error('Investor DOM and payload quality versions differ');
  const model=await verifyInvestorPayload(parsed,{crypto});
  if(doc.fonts?.ready)await doc.fonts.ready;
  const targets=new Map(model.plates.map(p=>{const el=doc.getElementById('plot-'+p.id);if(!el)throw Error('Missing investor plot '+p.id);return[p.id,el];}));
  const geometry=prepareInvestorGeometry(model.plates,p=>measureWidth(targets.get(p.id)),{document:doc});
  // No layout reads after this point. Print drains the existing shared queue synchronously.
  for(const f of model.facts){const el=doc.getElementById('n-'+f.id);if(el)el.textContent=investorFormat(f.value,f.unit);}
  const task=queueCharts(model.plates,p=>{
   const target=targets.get(p.id),figure=doc.getElementById('cb-'+p.id);if(!figure)throw Error('Missing investor figure '+p.id);
   const result=investorPlot(p,geometry.get(p.id),{document:doc}),title=figure.querySelector('h3')?.textContent;
   if(!title)throw Error('Missing investor chart title '+p.id);
   a11y(result.svg,title,p.sourceQuality.definition+' '+p.sourceQuality.referenceBasis);
   target.replaceChildren(result.element);target.dataset.investorComplete='true';target.dataset.investorLayout=result.fallback?'source-table':'plot';
   const pv=doc.getElementById('pv-'+p.id);if(pv)pv.textContent=investorFormat(p.rows[0].value,p.unit);
   const meta={title,sub:figure.querySelector('.sub')?.textContent??'',foot:figure.querySelector('.src')?.textContent??''},filename='india-atlas_investor-participation_'+p.id;
   for(const button of figure.querySelectorAll('[data-dl]'))button.addEventListener('click',()=>{
    try{exportInvestorPlate(p,result.svg,button.dataset.dl,{filename,meta,actions,Blob:doc.defaultView?.Blob??globalThis.Blob});}
    catch(error){const status=figure.querySelector('[data-export-status]');if(status){status.textContent='This export could not be verified.';status.setAttribute('role','alert');}throw error;}
   });
  },{doc});
  await task.promise;return model;
 })();
 job.promise.catch(error=>{job.errors.push(String(error.message??error));for(const zone of doc.querySelectorAll('[data-investor-plot]'))if(zone.dataset.investorComplete!=='true'){const alert=doc.createElement('p');alert.setAttribute('role','alert');alert.textContent='This source record could not be verified.';zone.replaceChildren(alert);} });
 doc.__atlasInvestorReady=job.promise;return job;
}
if(typeof document!=='undefined')mountInvestor(document);
