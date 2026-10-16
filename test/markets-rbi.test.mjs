import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanValue,periodStart,deduplicatePublished} from '../scripts/lib/products/markets-rbi.mjs';
test('RBI sentinels do not become economic values; valid negative and zero rates survive',()=>{
 assert.equal(cleanValue('999999999',{source:'report',measure:'growth'}).value,null);
 assert.equal(cleanValue('-999999999',{source:'report',measure:'ratio'}).value,null);
 for(const v of [-243,-80.8,0,151,999999998])assert.equal(cleanValue(String(v),{source:'report',measure:'growth'}).value,v);
 assert.equal(cleanValue('999999999',{source:'report',measure:'amount'}).value,null);
 assert.equal(cleanValue('0',{source:'cas',measure:'amount',zeroBlock:true}).value,null);
 assert.equal(cleanValue('0',{source:'cas',measure:'amount',zeroBlock:false}).value,0);
 assert.equal(cleanValue('123456789',{source:'cas',measure:'growth',item:'EXPD_OTH'}).value,null);
 assert.equal(cleanValue('-2.1',{source:'cas',measure:'growth',item:'EXPD_OTH'}).value,-2.1);
 assert.equal(cleanValue('$',{source:'report'}).value,null);
 assert.equal(cleanValue('100.16',{source:'report',measure:'share'}).value,null);
 assert.equal(cleanValue('-0.1',{source:'cas',measure:'share'}).value,null);
 assert.equal(cleanValue('100',{source:'report',measure:'share'}).value,100);
});
test('annual and quarterly observations follow fiscal reference dates',()=>{
 assert.equal(periodStart('2026-27:Q1','q'),'2026-04-01');
 assert.equal(periodStart('2025-26:Q4','q'),'2026-01-01');
 assert.equal(periodStart('Q2.2025-26','q'),'2025-07-01');
 assert.equal(periodStart('2025-26   ','a'),'2025-04-01');
 assert.throws(()=>periodStart('2025-26','q'));
});
test('publication deduplication selects newest lineage by the dataset key',()=>{
 const rows=[{id:'a',value_text:'1',source_retrieved_at:'2026-10-10'},{id:'a',value_text:'2',source_retrieved_at:'2026-10-11'}];
 assert.equal(deduplicatePublished(rows,['id'])[0].value_text,'2');
 assert.throws(()=>deduplicatePublished([{...rows[0]},{...rows[0],value_text:'3'}],['id']));
});
import fs from 'node:fs';import path from 'node:path';
import {validateMarketsRbi} from '../scripts/lib/markets-rbi-validation.mjs';
import {marketsRbiSlices} from '../src/dossiers/markets-rbi.model.js';
const root=path.resolve(import.meta.dirname,'..');
test('canonical lineage and comparable accounting identities hold',()=>{const r=validateMarketsRbi(root);assert.deepEqual(r.errors,[]);assert.ok(r.identities>=780);assert.ok(r.provenance>=95000);});
test('reviewed source family and overlap counts remain exact',()=>{const q=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/markets-rbi.source-quality.json')));assert.equal(q.counts.casRows,82826);assert.equal(q.counts.reportRows,117324);assert.equal(q.counts.exports,30);assert.equal(q.counts.overlapCells,11377);assert.equal(q.counts.conflicts,0);assert.equal(q.lineage.length,110);for(const reason of ['zero-filled','mislabelled','sentinel'])assert.ok(q.quarantine.some(x=>x.reason.includes(reason)));});
test('major annual and quarterly cuts have explanatory charts at the newest print',()=>{const views=marketsRbiSlices(s=>JSON.parse(fs.readFileSync(path.join(root,'data/series',s+'.json'))));assert.equal(views.length,32);for(const v of views){assert.equal(v.date,v.f==='q'?'2026-04-01':'2025-04-01');assert.ok(v.explain.length>80);assert.ok(v.available>0);assert.ok(v.rows.every(r=>r.label&&!r.label.includes('…')));}for(const cut of ['sector','industry','sales','puc'])for(const f of ['q','a'])assert.ok(views.some(v=>v.cut===cut&&v.f===f));});
import {preserveAmbiguousRatioHistory} from '../scripts/lib/products/markets-rbi.mjs';
test('duplicate non-additive mirror ratios are quarantined and inherited selection stays ambiguous',()=>{
 const x={dsd:'RATIO_LNGNFC_INDUS_ANN_RN',measure:'ratio',f:'a',cut:'industry',groupCode:'AGR_REL_ACT_OTH',item:'NET_PFT_TO_SAL',date:'2015-04-01',value:4.1107};
 const mirror={listed:[{table:'ratio_lngnfc_indus_ann_rn',csv:'typ_ratio_rn,inds_grp_rn,unit_measure,time_period,obs_value,src_line\nNET_PFT_TO_SAL,AGR_REL_ACT_OTH,RPT,2016-03-31,-0.0658,14\nNET_PFT_TO_SAL,AGR_REL_ACT_OTH,RPT,2016-03-31,4.1765,15'}]};
 const parsed={cas:[{...x}],quarantine:[]}; const defects=preserveAmbiguousRatioHistory(parsed,mirror);
 assert.equal(defects.length,1);assert.equal(parsed.cas[0].value,null);assert.equal(parsed.cas[1].value,4.1765);assert.equal(parsed.cas[1].source,'mirror_inherited');assert.ok(parsed.cas[1].ambiguity);
 assert.throws(()=>preserveAmbiguousRatioHistory({cas:[{...x,value:99}],quarantine:[]},mirror));
});
test('eight inherited historical cells expose ambiguity in labels, notes and lineage',()=>{
 let n=0;for(const name of fs.readdirSync(path.join(root,'data/series')).filter(x=>x.startsWith('markets-listed-'))){const b=JSON.parse(fs.readFileSync(path.join(root,'data/series',name)));for(const s of Object.values(b.series))for(const date of s.ambiguousInherited??[]){n++;assert.match(s.label,/ambiguous inherited/);assert.match(s.note,/not a verified/);assert.ok(s.sourceByDate[date].ambiguity);}}
 assert.equal(n,8);
});

test('noncomparable published shares retain exact source values and differing populations',()=>{
 const q=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/markets-rbi.source-quality.json')));
 const defects=q.quarantine.filter(x=>x.reason.startsWith('Noncomparable published sales share'));
 assert.equal(defects.length,4);for(const d of defects){assert.ok(Number(d.rawValue)>100);assert.notEqual(d.sharePopulationEvidence.shareCompanies,d.sharePopulationEvidence.salesCompanies);}
 const b=JSON.parse(fs.readFileSync(path.join(root,'data/series/markets-listed-a-industry.json'))),s=b.series.inds_grp_all_comp__pc_share_sal;
 for(const date of ['2024-04-01','2025-04-01']){assert.equal(s.data[b.dates.indexOf(date)],null);assert.ok(s.sourceByDate[date].reportedValue>100);assert.match(s.sourceByDate[date].omission,/Noncomparable/);}
});
import os from 'node:os';
import crypto from 'node:crypto';
import YAML from 'yaml';
import {buildMarketsHub} from '../scripts/lib/products/markets-hub.mjs';
test('later SPF hub refresh respects official listed-product ownership',async()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'markets-rbi-ownership-'));
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 try {
  fs.mkdirSync(path.join(fixture,'data/raw'),{recursive:true});fs.mkdirSync(path.join(fixture,'data/series'),{recursive:true});
  const raw='data/raw/markets-hub.json.gz';fs.copyFileSync(path.join(root,raw),path.join(fixture,raw));const rawBefore=hash(path.join(fixture,raw));
  const names=fs.readdirSync(path.join(root,'data/series')).filter(n=>n.startsWith('markets-listed-')&&n.endsWith('.json'));
  const before=new Map();for(const name of names){const p=path.join(fixture,'data/series',name);fs.copyFileSync(path.join(root,'data/series',name),p);before.set(name,hash(p));}
  const spfNames=fs.readdirSync(path.join(root,'data/series')).filter(n=>n.startsWith('markets-spf')&&n.endsWith('.json'));
  for(const name of spfNames)fs.writeFileSync(path.join(fixture,'data/series',name),'stale fixture requiring refresh');
  const cfg=YAML.parse(fs.readFileSync(path.join(root,'data/sources.yml'),'utf8'));assert.equal(cfg.dossiers['markets-listed'].product,'markets-rbi');
  const out=await buildMarketsHub(fixture,cfg.dossiers['markets-spf'],'2026-10-11',cfg,{replay:true});
  assert.equal(out.length,6);assert.equal(names.length,26);
  for(const [name,digest] of before)assert.equal(hash(path.join(fixture,'data/series',name)),digest,`SPF refresh overwrote ${name}`);
  for(const name of spfNames){const b=JSON.parse(fs.readFileSync(path.join(fixture,'data/series',name)));assert.equal(b.meta.dossier,'markets-spf');assert.equal(b.dates.at(-1),name.includes('2019')?'2026-01-01':'2026-07-01');assert.ok(Object.keys(b.series).length>0);}
  assert.equal(hash(path.join(fixture,raw)),rawBefore,'offline refresh changed mirror audit archive');
  cfg.dossiers['markets-listed'].product='markets-hub';
  const legacy=await buildMarketsHub(fixture,cfg.dossiers['markets-spf'],'2026-10-11',cfg,{replay:true});assert.equal(legacy.length,32);
  const restored=JSON.parse(fs.readFileSync(path.join(fixture,'data/series/markets-listed-q.json')));assert.match(restored.meta.source,/Innovation Hub/);assert.equal(restored.dates.at(-1),'2025-10-01');
 } finally {fs.rmSync(fixture,{recursive:true,force:true});}
});

import {readerTextProblems} from '../scripts/lib/reader-text.mjs';
test('listed data titles describe their actual scope without audit fields or filenames',()=>{
 const names=fs.readdirSync(path.join(root,'data/series')).filter(n=>/^markets-listed-.*\.json$/.test(n));assert.equal(names.length,26);
 for(const name of names){const b=JSON.parse(fs.readFileSync(path.join(root,'data/series',name)));assert.deepEqual(readerTextProblems(name,b),[]);assert.match(b.meta.coverage,/listed non-government non-financial companies/);assert.ok(b.meta.coverage.startsWith(b.meta.frequency==='annual'?'Annual':'Quarterly'));assert.match(b.meta.note,/sourceByDate/);
  if(name.endsWith('-levels.json'))assert.match(b.meta.coverage,/rupee totals/);
  if(name.endsWith('-ratios.json'))assert.match(b.meta.coverage,/financial ratios/);
 }
});
import {marketsRbiVintage} from '../scripts/lib/products/markets-rbi.mjs';
import {vintageError,vintageText} from '../scripts/lib/vintage.mjs';
test('capture and provider refresh timestamps never become a publisher revision date',()=>{
 const cas=[{source_retrieved_at:'2026-10-10T04:20:35Z',first_retrieved_at:'2026-09-01T00:00:00Z',is_revised:true}];
 const reports=[{source_retrieved_at:'2026-10-10T05:59:25Z',dataprovider_updated:'2026-10-10T05:59:27Z'}];
 const m=marketsRbiVintage(cas,reports);assert.equal(m.vintage,null);assert.equal(m.vintageStatus,'unknown');assert.equal(m.archiveCapturedDate,'2026-10-10');assert.equal(vintageError(m,'2026-10-12'),null);assert.equal(vintageText(m),'Source revision date not published');
 const next=marketsRbiVintage(cas,[{...reports[0],source_retrieved_at:'2026-10-11T05:59:25Z'}]);assert.equal(next.vintage,null);assert.equal(next.archiveCapturedDate,'2026-10-11');
});
test('all official listed bundles declare unknown source vintage and separate aggregate capture',()=>{
 const names=fs.readdirSync(path.join(root,'data/series')).filter(n=>/^markets-listed-.*\.json$/.test(n));assert.equal(names.length,26);
 for(const name of names){const b=JSON.parse(fs.readFileSync(path.join(root,'data/series',name)));assert.equal(b.meta.vintage,null);assert.equal(b.meta.archiveCapturedDate,'2026-10-10');assert.equal(vintageError(b.meta,'2026-10-12'),null);assert.equal(vintageText(b.meta),'Source revision date not published');}
});
import {JSDOM} from 'jsdom';
// The RBI company views are drawn at build time by src/dossiers/markets.charts.js rbiView() with
// the kit's bars: values stay in crore (labels, tips and CSV), and only the scale's ticks read in
// lakh crore, so they fit a phone. The same spec, checked here at the phone and desktop widths.
test('phone money-axis tick labels fit while values and the data unit remain in crore',async()=>{
 const K=await import('../src/kit/kit.js');const {lintSVG}=await import('../scripts/lint-kit.mjs');
 const rows=[{name:'Manufacturing',value:5174959},{name:'Services - IT',value:754727},{name:'Services - Non IT',value:1144803}],before=structuredClone(rows);
 const vals=rows.map(r=>r.value),topTick=K.nice(0,Math.max(...vals),4).ticks.filter(t=>t<=Math.max(...vals)).at(-1);
 const spec=w=>({width:w,rows,sort:false,fmt:v=>K.num(v,{dp:0,prefix:'₹',suffix:' crore'}),nameMax:360,tickFmt:v=>K.num(v/1e5,{dp:0,suffix:v===topTick?' lakh cr':''})});
 for(const w of [360,720,1184]){const svg=K.bars(spec(w));assert.deepEqual(rows,before);assert.match(svg,/₹51,74,959 crore/);assert.deepEqual(lintSVG(svg),[],`width ${w}`);if(w>400)assert.match(svg,/lakh cr/);}
});
import {guideBundles} from '../src/dossiers/everycut.js';
import {bySlug} from '../src/dossiers/registry.js';
import {vintageSummary} from '../scripts/lib/vintage.mjs';
test('all-source Markets revision summary includes unknown secondary inputs',()=>{
 const metas=guideBundles(bySlug.markets).map(s=>JSON.parse(fs.readFileSync(path.join(root,'data/series',s+'.json'))).meta);
 assert.equal(metas.filter(m=>m.vintage===null).length,26);assert.equal(vintageSummary(metas),'Mixed dated and unknown revisions');
 // the page states the all-source summary, never one bundle's vintage
 const page=fs.readFileSync(path.join(root,'src/pages/guides/markets.astro'),'utf8'),charts=fs.readFileSync(path.join(root,'src/dossiers/markets.charts.js'),'utf8');
 assert.match(page,/id="prov-vintage">\{guideRevisionSummary\}/);assert.ok(!/prov-vintage2?["'][^\n]*flowsB\.meta\.vintage/.test(page+charts));
});
