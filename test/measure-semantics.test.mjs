import test from 'node:test';
import assert from 'node:assert/strict';
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

test('household-normalized income and transfers remain distinct from employed-person rates',()=>{
 const meta={coverage:'Avg. Monthly Income (in Rs.) Per Agricultural Hh'};
 for(const measure of ['Earnings From Pension/ Remittance (rs.)','Other earnings']){
  assert.equal(isWageRate({dims:{sub_indicator:measure}},'inr',meta),false);
 }
 assert.equal(isWageRate({dims:{sub_indicator:'Earnings per person from pensions'}},'inr'),false);
 assert.equal(isWageRate({dims:{sub_indicator:'Average wage earnings per worker per day'}},'inr_per_day',meta),true);
 assert.equal(isWageRate({dims:{sub_indicator:'Average emoluments per employee'}},'inr_per_month',meta),true);
});
