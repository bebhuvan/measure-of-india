import test from 'node:test';
import assert from 'node:assert/strict';
import {UNITS} from '../src/dossiers/everycut.js';
import {unitOf} from '../src/dossiers/units.js';
import {unitLabel,observations} from '../src/explore/model.js';
test('relative standard error remains its own unit and is never capped as population coverage',()=>{
  const unit=unitOf({meta:{unit:'pct'}},{unit:'pct_rse'});
  assert.equal(unit,'pct_rse');assert.equal(UNITS[unit].fmt(123.456),'123.46%');
  assert.match(UNITS[unit].note,/uncertainty/);assert.match(UNITS[unit].note,/not population coverage/);
  assert.equal(UNITS[unit].fmt(0),'0.00%');
  assert.equal(unitLabel(unit),'Relative standard error (%)');
  assert.deepEqual(observations({dates:['2025-03-31'],unit,series:{data:[123.456]}}).map(r=>r.value),[123.456]);
});
