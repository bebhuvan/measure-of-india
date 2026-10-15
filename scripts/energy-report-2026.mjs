import {guardEnergyArchive} from './lib/energy-archive-guard.mjs';
import fs from 'node:fs';import {getBuffer} from './lib/net.mjs';import {writeRaw,readRaw} from './lib/util.mjs';import crypto from 'node:crypto';
const list=fs.existsSync('/tmp/atlas-energy-report-2026-list.json')?JSON.parse(fs.readFileSync('/tmp/atlas-energy-report-2026-list.json')):readRaw(process.cwd(),'data/raw/energy-report-2026-list.json').body;
guardEnergyArchive(process.cwd(),'data/raw/energy-report-2026-list.json',{body:list},['body']);
writeRaw(process.cwd(),'data/raw/energy-report-2026-list.json',{vintage:'2026-03-30',body:list});
for(const [tag,match] of [['balance',/Chapter 7/],['annex-balance',/Annexure IV/]]){
 const row=list.data.find(r=>match.test(r.chapter_title));const url=new URL(row.file_two.path,'https://www.mospi.gov.in/').href;
 const bytes=await getBuffer(url,{maxBytes:30e6});fs.writeFileSync(`/tmp/atlas-energy-${tag}-2026.xlsx`,bytes);guardEnergyArchive(process.cwd(),`data/raw/energy-report-2026-${tag}-xlsx.json`,{sha256:crypto.createHash('sha256').update(bytes).digest('hex')},['sha256']);writeRaw(process.cwd(),`data/raw/energy-report-2026-${tag}-xlsx.json`,{vintage:'2026-03-30',url,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')});
}
