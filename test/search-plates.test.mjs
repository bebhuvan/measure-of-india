import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSearchPlates} from '../scripts/lib/search-plates.mjs';
import {thumbSVG} from '../scripts/lib/search-thumbs.mjs';

test('figure discovery respects HTML attributes and nested titles', () => {
  const fixtures = ['id="p" class="break"', 'class="break" id="p"', "data-x='a>b'\nclass='break'\nid='p'"];
  for (const attrs of fixtures) assert.deepEqual(discoverSearchPlates(`<figure ${attrs}><h3>A <i>nested</i> &amp; title</h3><div class="sub">Finding</div></figure>`), [{id:'p',titleHTML:'A <i>nested</i> &amp; title',findingHTML:'Finding',phoneSVG:null}]);
});
test('inert scripts and figures without titles do not produce plates', () => {
  assert.deepEqual(discoverSearchPlates(`<script>const fake='<figure id="fake"><h3>Fake</h3></figure>';</script><figure id="empty"></figure><figure id="real"><h3>Real</h3></figure>`), [{id:'real',titleHTML:'Real',findingHTML:null,phoneSVG:null}]);
});
test('duplicate and empty figure identities fail closed', () => {
  assert.throws(()=>discoverSearchPlates('<figure id="p"></figure><figure id="p"><h3>Other</h3></figure>'), /duplicate/);
  assert.throws(()=>discoverSearchPlates('<figure id=""><h3>Empty</h3></figure>'), /empty/);
});
test('a chart\'s phone drawing becomes its search thumbnail: marks only, rounded, no hover targets', () => {
  const phone = '<svg width="360" height="240" viewBox="0 0 360 240"><title>T</title><g><rect class="ak-hit" x="0" y="0" width="360" height="240" fill="transparent"/><path d="M10.4,20.6L11.0,20.9L40.2,60.7" stroke="#2E4BC4" stroke-width="2" fill="none" data-v="1"/><text x="5" y="5">Label</text><circle cx="40.2" cy="60.7" r="3" fill="#2E4BC4" stroke="#fff"/></g></svg>';
  const [p] = discoverSearchPlates(`<figure id="cb-x"><h3>X</h3><div class="akf-phone">${phone}</div></figure>`);
  assert.equal(p.phoneSVG.startsWith('<svg'), true);
  const th = thumbSVG(p.phoneSVG);
  assert.doesNotMatch(th, /<text|<title|ak-hit|data-v|transparent/);
  assert.match(th, /d="M10,21L40,61"/);
  assert.match(th, /stroke-width="1.2" vector-effect="non-scaling-stroke"/);
  assert.match(th, /<circle cx="40" cy="61" r="3" fill="#2E4BC4">/);
  assert.equal(thumbSVG('<svg width="10" height="10"><text>only text</text></svg>'), null);
});
test('a panel chart (nested svg) keeps its marks, moved to the panel and cropped in root units', () => {
  const svg = '<svg width="360" height="900" viewBox="0 0 360 900"><svg x="0" y="0" width="360" height="200" viewBox="0 0 360 200"><text>Panel</text><rect x="10" y="20" width="50" height="8" fill="#2E4BC4"/></svg><svg x="0" y="600" width="360" height="200" viewBox="0 0 360 200"><rect x="10" y="20" width="50" height="8" fill="#2E4BC4"/></svg></svg>';
  const th = thumbSVG(svg);
  assert.match(th, /<g transform="translate\(0,0\)"><rect x="10" y="20" width="50" height="8" fill="#2E4BC4"><\/g>|<g transform="translate\(0,0\)"><rect x="10" y="20" width="50" height="8" fill="#2E4BC4"\/><\/g>/);
  assert.doesNotMatch(th, /translate\(0,600\)/);
  assert.doesNotMatch(th, /<svg[^>]*><svg|<text/);
});
