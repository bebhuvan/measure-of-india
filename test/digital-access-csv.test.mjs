import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {GET} from '../src/pages/data/[bundle].csv.js';
import {parseCsv} from '../scripts/lib/tabular.mjs';
async function responseFor(t,bundle){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-csv-')),cwd=process.cwd();
  fs.mkdirSync(path.join(root,'data/series'),{recursive:true});fs.writeFileSync(path.join(root,'data/series/fixture.json'),JSON.stringify(bundle));
  process.chdir(root);try{return await GET({params:{bundle:'fixture'}}).text();}finally{process.chdir(cwd);fs.rmSync(root,{recursive:true,force:true});}
}
test('opt-in source names preserve values, nulls, order and CSV escaping',async t=>{
  const names=['State, rural','A "quoted" cut','Line\r\nbreak'];
  const b={meta:{csvHeaderMode:'series-name'},dates:['2025-03-31'],series:Object.fromEntries(names.map((name,i)=>['k'+i,{name,label:'same measure',data:[i===2?null:i]}]))};
  const rows=parseCsv(await responseFor(t,b));assert.deepEqual(rows[0],['date',...names]);assert.deepEqual(rows[1],['2025-03-31','0','1','']);
});
test('duplicate, empty and reserved source headers fail closed',async t=>{
  for(const names of [['same','same'],['','valid'],['date','valid']]){
    const b={meta:{csvHeaderMode:'series-name'},dates:['2025-03-31'],series:Object.fromEntries(names.map((name,i)=>['k'+i,{name,data:[i]}]))};
    await assert.rejects(()=>responseFor(t,b),/nonempty and unique/);
  }
});
test('default export remains byte-identical and keeps its existing label columns',async t=>{
  const b={meta:{},dates:['2025-03-31'],series:{a:{name:'different name',label:'Existing, label',data:[1]},b:{name:'different second',label:'Existing second',data:[null]}}};
  assert.equal(await responseFor(t,b),'date,"Existing, label",Existing second\n2025-03-31,1,\n');
});
test('actual telecom source has 999 unique full-cut column identities',async()=>{
  const b=JSON.parse(fs.readFileSync('data/series/digital-access-cmst2025-1.json'));
  assert.equal(Object.keys(b.series).length,999);assert.equal(new Set(Object.values(b.series).map(s=>s.name)).size,999);
  assert.equal(b.meta.csvHeaderMode,'series-name');
  {
    const rows=parseCsv(await GET({params:{bundle:'digital-access-cmst2025-1'}}).text());assert.equal(new Set(rows[0]).size,1000);
    assert.deepEqual(rows[1].slice(1).map(v=>v===''?null:Number(v)),Object.values(b.series).map(s=>s.data[0]));
  }
});
