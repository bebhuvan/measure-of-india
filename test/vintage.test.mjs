import test from 'node:test';import assert from 'node:assert/strict';
import {vintageError,vintageText,vintageSummary} from '../scripts/lib/vintage.mjs';
const unknown={vintage:null,vintageStatus:'unknown',vintageNote:'The source publishes no revision timestamp; capture is recorded separately.',archiveCapturedDate:'2026-10-10',reportEditionDate:'2021-09-10'};
test('unpublished revision dates remain unknown rather than becoming capture or edition dates',()=>{
 assert.equal(vintageError(unknown,'2026-10-12'),null);
 assert.equal(vintageText(unknown),'Source revision date not published');
 assert.equal(vintageText({vintage:'2021-09-10'}),'2021-09-10');
 assert.equal(vintageSummary([{vintage:'2021-09-10'},unknown]),'Mixed dated and unknown revisions');
 assert.equal(vintageSummary([unknown]),'Source revision date not published');
});
test('unknown state is explicit and dated sources retain strict validation',()=>{
 for(const m of [{},{vintage:null},{vintage:null,vintageStatus:'unknown',vintageNote:'Unknown.'},{vintage:'2021-09-10',vintageStatus:'unknown'},{vintage:'2021-02-30'},{vintage:'2027-01-01'}, {...unknown,archiveCapturedDate:'2026-13-01'}])assert.ok(vintageError(m,'2026-10-12'));
 assert.equal(vintageError({vintage:'2026-10-10'},'2026-10-12'),null);
 assert.throws(()=>vintageText({vintage:null}));
});
