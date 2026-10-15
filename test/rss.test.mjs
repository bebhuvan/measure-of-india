import test from 'node:test';import assert from 'node:assert/strict';
import {GET} from '../src/pages/rss.xml.js';
import {DOSSIERS} from '../src/dossiers/registry.js';
test('RSS includes every guide with valid known publication dates and no capture-date fallback',async()=>{
 const response=await GET({site:new URL('https://atlas.thisindianlife.today')});const xml=await response.text();
 assert.equal((xml.match(/<item>/g)||[]).length,DOSSIERS.length);
 assert.doesNotMatch(xml,/Invalid Date|nullT00/);
 for(const slug of ['households','farm-households']){
  const item=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].find(m=>m[1].includes(`/guides/${slug}/`));
  assert.ok(item,slug);assert.match(item[1],/10 Sep 2021/);assert.doesNotMatch(item[1],/10 Oct 2026/);
 }
});
