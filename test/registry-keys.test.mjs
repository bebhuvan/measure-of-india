import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from 'acorn';
function duplicateKeys(source){
 const found=[],tree=parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true});
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='ObjectExpression'){
   const seen=new Set();
   for(const p of node.properties){
    if(p.type!=='Property'||p.computed)continue;
    const key=p.key.type==='Identifier'?p.key.name:p.key.type==='Literal'?String(p.key.value):null;
    if(key===null)continue;
    if(seen.has(key))found.push({key,line:p.loc.start.line});seen.add(key);
   }
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(tree);return found;
}
test('registry rejects silently overridden configuration keys, including mixed quoting',()=>{
 assert.deepEqual(duplicateKeys('const guide={everyCutInline:0,"everyCutInline":600}'),[{key:'everyCutInline',line:1}]);
 assert.deepEqual(duplicateKeys('const guides=[{everyCutInline:0},{everyCutInline:600}]'),[]);
 assert.deepEqual(duplicateKeys(fs.readFileSync(new URL('../src/dossiers/registry.js',import.meta.url),'utf8')),[]);
});
