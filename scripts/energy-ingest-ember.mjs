import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {guardEnergyArchive} from './lib/energy-archive-guard.mjs';
import {writeRaw,rawExists} from './lib/util.mjs';
import {getText} from './lib/net.mjs';
const sibling='/home/bhuvanesh.r/Documents/Bhuvan projects/THis Indian Life';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(sibling,'data/catalog/ember-manifest.json')));
for(const a of manifest){
 const body=JSON.parse(fs.readFileSync(path.join(sibling,a.snapshot)));
 if(sha(JSON.stringify(body,null,2))!==a.rawHash)throw Error('Ember snapshot lineage hash mismatch');
 if(body.data.length!==a.rows)throw Error('Ember snapshot count mismatch');
 const slug=a.sourceIndicatorId.replaceAll('/','-');
 guardEnergyArchive(process.cwd(),`data/raw/energy-ember-national-${slug}.json`,{sourceHash:a.rawHash},['sourceHash']);
 writeRaw(process.cwd(),`data/raw/energy-ember-national-${slug}.json`,{vintage:a.fetchedAt.slice(0,10),sourceUrl:'https://api.ember-energy.org/v1/'+a.sourceIndicatorId,sourceHash:a.rawHash,body});
}
for(const freq of ['yearly','monthly']){
 const rel=`data/raw/energy-ember-states-${freq}.json`;
 if(rawExists(process.cwd(),rel))continue;
 const prefix=`india_${freq}_full_release_long_format`,dir=path.join(sibling,'data/snapshots/ember-states');
 const file=fs.readdirSync(dir).find(x=>x.startsWith(prefix)&&x.endsWith('.csv'));if(!file)throw Error('Missing original Ember CSV');
 const text=fs.readFileSync(path.join(dir,file),'utf8'),hash=sha(text);
 if(!file.includes(hash.slice(0,12)))throw Error('Ember original CSV hash mismatch');
 writeRaw(process.cwd(),rel,{vintage:'2026-06-13',sourceUrl:`https://files.ember-energy.org/public-downloads/${prefix}.csv`,sourceHash:hash,text});
}
