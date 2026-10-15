import test from 'node:test';
import assert from 'node:assert/strict';
import {profileVintage,profileCapture} from '../scripts/lib/profiles-vintage.mjs';
import {vintageError} from '../scripts/lib/vintage.mjs';
test('legacy capture stamp is preserved as capture, never source vintage',()=>{
 const m=profileVintage({vintage:'2026-10-10'});assert.equal(m.vintage,null);assert.equal(m.archiveCapturedDate,'2026-10-10');assert.equal(vintageError(m),null);
});
test('declared capture overrides legacy stamp and absent capture is never invented',()=>{
 assert.equal(profileVintage({archiveCapturedDate:'2026-10-12',vintage:'2020-01-01'}).archiveCapturedDate,'2026-10-12');
 assert.equal(profileVintage({}).archiveCapturedDate,undefined);assert.equal(profileVintage({vintage:'not a date'}).archiveCapturedDate,undefined);
});
test('new archival envelope separates capture from unknown revision',()=>{
 assert.deepEqual(profileCapture('2026-10-13'),{vintage:null,archiveCapturedDate:'2026-10-13'});assert.throws(()=>profileCapture('bad'));
});
