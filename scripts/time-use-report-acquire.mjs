#!/usr/bin/env node
// URLs are extracted from the original report's PDF annotations, never guessed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {getText} from './lib/net.mjs';
import {readRaw,writeRaw,rawExists} from './lib/util.mjs';
const root=process.cwd();
if(!rawExists(root,'data/raw/time-use/report-2024.json')){
 const url='https://mospi.gov.in/sites/default/files/publication_reports/TUS_Report_2024_28.03.2025F.pdf';
 const bytes=Buffer.from(await getText(url,{encoding:'latin1',maxBytes:48000000,retries:3}),'latin1');
 if(bytes.subarray(0,4).toString()!=='%PDF'||bytes.length>25000000)throw Error('Invalid or oversized report PDF');
 writeRaw(root,'data/raw/time-use/report-2024.json',{url,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,bodyBase64:bytes.toString('base64'),archiveCapturedDate:new Date().toISOString().slice(0,10)});
}
const report=readRaw(root,'data/raw/time-use/report-2024.json');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-time-use-'));
let links;
try{
 const pdf=path.join(temporary,'report.pdf');fs.writeFileSync(pdf,Buffer.from(report.bodyBase64,'base64'));
 links=JSON.parse(execFileSync(process.env.ATLAS_PYTHON??'python3',[path.join(root,'scripts/time-use-report-links.py'),pdf],{encoding:'utf8',maxBuffer:1024*1024}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
writeRaw(root,'data/raw/time-use/report-2024-links.json',{sourceUrl:report.url,documentSha256:report.sha256,links});
for(const link of links){
 const url=link.url;if(!/\.xlsx$/i.test(url)||!url.startsWith('https://www.mospi.gov.in/'))throw Error('Unexpected report attachment '+url);
 const id=url.split('/').at(-1).replace(/\.xlsx$/i,'').toLowerCase();
 const file=`data/raw/time-use/report-2024-${id}.json`;
 if(rawExists(root,file)){const r=readRaw(root,file);if(r.url!==url||r.documentSha256!==report.sha256)throw Error('Attachment provenance changed '+id);console.log('held '+id);continue;}
 const bytes=Buffer.from(await getText(url,{encoding:'latin1',maxBytes:48000000,retries:3,gapMs:350}),'latin1');
 if(bytes.subarray(0,2).toString()!=='PK'||bytes.length>25000000)throw Error('Invalid workbook '+url);
 writeRaw(root,file,{...link,id,documentSha256:report.sha256,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,bodyBase64:bytes.toString('base64'),archiveCapturedDate:new Date().toISOString().slice(0,10)});
 console.log(id,bytes.length);
}
