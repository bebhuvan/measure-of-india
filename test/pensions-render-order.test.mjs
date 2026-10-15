import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {build} from 'esbuild';import {JSDOM} from 'jsdom';
import {pensionsModel} from '../src/dossiers/pensions.model.js';import {governedPensionPayload} from '../src/dossiers/pensions.payload.js';

test('pension renderer reads every responsive width before SVG writes; print drains and tools retain accessible plots',async()=>{
 const model=pensionsModel(),plates=[...model.plates.slice(0,3),model.plates.find(p=>p.observationKind==='expected-schedule')],contents=fs.readFileSync(process.env.ATLAS_PENSION_CLIENT_UNDER_TEST??'src/dossiers/pensions.client.js','utf8');
 const plumbing=path.resolve('src/charts/plumbing.js');
 const result=await build({stdin:{contents,resolveDir:path.resolve('src/dossiers')},bundle:true,write:false,format:'iife',plugins:[{name:'isolate-plot-drawing',setup(b){
  b.onResolve({filter:/pensions\.plot\.js$/},()=>({path:'plot',namespace:'renderer-test'}));
  b.onResolve({filter:/^\.\.\/charts\/plumbing\.js$/},()=>({path:'tools',namespace:'renderer-test'}));
  b.onLoad({filter:/.*/,namespace:'renderer-test'},args=>({resolveDir:process.cwd(),contents:args.path==='plot'?`export function pensionPlot(p,w){window.draws.push([p.id,w]);const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('width',w);return s;} export function pensionFormat(v){return String(v);}`:`export {queueCharts,a11y,SANS} from ${JSON.stringify(plumbing)};export function downloadSVG(...x){window.exports.push(['svg',...x]);}export function downloadPNG(...x){window.exports.push(['png',...x]);}export function saveBlob(...x){window.exports.push(['csv',...x]);}`}));
 }}]});
 for(const width of [350,1120]){
  const dom=new JSDOM('<body><script type="application/json" id="pensions-data"></script>'+plates.map(p=>`<figure id="cb-${p.id}"><h3>${p.title}</h3><div class="sub">Source context</div><div class="plotzone" id="plot-${p.id}"></div><div class="plotfoot"><span class="src">PFRDA</span><button data-dl="csv"></button><button data-dl="svg"></button><button data-dl="png"></button></div></figure>`).join(''),{runScripts:'outside-only'}),win=dom.window,doc=win.document,reads=[];win.draws=[];win.exports=[];let tick=0;win.performance.now=()=>tick+=30;doc.getElementById('pensions-data').textContent=JSON.stringify(governedPensionPayload(plates));
  for(const p of plates)Object.defineProperty(doc.getElementById('plot-'+p.id),'clientWidth',{get(){reads.push(p.id);assert.equal(doc.querySelectorAll('.plotzone svg').length,0,'Layout-dependent width read followed an SVG insertion');return width;}});
  win.eval(result.outputFiles[0].text);assert.deepEqual(Array.from(doc.__atlasChartJobs.flatMap(j=>j.errors)),[],'Queued renderer must not read layout after an SVG write');assert.deepEqual(reads,plates.map(p=>p.id));assert(win.draws.length<plates.length,'Queued rendering must yield before finishing');
  win.dispatchEvent(new win.Event('beforeprint'));win.dispatchEvent(new win.Event('beforeprint'));await Promise.all(doc.__atlasChartJobs.map(j=>j.promise));await new Promise(r=>setTimeout(r,10));
  assert.equal(win.draws.length,plates.length);assert(win.draws.every(([,w])=>w===width));assert.equal(doc.querySelectorAll('.plotzone svg[role="img"] title').length,plates.length);
  for(const p of plates){const f=doc.getElementById('cb-'+p.id);for(const b of f.querySelectorAll('[data-dl]'))b.click();assert(f.querySelector('svg').getAttribute('aria-label').startsWith(p.title+'.'));}
  assert.equal(win.exports.length,plates.length*3);assert.equal(new Set(win.exports.map(x=>x[0])).size,3);assert(doc.__atlasChartJobs.every(j=>j.completed===j.total&&!j.errors.length));win.close();
 }
});
