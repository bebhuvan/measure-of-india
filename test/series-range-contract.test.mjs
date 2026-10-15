import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredSeriesRanges} from '../scripts/lib/series-range-contract.mjs';
test('mixed source units keep their explicitly registered finite bounds',()=>{
  const b={meta:{unit:'pct'},series:{rate:{unit:'pct',data:[0]},sample:{unit:'count',data:[200]},error:{unit:'pct_rse',data:[123.456]}}};
  assert.deepEqual(registeredSeriesRanges(b,{pct:[0,100],count:[0,1e9],pct_rse:[0,1000]},'fixture'),{rate:[0,100],sample:[0,1e9],error:[0,1000]});
});
test('unknown, missing, infinite and reversed ranges fail instead of bypassing checks',()=>{
  const b={meta:{},series:{cell:{unit:'unknown',data:[1]}}};
  for(const ranges of [{},{unknown:[-Infinity,Infinity]},{unknown:[0]},{unknown:[100,0]},{unknown:['0',100]}])
    assert.throws(()=>registeredSeriesRanges(b,ranges,'fixture'),/no valid finite registered range/);
});
