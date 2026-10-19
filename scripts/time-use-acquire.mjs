#!/usr/bin/env node
// Direct official API acquisition. Single-flight shared client, resumable HTTP cache,
// complete pagination and immutable vintage archives. No MCP dependency.
import fs from 'node:fs';
import path from 'node:path';
import {mospi,mospiAll} from './lib/mospi.mjs';
import {writeRaw} from './lib/util.mjs';
const root=process.cwd();
const listing=await mospi('tus/getTusIndicatorList',{viz_status:1});
if(!Array.isArray(listing.data)||!listing.data.length)throw Error('TUS indicator catalogue is empty');
writeRaw(root,'data/raw/time-use/catalogue.json',{sourceUrl:'https://api.mospi.gov.in/api/tus/getTusIndicatorList?viz_status=1',body:listing});
const selected=process.argv.slice(2).map(Number), summary=[];
for(const indicator of listing.data){
 const code=indicator.indicator_code;if(selected.length&&!selected.includes(code))continue;
 const metadata=await mospi('tus/getTusFilterByIndicatorId',{indicator_code:code});
 const firstPage=await mospi('tus/getTusRecords',{indicator_code:code,page:1,limit:100});
 const rows=await mospiAll('tus/getTusRecords',{indicator_code:code});
 const expected=Number(firstPage.meta_data?.totalRecords);
 if(!rows.length||rows.length!==expected)throw Error(`TUS ${code}: ${rows.length}/${expected} distinct source rows`);
 writeRaw(root,`data/raw/time-use/indicator-${code}.json`,{sourceUrl:'https://api.mospi.gov.in/api/tus/getTusRecords',query:{indicator_code:code},indicator,metadata,expected,rows,archiveCapturedDate:new Date().toISOString().slice(0,10)});
 summary.push({code,label:indicator.description,rows:rows.length,pages:firstPage.meta_data.totalPages});
 fs.mkdirSync(path.join(root,'docs/reference'),{recursive:true});
 fs.writeFileSync(path.join(root,'docs/reference/time-use-acquisition.json'),JSON.stringify(summary,null,1)+'\n');
 console.log(`TUS ${code}: complete ${rows.length} rows`);
}
