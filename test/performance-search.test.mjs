import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearch,encodeIds,unitIntent,parseQuery} from '../src/dossiers/search-core.js';
const core={guides:[['jobs','Employment','Labour measures']],plates:[],views:[],bundles:[['b','Workers','survey',0,0,2,[[0,'/guides/jobs/']],'']],shards:{frequent:[],tokens:['female','urban'],rows:[0,1]}};
const files={'t/0.json':{female:encodeIds([0,1])},'t/1.json':{urban:encodeIds([0,1])},'r/0.json':[['Urban female','',1,'2026','s0',[]]],'r/1.json':[['Urban female workers','',2,'2026','s1',[]]]};
test('cold independent search requests overlap and identical requests are shared',async()=>{
 let active=0,peak=0;const calls=[];
 const engine=createSearch(core,async p=>{calls.push(p);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,10));active--;return files[p];});
 const a=await engine.series('female urban',{limit:2});
 assert.equal(a.rows.length,2);assert.ok(peak>=2,'independent token and row loads must overlap');
 const count=calls.length;assert.deepEqual(await engine.series('female urban',{limit:2}),a);assert.equal(calls.length,count);
});
test('a transient failed shard can be retried',async()=>{
 let failed=false;const engine=createSearch(core,async p=>{if(!failed){failed=true;throw Error('offline');}return files[p];});
 await assert.rejects(engine.series('female'));assert.equal((await engine.series('female')).rows.length,2);
});
test('cancelled search stops before fetching row chunks',async()=>{
 const controller=new AbortController(),calls=[];
 const engine=createSearch(core,async p=>{calls.push(p);controller.abort();return files[p];});
 await assert.rejects(engine.series('female',{signal:controller.signal}),{name:'AbortError'});
 assert.ok(calls.every(p=>p.startsWith('t/')));
});
test('spelling suggestions require one unambiguous vocabulary edit and leave valid words intact',()=>{
 const S=createSearch({...core,shards:{...core.shards,lexicon:['female','inflation','urban']}},async p=>files[p]);
 assert.equal(S.suggest('inflaton'),'inflation');assert.equal(S.suggest('inflaiton'),'inflation');
 assert.equal(S.suggest('female urban'),null);assert.equal(S.suggest('zzzzimpossible'),null);
 const ambiguous=createSearch({...core,shards:{...core.shards,lexicon:['plant','plans']}},async()=>({}));
 assert.equal(ambiguous.suggest('planz'),null);
});
test('unknown terms do not fetch irrelevant shards when a lexicon is present',async()=>{
 const paths=[];const S=createSearch({...core,shards:{...core.shards,lexicon:['female','urban']}},async p=>{paths.push(p);return files[p];});
 assert.equal((await S.series('zzzzimpossible')).total,0);assert.deepEqual(paths,[]);
});
test('row cache remains bounded over a long search session',async()=>{
 const c={...core,bundles:[['b','Workers','survey',0,0,60,[[0,'/guides/jobs/']],'']],shards:{...core.shards,rows:Array.from({length:60},(_,i)=>i)}};
 const paths=[];const S=createSearch(c,async p=>{paths.push(p);return [['A worker','',1,'2026','s',[]]];});
 await S.rowsAt(Array.from({length:60},(_,i)=>i));const before=paths.length;
 await S.rowsAt([0]);assert.equal(paths.length,before+1,'oldest row is evicted after 48 chunks');
});
test('matching guide destinations are emitted before row files finish',async()=>{
 let release,announced=false;
 const gate=new Promise(r=>release=r);
 const S=createSearch(core,async p=>{if(p.startsWith('r/')){assert.equal(announced,true);await gate;}return files[p];});
 const result=S.series('female urban',{onCandidates: x=>{announced=true;assert.equal(x.guides[0].href,'/guides/jobs/');release();}});
 assert.equal((await result).rows.length,2);
});
test('quality status suppresses misleading numbers while preserving original lookup and source identity',async()=>{
 const c={...core,bundles:core.bundles.map(b=>[...b,'s0']),quality:{version:'q1',default:'good',policies:{good:{id:'good',canInterpret:true},held:{id:'held',canInterpret:false,status:'review-pending',publicTitle:'Source mapping under review'}},bundles:{b:'held'},rowOverrides:{good:encodeIds([1])}}};
 const S=createSearch(c,async p=>files[p]);const r=await S.series('female urban');
 const held=r.rows.find(x=>x.identity==='b:s0');assert.equal(held.latest,null);assert.deepEqual(held.recent,[]);assert.equal(held.label,'Source mapping under review');assert.equal(held.originalLabel,'Urban female');assert.equal(held.quality.status,'review-pending');
 assert.equal(r.rows.find(x=>x.identity==='b:s1').latest,2);
 assert.equal(S.quick('workers').files[0].href,'/explore/?series=b%3As0');
});
test('missing or mixed-release quality definitions fail closed',()=>{
 assert.throws(()=>createSearch(core,async()=>({}),{expectedQualityVersion:'new'}),/different releases/);
 assert.throws(()=>createSearch({...core,quality:{default:'missing',policies:{},bundles:{},rowOverrides:{}}},async()=>({})),/incomplete/);
});
test('pay queries prefer amounts before bounded row selection; explicit shares keep their meaning',async()=>{
 const c={...core,shards:{frequent:[],tokens:[''],rows:[0,1]},ranking:{version:1,units:{money:encodeIds([1]),relative:encodeIds([0])}}};
 const f={'t/0.json':{rural:encodeIds([0,1]),wage:encodeIds([0]),earnings:encodeIds([1]),share:encodeIds([0])},'r/0.json':[['Share of workers: regular wage or salary, rural','',80,'2026','s0',[]]],'r/1.json':[['Average rural earnings among regular salaried employees per month','',25000,'2026','s1',[]]]};
 const S=createSearch(c,async p=>f[p]);
 assert.equal((await S.series('rural wages',{limit:1,maxChunks:1})).rows[0].identity,'b:s1');
 assert.equal((await S.series('rural wage share',{limit:1,maxChunks:1})).rows[0].identity,'b:s0');
 assert.deepEqual(new Set((await S.candidates('rural wages')).ids),new Set([0,1]),'ranking does not remove any matching record');
});
test('quantity preferences distinguish price changes, levels and explicit relative measures',()=>{
 for(const [q,want]of [['food inflation','inflation'],['food price index','index'],['salary growth','change'],['share of salary workers','relative'],['number of salary workers','count'],['rural wage rates','money'],['regular wage workers','none'],['salary','money'],['GDP','none']])assert.equal(unitIntent(parseQuery(q),q)??'none',want,q);
});
