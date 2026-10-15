import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cutOf, rowsOf} from '../src/dossiers/everycut.js';
import {householdModel} from '../src/dossiers/households.model.js';

test('Unregistered API cuts use declared geography dimensions',()=>{
 assert.equal(cutOf('unregistered-api',{dimensions:['state','sector','social_group','sub_indicator','indicator','measure','metric','value','date','period','year','unit']}),'State and sector');
 assert.equal(cutOf('bis-dsr',{dimensions:['state','sector']}),'All India');
 assert.equal(cutOf('unregistered-api',{dimensions:'state'}),'All India');
 assert.equal(cutOf('unregistered-api',{dimensions:['state','sub_indicator']}),'State');
 assert.equal(cutOf('unregistered-api',{dimensions:['sector','sub_indicator']}),'Sector');
 assert.equal(cutOf('unregistered-api',{dimensions:['sub_indicator']}),'All India');
 assert.equal(cutOf('unregistered-api',{cut:'State and household type',dimensions:['state','sector']}),'State and household type');
});
test('Real state observations cannot fall back to All India in EveryCut',()=>{
 const key='c_ace93c93746c56d941dc3dcf';
 const canonical=JSON.parse(fs.readFileSync('data/series/households-aidis-6.json'));
 assert.equal(canonical.series[key].dims.state,'Mizoram');
 assert.equal(canonical.series[key].data[0],4711922);
 const row=rowsOf('households-aidis-6').find(r=>r.key===key);
 assert.equal(row.cut,'State and sector');assert.equal(row.latest,4711922);
 assert.equal(rowsOf('households-aidis-6',{cut:'State and household group'}).find(r=>r.key===key).cut,'State and household group');
});
test('Each household plate retains its own canonical publisher source URL',()=>{
 const model=householdModel();
 for(const p of model.plates){
  const b=JSON.parse(fs.readFileSync('data/series/'+p.bundle+'.json'));
  assert.equal(p.sourceUrl,b.meta.sourceUrl,p.id);
 }
 assert.equal(model.plates.find(p=>p.id==='debt-base').sourceUrl,'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1753935');
 assert.equal(model.plates.find(p=>p.id==='value-types').sourceUrl,'https://www.mospi.gov.in/sites/default/files/publication_reports/Report_no588-AIDIS-77R-SeptFinal_0.pdf');
});
