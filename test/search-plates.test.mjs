import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSearchPlates} from '../scripts/lib/search-plates.mjs';

test('figure discovery respects HTML attributes and nested titles', () => {
  const fixtures = ['id="p" class="break"', 'class="break" id="p"', "data-x='a>b'\nclass='break'\nid='p'"];
  for (const attrs of fixtures) assert.deepEqual(discoverSearchPlates(`<figure ${attrs}><h3>A <i>nested</i> &amp; title</h3><div class="sub">Finding</div></figure>`), [{id:'p',titleHTML:'A <i>nested</i> &amp; title',findingHTML:'Finding'}]);
});
test('inert scripts and figures without titles do not produce plates', () => {
  assert.deepEqual(discoverSearchPlates(`<script>const fake='<figure id="fake"><h3>Fake</h3></figure>';</script><figure id="empty"></figure><figure id="real"><h3>Real</h3></figure>`), [{id:'real',titleHTML:'Real',findingHTML:null}]);
});
test('duplicate and empty figure identities fail closed', () => {
  assert.throws(()=>discoverSearchPlates('<figure id="p"></figure><figure id="p"><h3>Other</h3></figure>'), /duplicate/);
  assert.throws(()=>discoverSearchPlates('<figure id=""><h3>Empty</h3></figure>'), /empty/);
});
