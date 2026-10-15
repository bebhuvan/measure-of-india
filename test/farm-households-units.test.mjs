import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {UNITS} from '../src/dossiers/everycut.js';
test('Every Cut resolves and formats units of every cell in all farm bundles',()=>{
 const manifest=JSON.parse(fs.readFileSync('data/coverage/farm-households.manifest.json'));
 assert.equal(manifest.bundles.length,83);
 let cells=0,kg=0;
 for(const {slug}of manifest.bundles){
  const b=JSON.parse(fs.readFileSync(`data/series/${slug}.json`));
  for(const [key,s]of Object.entries(b.series)){
   const unit=s.unit??b.meta.unit,u=UNITS[unit];assert.ok(u,`${slug}.${key}: missing unit ${unit}`);
   if(Number.isFinite(s.data[0])){const formatted=u.fmt(s.data[0]);assert.equal(typeof formatted,'string');assert.ok(formatted.length,`${slug}.${key}: empty display`);if(unit==='kg'){assert.match(formatted,/ kg$/);kg++;}}
   cells++;
  }
 }
 assert.equal(cells,501008);assert.ok(kg>0);
});
