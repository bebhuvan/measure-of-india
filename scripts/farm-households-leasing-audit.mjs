// Report Table 34 confirms the API's leasing-in values despite leasing-out sublabels.
import fs from 'node:fs';
import {readRaw} from './lib/util.mjs';
const root=process.cwd(),report=readRaw(root,'data/raw/farm-households-report.json'),raw=readRaw(root,'data/raw/profiles-mospi/nss77-0-36.json'),cells=new Map();
const norm=x=>x.toLowerCase().replaceAll('–','-').replace(/^all-india$/,'all india');
let table,state,season;
for(const [i,page]of report.text.split('\f').entries())for(const line of page.split('\n')){
 const h=line.match(/^\s*Table (\d+[A-Z]?):/);if(h){table=h[1];state=null;}
 if(table!=='34')continue;
 const sh=line.match(/^\s*(.+?)\s+Season:\s*(July 2018-December 2018|January 2019-June 2019|July 2018-June 2019)/);
 if(sh){state=norm(sh[1].trim());season=norm(sh[2]);}
 const tokens=line.trim().split(/\s+/),nums=tokens.slice(-12),label=tokens.slice(0,-12).join(' ');
 if(!state||!nums.every(x=>/^[\d,]+(?:\.\d+)?$/.test(x))||!/^([>\d]|all sizes$)/i.test(label))continue;
 const cls=label==='0.000'?'Nill':/^all sizes$/i.test(label)?'All Sizes':label;
 for(let col=0;col<10;col++){
  const group=['ST','SC','OBC','Others','All'][col%5],kind=col<5?'rate':'area',key=[state,season,cls,group,kind].join('|'),value=Number(nums[col].replaceAll(',',''));
  const old=cells.get(key);if(old&&old.value!==value)throw Error('Conflicting report cell '+key);
  cells.set(key,{value,pdfPage:i+1,column:col+2,line:line.trim()});
 }
}
const mismatches=[];let checked=0;
for(const r of raw.rows){const key=[norm(r.state),norm(r.season),r.ownership_holding,r['Social Group'],/Average/.test(r.sub_indicator)?'area':'rate'].join('|'),s=cells.get(key);if(!s||s.value!==Number(r.value))mismatches.push({key,api:r.value,report:s??null});else checked++;}
const result={indicator:36,reportTable:'34',sourceSha256:report.sha256,expected:13950,checked,mismatches,interpretation:'Table 34 identifies leasing-in. Original API leasing-out labels remain preserved with warnings; all numerical cells reconciled by state, season, ownership holding, social group and measure.'};
fs.writeFileSync('docs/status/farm-households-leasing-audit.json',JSON.stringify(result,null,1)+'\n');
if(mismatches.length||checked!==13950)throw Error('Leasing reconciliation failed: '+mismatches.length);
console.log('All 13950 leasing-in cells match official Table 34.');
