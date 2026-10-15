import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearch,unitIntent,parseQuery} from '../src/dossiers/search-core.js';
import {ROWS_PER_CHUNK} from '../src/dossiers/search-pack.js';
import {searchFixture} from './search-fixture.mjs';
const base={guides:[['jobs','Employment','Labour measures']],bundles:[{slug:'b',title:'Workers',cut:'survey',guide:0,rows:[['Urban female','',1,'2026','s0',[]],['Urban female workers','',2,'2026','s1',[]]]}]};
const {core,files}=searchFixture(base);
const get=p=>{if(!(p in files))throw Error('missing '+p);return files[p];};
test('cold independent search requests overlap and identical requests are shared',async()=>{
 let active=0,peak=0;const calls=[];
 const engine=createSearch(core,async p=>{calls.push(p);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,10));active--;return get(p);});
 const a=await engine.series('female urban',{limit:2});
 assert.equal(a.rows.length,2);assert.ok(peak>=2,'independent shard, row and bundle loads must overlap');
 const count=calls.length;assert.deepEqual(await engine.series('female urban',{limit:2}),a);assert.equal(calls.length,count);
});
test('a transient failed shard can be retried',async()=>{
 let failed=false;const engine=createSearch(core,async p=>{if(!failed){failed=true;throw Error('offline');}return get(p);});
 await assert.rejects(engine.series('female'));assert.equal((await engine.series('female')).rows.length,2);
});
test('cancelled search stops before fetching row chunks',async()=>{
 const controller=new AbortController(),calls=[];
 const engine=createSearch(core,async p=>{calls.push(p);controller.abort();return get(p);});
 await assert.rejects(engine.series('female',{signal:controller.signal}),{name:'AbortError'});
 assert.ok(calls.every(p=>p.startsWith('t/')),calls.join());
});
test('spelling suggestions require one unambiguous vocabulary edit and leave valid words intact',async()=>{
 const f=searchFixture({...base,bundles:[{...base.bundles[0],rows:[...base.bundles[0].rows,['Inflation','',3,'2026','s2',[]]]}]});
 const S=createSearch(f.core,f.load);
 assert.equal(await S.suggest('inflaton'),'inflation');assert.equal(await S.suggest('inflaiton'),'inflation');
 assert.equal(await S.suggest('female urban'),null);assert.equal(await S.suggest('zzzzimpossible'),null);
 const amb=searchFixture({guides:base.guides,bundles:[{slug:'p',title:'P',rows:[['Plant','',1,'2026','s0',[]],['Plans','',1,'2026','s1',[]]]}]});
 assert.equal(await createSearch(amb.core,amb.load).suggest('planz'),null);
});
test('an unknown word fetches at most one small token shard and never rows or the vocabulary',async()=>{
 const paths=[];const S=createSearch(core,async p=>{paths.push(p);return get(p);});
 assert.equal((await S.series('zzzzimpossible')).total,0);
 assert.ok(paths.filter(p=>p.startsWith('t/')).length<=1,paths.join());assert.ok(!paths.some(p=>p.startsWith('r/')||p.startsWith('x/')),paths.join());
});
test('row cache remains bounded over a long search session',async()=>{
 const n=60*ROWS_PER_CHUNK,f=searchFixture({guides:base.guides,bundles:[{slug:'b',title:'Workers',rows:Array.from({length:n},(_,i)=>['A worker','',1,'2026','s'+i,[]])}]});
 const paths=[];const S=createSearch(f.core,async p=>{paths.push(p);return f.load(p);});
 await S.rowsAt(Array.from({length:60},(_,i)=>i*ROWS_PER_CHUNK));const before=paths.filter(p=>p.startsWith('r/')).length;
 await S.rowsAt([0]);assert.equal(paths.filter(p=>p.startsWith('r/')).length,before+1,'oldest row chunk is evicted after 48 chunks');
});
test('matching guide destinations are emitted before row files finish',async()=>{
 let release,announced=false;
 const gate=new Promise(r=>release=r);
 const S=createSearch(core,async p=>{if(p.startsWith('r/')){assert.equal(announced,true);await gate;}return get(p);});
 const result=S.series('female urban',{onCandidates: x=>{announced=true;assert.equal(x.guides[0].href,'/guides/jobs/');release();}});
 assert.equal((await result).rows.length,2);
});
test('quality status suppresses misleading numbers while preserving original lookup and source identity',async()=>{
 const f=searchFixture({...base,bundles:[{...base.bundles[0],reviewAnchor:'s0'}],quality:{version:'q1',default:'good',policies:{good:{id:'good',canInterpret:true},held:{id:'held',canInterpret:false,status:'review-pending',publicTitle:'Source mapping under review'}},bundles:{b:'held'},rowOverrides:{good:[1]}}});
 const S=createSearch(f.core,f.load);const r=await S.series('female urban');
 const held=r.rows.find(x=>x.identity==='b:s0');assert.equal(held.latest,null);assert.deepEqual(held.recent,[]);assert.equal(held.label,'Source mapping under review');assert.equal(held.originalLabel,'Urban female');assert.equal(held.quality.status,'review-pending');
 assert.equal(r.rows.find(x=>x.identity==='b:s1').latest,2);
 assert.equal((await S.series('workers')).files[0].href,'/explore/?series=b%3As0');
});
test('missing or mixed-release quality definitions fail closed',()=>{
 assert.throws(()=>createSearch(core,async()=>({}),{expectedQualityVersion:'new'}),/different releases/);
 assert.throws(()=>createSearch({...core,quality:{default:'missing',policies:{},bundles:{},rowOverrides:{}}},async()=>({})),/incomplete/);
 assert.throws(()=>createSearch({...core,v:1},async()=>({})),/older release/);
});
test('pay queries prefer amounts before bounded row selection; explicit shares keep their meaning',async()=>{
 // the share row and the earnings row sit in different row chunks, so with one chunk allowed the
 // preference must be applied before chunks are chosen
 const filler=Array.from({length:ROWS_PER_CHUNK-1},(_,i)=>['Filler '+i,'',0,'2026','f'+i,[]]);
 const rows=[['Share of workers: regular wage or salary, rural','',80,'2026','s0',[]],...filler,['Average rural earnings among regular salaried employees per month','',25000,'2026','s1',[]]];
 const f=searchFixture({guides:base.guides,bundles:[{slug:'b',title:'Workers',rows}],units:{money:[ROWS_PER_CHUNK],relative:[0]}});
 const S=createSearch(f.core,f.load);
 assert.equal((await S.series('rural wages',{limit:1,maxChunks:1})).rows[0].identity,'b:s1');
 assert.equal((await S.series('rural wage share',{limit:1,maxChunks:1})).rows[0].identity,'b:s0');
 assert.deepEqual(new Set((await S.candidates('rural wages')).ids),new Set([0,ROWS_PER_CHUNK]),'ranking does not remove any matching record');
});
test('quantity preferences distinguish price changes, levels and explicit relative measures',()=>{
 for(const [q,want]of [['food inflation','inflation'],['food price index','index'],['salary growth','change'],['share of salary workers','relative'],['number of salary workers','count'],['rural wage rates','money'],['regular wage workers','none'],['salary','money'],['GDP','none']])assert.equal(unitIntent(parseQuery(q),q)??'none',want,q);
});
test('the core does not grow with rows: only the first word of each token shard (about one per 32 KB of postings) and a count per bundle',()=>{
 const small=searchFixture({guides:base.guides,bundles:[{slug:'b',title:'Workers',rows:Array.from({length:100},(_,i)=>['Row '+i,'',1,'2026','s'+i,[]])}]});
 const big=searchFixture({guides:base.guides,bundles:[{slug:'b',title:'Workers',rows:Array.from({length:20000},(_,i)=>['Row '+i,'',1,'2026','s'+i,[]])}]});
 const size=c=>JSON.stringify({...c,rel:'',nSeries:0,bundles:{...c.bundles,count:[]},shards:{...c.shards,tokens:[]}}).length;
 assert.equal(size(big.core),size(small.core));
 assert.ok(big.core.shards.tokens.length<=Math.ceil(Object.entries(big.files).filter(([k])=>k.startsWith('t/')).reduce((a,[,v])=>a+JSON.stringify(v).length,0)/(16*1024)));
});
