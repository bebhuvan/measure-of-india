// Schools: complete UDISE API cubes, separated at student-level collection in 2022-23,
// plus the complete CMSE 2025 education module. Raw profile archives are reused, never edited.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mospi, mospiAll } from '../mospi.mjs';
import { getBuffer } from '../net.mjs';
import { parseNumber } from '../tabular.mjs';
import { readRaw, rawExists, writeRaw, writeSeries, splitEmptySeries } from '../util.mjs';
import { profileVintage } from '../profiles-vintage.mjs';
import { idPart, writeCatalogue } from '../catalogue.mjs';

export const REPORT_URL = 'https://dashboard.udiseplus.gov.in/report2025/static/media/UDISE+2024_25_Booklet_existing.118ba29d4773e6372f72.pdf';
// The printed UDISE+ existing-structure reports, one per academic year of the student-level
// collection (2022-23 on; the institution-level years before it are a different instrument and are
// never checked against these). Each is archived as pdftotext -layout text with its URL and sha256;
// a fetched PDF whose hash differs from the one reviewed here stops the bake for review.
// `reviewed` is the outcome of the printed check the owner approved (2026-10-17): any change in it,
// a new disagreement included, stops the rebake until someone looks.
export const REPORTS = [
  { year: '2022-23', rel: 'data/raw/schools-udise-report-2022.json', url: 'https://dashboard.udiseplus.gov.in/report2025/static/media/UDISE+2022_23_Booklet_existing.d209e7c7516d77939da9.pdf', sha256: '59884f936772bc79ac7f007ae0f8330311c85b4f5cf748d6834672c0be8f08e6', reviewed: { cells: 324, agree: 292, rounding: 1, printedZero: 31, replaced: 0, apiZero: 0 } },
  { year: '2023-24', rel: 'data/raw/schools-udise-report-2023.json', url: 'https://dashboard.udiseplus.gov.in/report2025/static/media/UDISE+2023_24_Booklet_existing.309eabf9e4889db93bcb.pdf', sha256: '6a54fbf78e0ea7158aeeba568066a179aa133736e3bd9102c2c9e352bece71ac', reviewed: { cells: 324, agree: 2, rounding: 12, printedZero: 37, replaced: 210, apiZero: 63 } },
  { year: '2024-25', rel: 'data/raw/schools-udise-report-2024.json', url: REPORT_URL, sha256: 'cc66d03e1413722d2f5ab66f29ece3cdb3c21f7d736ac63f21efc3696ed7f4bf', reviewed: { cells: 324, agree: 278, rounding: 0, printedZero: 43, replaced: 0, apiZero: 3 } },
];
export const LATEST_REPORT = REPORTS.at(-1).rel;
// Printed and API figures within this distance are the same figure rounded differently; the
// printed one is kept.
export const PRINT_TOLERANCE = 0.1;
/** The owner's rule (2026-10-17): where the printed report has the cell, the printed figure is
 *  published. Returns the value to bake and how it relates to the API's. */
export function printedRule(apiValue, printed) {
  if (printed === undefined) return { value: apiValue, kind: null };
  if (!Number.isFinite(printed) || printed < 0 || printed > 100) throw Error(`UDISE printed rate ${printed} is not a rate`);
  if (apiValue != null && Math.abs(apiValue - printed) <= PRINT_TOLERANCE + 1e-9) return { value: printed, kind: printed === 0 ? 'printedZero' : apiValue === printed ? 'agree' : 'rounding' };
  return { value: printed, kind: apiValue === 0 ? 'apiZero' : 'replaced' };
}
const OMIT = new Set(['value', 'indicator', 'year']);
const clean = s => String(s ?? '').trim().replace(/\s+/g, ' ');
const snake = s => idPart(s).replaceAll('-', '_');
const revisionPolicy = 'These published administrative counts and survey estimates may be revised by the agency; changed responses are archived before rebaking.';
export function schoolsUnit(label, code, row = {}, family = 'udise') {
  const measure = clean(row.sub_indicator || row.subindicator || label);
  if (family === 'cmse') {
    if (/average expenditure/i.test(measure)) return 'inr_per_year';
    return 'pct';
  }
  if (code === 35) return 'gpi';
  if ([7,23].includes(code)) return 'pupils_per_teacher';
  if ([8,9,46].includes(code)) return 'count_per_school';
  return /percentage|proportion|\brate\b|\bratio \(GER\)|\bGER\b|\bNER\b|\bANER\b|\bASER\b/i.test(measure) ? 'pct' : 'count';
}
export const GER_CEILING = 200;
export function cube(rows, { label, code, family, vintage, base, rawFile, period = null, printed = null }) {
  if (!rows.length) throw Error(`${family} ${code}: no source rows`);
  const dims = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => !OMIT.has(k)).sort();
  const dateOf = r => period ?? `${String(r.year).slice(0,4)}-04-01`;
  const observedDates = [...new Set(rows.map(dateOf))].sort();
  const dates = period ? [period] : Array.from({length: +observedDates.at(-1).slice(0,4) - +observedDates[0].slice(0,4) + 1}, (_,i) => `${+observedDates[0].slice(0,4)+i}-04-01`);
  const series = {}, keys = new Set(), checks = {};
  for (const r of rows) {
    const values = Object.fromEntries(dims.map(d => [d, clean(r[d])]));
    const canonical = JSON.stringify(values);
    const key = dims.map(d => snake(values[d]) || 'none').join('__');
    const cell = `${key}:${dateOf(r)}`;
    if (keys.has(cell)) throw Error(`${family} ${code}: duplicated source cell ${cell}`);
    keys.add(cell);
    const s = series[key] ??= { name: `${family}_${code}_${key}`, label: [r.sub_indicator || r.subindicator || label,...dims.filter(d=>!['sub_indicator','subindicator'].includes(d)).map(d=>values[d]).filter(Boolean)].join(', '), unit: schoolsUnit(label,code,r,family), dims: values, state: values.state, geo: values.state || 'All India', group: dims.filter(d=>d!=='state').map(d=>values[d]).join(', '), data: dates.map(()=>null), _key: canonical };
    if (s._key !== canonical) throw Error(`${family} ${code}: normalized key collision`);
    let value = parseNumber(r.value);
    if (family === 'udise' && code === 31 && value === 0) {
      value = null;
      s.gapsNote = 'The API prints zero GER in cells without a usable enrolment/population base. Consistent with Measure of India\'s no-estimate rule, these ratios are null; the source zero remains archived.';
    }
    // A GER above GER_CEILING is a small-population artefact (SC or ST children in a state where
    // the group numbers a few hundred), not an enrolment rate: withheld, printed value archived.
    if (family === 'udise' && code === 31 && value > GER_CEILING) {
      (s.withheld ??= {})[dateOf(r)] = r.value;
      value = null;
      s.note = `UDISE+ prints gross enrolment ratios above ${GER_CEILING}% for this group in some years. The group's population base in this state is too small for the ratio to mean anything, so those years are left blank here; the printed figures stay in the raw archive.`;
    }
    // The printed report is the publication; the API serves it. Where the report prints the cell,
    // the printed figure is baked (printedRule); a differing API figure stays in the raw archive
    // and in sourceValues/note. A row the report should print but does not stops the bake.
    const pt = printed?.[r.year];
    if (pt) {
      const p = pt.value(r);
      if (p === undefined) throw Error(`${family} ${code}: ${s.label} ${r.year}: no printed cell in ${pt.table} (check the report layout)`);
      const rule = printedRule(value, p), c = (checks[r.year] ??= { table: pt.table, pdfPage: pt.pdfPage, url: pt.url, sha256: pt.sha256, cells: 0, agree: 0, rounding: 0, printedZero: 0, replaced: 0, apiZero: 0 });
      c.cells++; c[rule.kind]++;
      if (rule.kind !== 'agree' && rule.kind !== 'printedZero') { (s.sourceValues ??= {})[dateOf(r)] = r.value; (s._printed ??= []).push(`${r.year}: API ${r.value ?? 'blank'}, printed ${p.toFixed(1)}`); }
      value = rule.value;
    }
    s.data[dates.indexOf(dateOf(r))] = value;
  }
  for (const [year, c] of Object.entries(checks)) {
    const want = printed[year].reviewed, k = ['cells', 'agree', 'rounding', 'printedZero', 'replaced', 'apiZero'];
    if (want && k.some(x => want[x] !== c[x])) throw Error(`${family} ${code} ${year}: printed-report check ${JSON.stringify(Object.fromEntries(k.map(x => [x, c[x]])))} differs from the reviewed ${JSON.stringify(want)}; a new disagreement needs review before the printed figures replace the API's`);
  }
  for (const s of Object.values(series)) {
    delete s._key;
    if (s._printed) { s.note = `Where MoSPI's API differs from the printed UDISE+ report (Table 6.13), the printed figure is shown; the API figure stays in the raw archive. ${s._printed.join('; ')}.`; delete s._printed; }
    const a=s.data.findIndex(v=>v!=null),z=s.data.findLastIndex(v=>v!=null);
    s.gaps=dates.filter((d,i)=>i>a && i<z && s.data[i]==null);
    if (!s.gaps.length) delete s.gaps;
    else s.gapsNote ??= s.withheld && s.gaps.every(d=>d in s.withheld) ? s.note : 'The source table supplies no estimate for this cut and academic year.';
  }
  const meta = { dossier:'schools',product:`schools-${family}`,source:family==='udise'?'Ministry of Education, UDISE+, via MoSPI eSankhyiki':'MoSPI, NSS 80 Comprehensive Modular Survey: Education',base,frequency:period?'cross-sectional':'annual',unit:'see each series',...profileVintage({vintage}),geo:'IND',latestPeriod:period?'April–June 2025':rows.map(r=>r.year).sort().at(-1),revisionPolicy,coverage:`${label}: all published cross-tabs; ${dims.map(d=>d.replaceAll('_',' ')).join(', ')}`,note:`Complete observed row grain from ${rawFile}. No Cartesian expansion or averaging of state ratios. ${family==='udise'?'Existing school structure. Earlier institution-level collection and student-level collection are separate bundles. Pre-primary excludes standalone Anganwadis; source zero GER cells without a usable estimate are null; other reported zeros remain source values. Source ratios may exceed 100 where counts and population bases differ.':'Survey estimates describe currently enrolled students; state estimates require sample-size/RSE caution. Spending covers the current academic year; coaching is separate from school spending. Survey totals must not be extrapolated into population counts.'}`,indicator:{family,code,sourceRows:rows.length},dimensions:dims,rawFile,...(Object.keys(checks).length?{printedCheck:{rule:`Printed UDISE+ report figure published where the report prints the cell; API figures within ${PRINT_TOLERANCE} are the same figure rounded (printed kept); zeros the report prints stay (UDISE+ floors dropout at 0).`,years:checks}}:{}) };
  return {meta,dates,series};
}
export function nationalHighlights(text) {
  const pages=text.split('\f');
  const i=pages.findIndex(p=>/^Table 1: National Highlights/m.test(p));
  if(i<0) throw Error('UDISE report: national highlights table missing');
  let section='',series={};
  for(const line of (pages[i]+'\n'+pages[i+1]).split('\n')) {
    const t=line.trim();
    if(!t || /^Table |^Parameters|^\d+$/.test(t))continue;
    const m=t.match(/^(.+?)\s{2,}([\d,.]+)$/);
    if(!m){ if(t.length<90 && !/2024-25|Parameters/.test(t))section=t;continue; }
    const label=clean(m[1]),value=parseNumber(m[2]);
    if(value==null)throw Error(`UDISE national: invalid ${label}`);
    const key=snake(section+' '+label);
    if(series[key])throw Error(`UDISE national duplicate ${key}`);
    const unit=/Gross Enrolment|Dropout|Transition|Retention|Percentage/.test(section+' '+label)?'pct':/^PTR/.test(label)?'pupils_per_teacher':'count';
    series[key]={name:key,label:`${section}, ${label}`,unit,data:[value],dims:{section,measure:label},geo:'All India'};
  }
  const find=re=>Object.values(series).find(s=>re.test(s.label))?.data[0];
  if(find(/Schools, Total Number of Schools$/)!==1471473 || find(/Enrolments, Total Number of Enrolments \(Pre-Primary to Higher Secondary\)$/)!==246932680)throw Error('UDISE report anchor failed: check the release and table layout');
  return series;
}
const LEVELS=['Primary (1-5)','Upper Primary (6-8)','Secondary (9-10)'],GENDERS=['Boys','Girls','Total'];
const stateKey=t=>t.toLowerCase().replace(/&/g,'and').replace(/[^a-z]/g,'');
/** Table 6.13 of the UDISE+ report (dropout by level and gender, every state) as a cell lookup. */
export function reportDropout(text, report = {}) {
  const a=text.lastIndexOf('Table 6.13: Dropout Rate by level'),body=text.slice(a,text.indexOf('Table 6.14',a));
  const year=body.match(/gender, (\d{4}-\d{2})/)?.[1],rows={};
  for(const line of body.split('\n')){const m=line.match(/^\s*([A-Za-z][A-Za-z&.\- ]*?)\s+((?:-?\d+(?:\.\d+)?\s+){8}-?\d+(?:\.\d+)?)\s*$/);if(m)rows[stateKey(m[1])]=m[2].trim().split(/\s+/).map(Number);}
  if(a<0||!year||Object.keys(rows).length<37)throw Error(`UDISE report: Table 6.13 has ${Object.keys(rows).length} state rows, expected 37 (check the layout)`);
  const pdfPage=text.slice(0,a).split('\f').length;
  return {year,table:'Table 6.13',pdfPage,url:report.url,sha256:report.sha256,value:r=>rows[stateKey(r.state)]?.[LEVELS.indexOf(r.level_of_education)*3+GENDERS.indexOf(r.gender)]};
}
/** Every archived report's Table 6.13, keyed by academic year; each must print the year it is filed under. */
export function printedDropout(root) {
  const out={};
  for(const R of REPORTS){const raw=readRaw(root,R.rel);if(raw.sha256!==R.sha256)throw Error(`UDISE ${R.year} report archive hash ${raw.sha256} != reviewed ${R.sha256}`);const t={...reportDropout(raw.text,raw),reviewed:R.reviewed};if(t.year!==R.year)throw Error(`UDISE ${R.rel}: Table 6.13 is for ${t.year}, filed as ${R.year}`);out[R.year]=t;}
  return out;
}
export async function buildSchools(root,dcfg,vintage) {
  const fromRaw=process.env.SCHOOLS_FROM_RAW==='1';
  const localIndex=readRaw(root,'data/raw/profiles-mospi-index.json');
  const udiseList=fromRaw?localIndex.products.udise.indicators.map(i=>({indicator_code:i.code,description:i.label})):(await mospi('udise/getIndicatorList')).data;
  if(!fromRaw)writeRaw(root,'data/raw/schools-udise-list.json',{vintage,indicators:udiseList});
  for(const R of REPORTS)if(!rawExists(root,R.rel)||!fromRaw){
    const pdf=await getBuffer(R.url,{maxBytes:25e6}),sha256=crypto.createHash('sha256').update(pdf).digest('hex');
    if(sha256!==R.sha256)throw Error(`UDISE ${R.year} report changed: ${sha256} != reviewed ${R.sha256}; review Table 6.13 and update REPORTS`);
    const text=execFileSync('pdftotext',['-layout','-','-'],{input:pdf,maxBuffer:25e6}).toString();
    writeRaw(root,R.rel,{vintage,url:R.url,sha256,extractor:'pdftotext -layout',text});
  }
  const report=readRaw(root,LATEST_REPORT),printedTables={41:printedDropout(root)};
  const items=[],manifest=[];
  const emit=(slug,b)=>{
    // Cells the source lists without a figure (or with one withheld above) are catalogued, not baked.
    const {kept,empty}=splitEmptySeries(b.series);b.series=kept;
    const item=(k,s)=>({id:`${slug}:${crypto.createHash('sha256').update(k).digest('hex').slice(0,20)}`,label:s.label,bundle:slug,series:k,dims:s.dims});
    for(const [k,s] of Object.entries(empty))items.push({...item(k,s),withheld:s.withheld?'small-population GER artefact':'no figure published'});
    if(!Object.keys(kept).length)return;
    writeSeries(root,`data/series/${slug}.json`,b);manifest.push({slug,...b.meta.indicator,series:Object.keys(b.series).length,withheld:Object.keys(empty).length,observations:Object.values(b.series).reduce((n,s)=>n+s.data.filter(v=>v!=null).length,0)});
    for(const [k,s] of Object.entries(b.series))items.push(item(k,s));
  };
  for(const ind of udiseList) {
    const code=Number(ind.indicator_code),fresh=`data/raw/schools/udise-${code}.json`;
    const rel=!fromRaw||rawExists(root,fresh)?fresh:`data/raw/profiles-mospi/udise-0-${code}.json`;
    if(!fromRaw){
      const rows=await mospiAll('udise/getUdiseRecords',{indicator_code:code});
      const metadata=await mospi('udise/getUdiseFilterByIndicatorId',{indicator_code:code});
      writeRaw(root,rel,{vintage,indicator:ind,metadata,rows});
    }
    if(!rawExists(root,rel))throw Error(`UDISE ${code}: raw ingestion missing`);
    const raw=readRaw(root,rel);
    const expected=rel===fresh?raw.rows.length:localIndex.products.udise.indicators.find(i=>i.code===code)?.expected;
    if(raw.rows.length!==expected)throw Error(`UDISE ${code}: ${raw.rows.length} rows != expected ${expected}`);
    for(const [instrument,base,keep] of [['institution','UDISE+ institution-level collection, existing structure',r=>r.year<'2022-23'],['student','UDISE+ student-level collection, existing structure',r=>r.year>='2022-23']]) {
      const rows=raw.rows.filter(keep);if(!rows.length)continue;
      emit(`schools-udise-${instrument}-${code}`,cube(rows,{label:ind.description??ind.desc??raw.rows[0].indicator,code,family:'udise',vintage:raw.vintage,base,rawFile:rel,printed:printedTables[code]}));
    }
  }
  const listRel='data/raw/schools-cmse-list.json';
  if(!fromRaw)writeRaw(root,listRel,{vintage,response:await mospi('nss-80/getIndicatorList',{survey_code:2})});
  const cmse=readRaw(root,listRel).response.data;
  for(const ind of cmse) {
    const code=Number(ind.indicator_code),rel=`data/raw/schools/cmse-${code}.json`;
    if(!fromRaw) {
      const rows=await mospiAll('nss-80/getNSS80Records',{indicator_code:code,survey_code:2});
      const metadata=await mospi('nss-80/getFilterBySurveryAndIndicator',{indicator_code:code,survey_code:2});
      writeRaw(root,rel,{vintage,source:'nss-80/getNSS80Records',indicator:ind,metadata,rows});
    }
    const raw=readRaw(root,rel);
    emit(`schools-cmse-${code}`,cube(raw.rows,{label:ind.desc,code,family:'cmse',vintage:raw.vintage,base:'CMSE April–June 2025, school spending and coaching separate',rawFile:rel,period:'2025-04-01'}));
  }
  const series=nationalHighlights(report.text);
  emit('schools-national',{meta:{dossier:'schools',product:'schools-udise-report',source:'Ministry of Education, UDISE+ existing structure report, Table 1',sourceUrl:report.url,base:'UDISE+ student-level collection, existing structure',frequency:'cross-sectional',unit:'see each series',...profileVintage(report),geo:'IND',latestPeriod:'2024-25',revisionPolicy,coverage:'All national highlights in Table 1, both pages',note:'Published national figures, extracted from the report, not averages of state ratios. Existing structure; student-level collection began in 2022-23. Table 1 source text and PDF hash are archived.',indicator:{family:'udise-report',code:'table-1'}},dates:['2024-04-01'],series});
  writeCatalogue('schools',{source:'Complete observed UDISE API and CMSE cubes; source indicator listings and Ministry national highlights',generator:'scripts/lib/products/schools.mjs via scripts/fetch.mjs only schools',items});
  fs.mkdirSync(path.join(root,'data/coverage'),{recursive:true});
  fs.writeFileSync(path.join(root,'data/coverage/schools.manifest.json'),JSON.stringify({udiseIndicators:udiseList.length,cmseIndicators:cmse.length,bundles:manifest},null,2)+'\n');
  // Refresh facts and coverage from the new cubes, never freshness attestations.
  execFileSync(process.execPath,['scripts/schools-editorial.mjs'],{cwd:root,stdio:'inherit'});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');await buildSchools(root,{},new Date().toISOString().slice(0,10));
}
