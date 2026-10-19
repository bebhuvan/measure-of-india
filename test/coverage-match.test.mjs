import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverageMatcher} from '../scripts/lib/coverage-match.mjs';
const oldMatcher=patterns=>{const re=patterns.map(g=>new RegExp('^'+g.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$'));return id=>re.some(r=>r.test(id));};
test('coverage exact-ID optimization preserves literal and glob matching',()=>{
 const cases=[[],['a:1'],['a:1','a:1'],['a:*'],['*:one'],['a:*:c'],['*'],['a.b:one','a+b:two'],['a:*','exact:two'],['x[1]','x(2)','x?3','x$4','x^5']];
 const ids=['','a:1','a:11','a:b:c','a::c','a:other:leaf','b:one','a.b:one','axb:one','a+b:two','exact:two','other:two','x[1]','x(2)','x?3','x$4','x^5'];
 for(const patterns of cases){const old=oldMatcher(patterns),fast=coverageMatcher(patterns);for(const id of ids)assert.equal(fast(id),old(id),JSON.stringify({patterns,id}));}
});
test('coverage retains first-rule priority for overlapping exact and glob rules',()=>{
 const rules=[['a:one'],['a:*'],['*']].map(coverageMatcher);
 assert.equal(rules.findIndex(m=>m('a:one')),0);assert.equal(rules.findIndex(m=>m('a:two')),1);assert.equal(rules.findIndex(m=>m('b:one')),2);
});
