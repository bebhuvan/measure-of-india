import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as Plot from '../src/charts/plot.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const rows = [
  {name: 'General agricultural labourers doing watering weeding and other unskilled agricultural work', value: -250},
  {name: 'Non-agricultural labourers including construction and transport workers', value: 500},
];

for (const width of [320, 390, 545, 680]) {
  test(`shared categorical phone plot retains full names and signed values at ${width}px`, () => {
    Object.defineProperty(window, 'innerWidth', {value: width, configurable: true});
    const svg = Plot.plot({
      width: 1120, height: 300,
      x: {domain: [-300, 550]}, y: {domain: rows.map(r => r.name)},
      marks: [
        Plot.dot(rows, {x: 'value', y: 'name'}),
        Plot.text(rows, {x: 'value', y: 'name', text: 'value', dx: 12, textAnchor: 'start'}),
      ],
    });
    assert.equal(svg.getAttribute('data-narrow'), 'names-above');
    assert.ok(+svg.getAttribute('width') <= width);
    const labels = [...svg.querySelectorAll('.rowname text')].map(t => t.textContent);
    const visibleWords = new Set(labels.flatMap(t => t.split(/\s+/)));
    for (const row of rows) {
      for (const word of row.name.split(/\s+/)) assert.ok(visibleWords.has(word), `Lost ${word}`);
      assert.ok([...svg.querySelectorAll('text')].some(t => t.textContent === String(row.value)));
    }
    assert.ok(!labels.some(t => t.includes('…')));
    assert.equal(svg.querySelectorAll('[aria-label="dot"] circle').length, rows.length);
    assert.deepEqual(svg.scale('x').domain, [-300, 550]);
  });
}

test('family-authored compact geometry and desktop geometry are preserved', () => {
  Object.defineProperty(window, 'innerWidth', {value: 390, configurable: true});
  const compact = Plot.plot({width: 284, height: 210, marks: [Plot.dot(rows, {x: 'value', y: 'name'})]});
  assert.equal(+compact.getAttribute('width'), 284);
  assert.equal(compact.getAttribute('data-narrow'), null);
  Object.defineProperty(window, 'innerWidth', {value: 1440, configurable: true});
  const desktop = Plot.plot({width: 1120, height: 300, marks: [Plot.dot(rows, {x: 'value', y: 'name'})]});
  assert.equal(+desktop.getAttribute('width'), 1120);
  assert.equal(desktop.getAttribute('data-narrow'), null);
});

test('phone time plots preserve the complete history, values and domains', () => {
  Object.defineProperty(window, 'innerWidth', {value: 390, configurable: true});
  const history = Array.from({length: 76}, (_, i) => ({date: new Date(Date.UTC(1950 + i, 0, 1)), value: i - 30}));
  const svg = Plot.plot({width: 1120, height: 360,
    x: {type: 'utc'}, y: {domain: [-35, 50]},
    marks: [Plot.lineY(history, {x: 'date', y: 'value'}), Plot.dot(history, {x: 'date', y: 'value'})],
  });
  assert.equal(svg.getAttribute('data-narrow'), 'time');
  assert.ok(+svg.getAttribute('width') <= 390);
  assert.equal(svg.querySelectorAll('[aria-label="dot"] circle').length, history.length);
  assert.deepEqual(svg.scale('x').domain.map(Number), [Number(history[0].date), Number(history.at(-1).date)]);
  assert.deepEqual(svg.scale('y').domain, [-35, 50]);
});


test('phone annotations wrap complete text without mutating the authored mark', () => {
  Object.defineProperty(window, 'innerWidth', {value: 320, configurable: true});
  const phrase = 'A complete source annotation with a period and a meaningful explanation';
  for (const fontSize of [12, 18, 24]) {
    const mark = Plot.text([{x: 0, y: 5, label: phrase}], {x: 'x', y: 'y', text: 'label', fontSize});
    const split = mark.splitLines;
    const svg = Plot.plot({width: 1120, height: 360, x: {domain: [0, 10]}, y: {domain: [0, 10]}, marks: [mark]});
    const text = svg.querySelector('[aria-label="text"] text');
    assert.ok(text.querySelectorAll('tspan').length > 1);
    assert.equal([...text.querySelectorAll('tspan')].map(s => s.textContent).join(' '), phrase);
    assert.equal(mark.splitLines, split);
    assert.deepEqual(svg.scale('x').domain, [0, 10]);
  }
});

test('explicit compact-panel phone layout keeps full labels and source values', () => {
  Object.defineProperty(window, 'innerWidth', {value: 390, configurable: true});
  const svg = Plot.plot({width: 560, narrow: true, height: 300,
    x: {domain: [-300, 550]}, y: {domain: rows.map(r => r.name)},
    marks: [Plot.barX(rows, {x: 'value', y: 'name'}),
      Plot.text(rows, {x: 'value', y: 'name', text: 'value', dx: 8, textAnchor: 'start'})],
  });
  assert.equal(svg.getAttribute('data-narrow'), 'names-above');
  assert.equal(+svg.getAttribute('width'), 350);
  const names = [...svg.querySelectorAll('.rowname text')].map(t => t.textContent).join(' ');
  for (const row of rows) {
    for (const word of row.name.split(/\s+/)) assert.ok(names.includes(word));
    assert.ok([...svg.querySelectorAll('text')].some(t => t.textContent === String(row.value)));
  }
  assert.deepEqual(svg.scale('x').domain, [-300, 550]);
});

test('authored medium-width phone geometry can opt out without duplicate category labels',()=>{
 Object.defineProperty(window,'innerWidth',{value:680,configurable:true});
 const svg=Plot.plot({width:640,narrow:false,height:300,x:{domain:[-300,550]},y:{axis:null,domain:rows.map(r=>r.name)},
  marks:[Plot.dot(rows,{x:'value',y:'name'}),Plot.text(rows,{x:-250,y:'name',text:'name',textAnchor:'start'})]});
 assert.equal(+svg.getAttribute('width'),640);
 assert.equal(svg.getAttribute('data-narrow'),null);
 assert.equal(svg.querySelectorAll('text').length,2+svg.querySelectorAll('[aria-label*="axis"] text').length);
 assert.equal(svg.querySelectorAll('.rowname').length,0);
 assert.equal(svg.querySelectorAll('[aria-label="dot"] circle').length,rows.length);
});

test('an unresolved dense phone annotation retains its authored readable canvas and every observation', () => {
 Object.defineProperty(window,'innerWidth',{value:320,configurable:true});
 const values=Array.from({length:21},(_,i)=>({x:i*5,y:50}));
 const annotation='A dated observation retains its complete explanatory annotation beside the original point';
 const svg=Plot.plot({width:1000,height:180,x:{domain:[0,100]},y:{domain:[0,100]},marks:[
  Plot.ruleX(values,{x:'x'}),Plot.dot(values,{x:'x',y:'y'}),
  Plot.text([{x:50,y:50,text:annotation}],{x:'x',y:'y',text:'text'})
 ]});
 assert.equal(+svg.getAttribute('width'),1000);
 assert.ok(svg.hasAttribute('data-layout-diagnostic'));
 assert.equal(svg.style.minWidth,'1000px');
 assert.equal(svg.style.maxWidth,'none');
 assert.equal(svg.querySelectorAll('[aria-label="dot"] circle').length,21);
 assert.ok(svg.textContent.includes(annotation));
 assert.deepEqual(svg.scale('x').domain,[0,100]);
});
