import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {queueCharts} from '../src/charts/plumbing.js';
import {awaitChartJobs} from '../scripts/lib/chart-ready.mjs';
test('queued charts yield, print drains once, and readiness covers every independent job',async()=>{
 const dom=new JSDOM('<body></body>'),doc=dom.window.document,seen=[];
 let tick=0;dom.window.performance.now=()=>tick+=30;
 const draw=p=>{seen.push(p.id);const node=doc.createElement('span');node.textContent=p.id;doc.body.append(node);};
 const a=queueCharts(Array.from({length:20},(_,i)=>({id:'a'+i})),draw,{doc});
 const b=queueCharts(Array.from({length:20},(_,i)=>({id:'b'+i})),draw,{doc});
 assert.ok(seen.length<40,'initial module evaluation must yield before all charts');
 dom.window.dispatchEvent(new dom.window.Event('beforeprint'));
 dom.window.dispatchEvent(new dom.window.Event('beforeprint'));
 await awaitChartJobs(doc,1000);
 await new Promise(r=>setTimeout(r,10));
 assert.equal(seen.length,40);assert.equal(new Set(seen).size,40);assert.equal(a.completed,20);assert.equal(b.completed,20);
 dom.window.close();
});
test('a failed chart leaves subsequent charts rendered and rejects readiness',async()=>{
 const dom=new JSDOM('<body><div id="plot-bad"></div></body>'),doc=dom.window.document,seen=[];
 const job=queueCharts([{id:'good'},{id:'bad'},{id:'last'}],p=>{if(p.id==='bad')throw Error('bad data');seen.push(p.id);},{doc});
 await assert.rejects(awaitChartJobs(doc,1000),/bad data/);assert.deepEqual(seen,['good','last']);assert.equal(job.completed,3);assert.equal(doc.querySelector('[role="alert"]').textContent,'This chart could not load.');dom.window.close();
});
test('readiness times out instead of accepting a permanently incomplete job',async()=>{
 await assert.rejects(awaitChartJobs({__atlasChartJobs:[{promise:new Promise(()=>{}),total:1,completed:0,errors:[]}]},5),/timed out/);
});
