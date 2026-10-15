import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isWageRate} from '../scripts/lib/measure-semantics.mjs';
test('Household wage-income components can be zero; per-person wage rates still reject zero',()=>{
 const s={label:'Assam, OBC, holding 10.00+, July 2018–June 2019',dims:{sub_indicator:'Income From Wages (rs.)'},data:[0]};
 assert.equal(isWageRate(s,'inr'),false);
 for(const unit of ['inr','inr_per_month','inr_per_30_days','inr_per_year']){
  assert.equal(isWageRate({dims:{sub_indicator:'Wage earnings per household'}},unit),false);
  assert.equal(isWageRate({dims:{sub_indicator:'Income From Wages (rs.)'}},unit),false);
  assert.equal(isWageRate({dims:{sub_indicator:'Average wage earnings per person'}},unit),true);
 }
 assert.equal(isWageRate({dims:{sub_indicator:'Average wage earnings per person'}},'inr'),true);
 assert.equal(isWageRate({label:'Daily wage earnings'},'inr_per_day'),true);
 assert.equal(isWageRate({label:'Total wage bill'},'inr_crore'),false);
 assert.equal(isWageRate({dims:{sub_indicator:'Fixed capital expenditure - average amount (Rs.) per household',household_type:'Regular wage/salary earning'}},'inr'),false);
});
test('actual household-income cells, including pension/remittance zeros, are not per-person wage rates',()=>{
 let transfers=0,zeros=0;
 for(const code of [24,25])for(const part of ['01','02','03']){
  const b=JSON.parse(fs.readFileSync(`data/series/farm-households-nss77-${code}-${part}.json`));
  for(const s of Object.values(b.series)){
   assert.equal(isWageRate(s,s.unit,b.meta),false,`${code}-${part}: ${s.dims.sub_indicator}`);
   if(/Pension\/ Remittance/.test(s.dims.sub_indicator)){transfers++;if(s.data[0]===0)zeros++;}
  }
 }
 assert.ok(transfers>0);assert.ok(zeros>0);
 const universe={coverage:'Avg. Monthly Income (in Rs.) Per Agricultural Hh'};
 assert.equal(isWageRate({dims:{sub_indicator:'Earnings From Pension/ Remittance (rs.)'}},'inr',universe),false);
 assert.equal(isWageRate({dims:{sub_indicator:'Other earnings'}},'inr',universe),false);
 assert.equal(isWageRate({dims:{sub_indicator:'Average wage earnings per person'}},'inr',universe),true);
 assert.equal(isWageRate({dims:{sub_indicator:'Average wage earnings per worker per day'}},'inr_per_day',universe),true);
 assert.equal(isWageRate({dims:{sub_indicator:'Average emoluments per employee'}},'inr_per_month',universe),true);
 assert.equal(isWageRate({dims:{sub_indicator:'Earnings per person from pensions'}},'inr'),false);
});
