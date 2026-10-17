import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {composeCardSVG} from '../src/charts/plumbing.js';
import {SITE} from '../src/site.js';
const dom = new JSDOM('<html><body></body></html>');
globalThis.XMLSerializer = dom.window.XMLSerializer;
globalThis.getComputedStyle = dom.window.getComputedStyle;
for (const width of [280,377,1120]) test(`published chart metadata remains readable at ${width}px`, () => {
 const svg=dom.window.document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('width',width);svg.setAttribute('height',240);
 const title='Annual sector sales show the scale of listed companies';
 const foot='Source: Reserve Bank of India. Rupees crore. Source revision date not published.';
 const card=composeCardSVG(svg,{title,sub:'Manufacturing, information technology and other services',foot,val:'₹40 lakh cr',valCap:'Annual reported sales'});
 const parsed=new JSDOM(card.svg,{contentType:'image/svg+xml'}).window.document;
 const texts=[...parsed.querySelectorAll('text')];
 const words=texts.flatMap(t=>t.textContent.split(/\s+/));
 for(const word of (title+' '+foot).split(/\s+/))assert.ok(words.includes(word));
 assert.ok(card.height<850,`header/footer unexpectedly tall: ${card.height}`);
 assert.ok(texts.every(t=>Number(t.getAttribute('y'))<card.height));
 if(width<640){
  const titleLines=texts.filter(t=>t.getAttribute('font-size')==='30');
  const readout=texts.find(t=>t.textContent==='₹40 lakh cr');
  assert.ok(+readout.getAttribute('y')>Math.max(...titleLines.map(t=>+t.getAttribute('y'))));
  const brand=texts.find(t=>t.textContent===SITE.name);
  const source=texts.filter(t=>t.getAttribute('font-size')==='12.5'&&t.textContent!==SITE.host);
  assert.ok(+brand.getAttribute('y')>Math.max(...source.map(t=>+t.getAttribute('y'))));
 }
});
