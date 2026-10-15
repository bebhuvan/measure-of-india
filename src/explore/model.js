// Explorer v1: release-independent identity, exact observations, conservative comparison.
import { unitOf } from '../dossiers/units.js';
export const MAX_COMPARE = 4;
export const identity = (bundle, anchor) => `${bundle}:${anchor}`;
export function parseIdentity(value) {
  const m = /^([a-z0-9][a-z0-9_-]*):(s[a-z0-9]{7})$/.exec(value || '');
  if (!m) throw new Error('Choose a valid Atlas series link.');
  return { bundle: m[1], anchor: m[2] };
}
export function seriesURL(ids, range = {}) {
  const p = new URLSearchParams();
  for (const id of ids) { parseIdentity(id); p.append('series', id); }
  for (const k of ['from', 'to']) if (range[k]) p.set(k, range[k]);
  return '/explore/?' + p;
}
// Optional comparison restrictions are validated independently of numeric eligibility.
// A restriction on interpreted data must explain itself, using a dedicated reason
// or a substantively validated existing source-policy reason.
export function validComparisonPolicy(quality) {
  if (!quality || typeof quality.canInterpret !== 'boolean') return false;
  if (quality.canCompare === undefined) return true;
  if (typeof quality.canCompare !== 'boolean' || (quality.canCompare && !quality.canInterpret)) return false;
  if (quality.canInterpret && !quality.canCompare) {
    const reason = quality.comparisonReason ?? quality.reason;
    return typeof reason === 'string' && reason.trim().length >= 20;
  }
  return true;
}
// Missing policy is allowed only for legacy direct model callers; published loaders require one.
export function canComparePolicy(quality) {
  return quality == null || (validComparisonPolicy(quality) && quality.canInterpret && quality.canCompare !== false);
}
export function comparisonKey(bundle, B, s, quality = null) {
  if (!canComparePolicy(quality)) return null;
  // Explicit observed dimensions only. Hold measure and all other cuts fixed;
  // state/sector may vary. Never infer joint cells from separate marginals.
  const resolvedUnit=unitOf(B,s);
  if([null,'unstated','unknown','see each series','none','qty_none','level','rate','source_sale_rate','source_scaled_gwh'].includes(resolvedUnit))return null;
  const instrument = [bundle, B.meta.base ?? null, B.meta.frequency, B.meta.methodology ?? null, B.meta.calendar ?? null];
  const dims = s.dims;
  if (dims && Object.keys(dims).some(k => ['state', 'sector'].includes(k))) {
    const held = Object.entries(dims).filter(([k]) => !['state', 'sector'].includes(k)).sort(([a],[b]) => a.localeCompare(b));
    if (held.length) return JSON.stringify([instrument, unitOf(B,s), held]);
  }
  // Published components of one CPI inflation instrument share rate/unit/calendar.
  if (['cpi', 'cpi-2024'].includes(bundle) && unitOf(B,s) === 'pct_yoy') return JSON.stringify([instrument, 'CPI inflation components', 'pct_yoy']);
  return null;
}
export function assertCompatible(records) {
  if (records.length > MAX_COMPARE) throw new Error(`Compare at most ${MAX_COMPARE} series so each line remains legible.`);
  if(records.some(r=>r.quality!=null&&!validComparisonPolicy(r.quality)))throw new Error('Comparison capability or its explanation is invalid; interpretation is withheld.');
  if (records.length < 2) return;
  if(records.some(r=>r.quality?.canInterpret===false))throw new Error('This source mapping is under review. Numeric comparisons and interpreted exports are withheld.');
  if(records.some(r=>!canComparePolicy(r.quality)))throw new Error('Numeric observations may be inspected individually, but comparisons are withheld by source policy.');
  const snapshotPeriods=records.map(r=>r.dates.filter((_,i)=>r.series.data[i]!=null));
  if(snapshotPeriods.every(p=>p.length<=1)&&new Set(snapshotPeriods.flat()).size>1)throw new Error('These snapshots refer to different reference periods. Choose matching periods or inspect them individually.');
  const a = records[0];
  if (!a.compare || records.some(r => r.compare !== a.compare)) throw new Error('These series have different measures, instruments or fixed cuts. Choose a related series from the same comparison set.');
  if (records.some(r => r.unit !== a.unit || r.bundle !== a.bundle || ['base','frequency','calendar','methodology'].some(k=>r.meta?.[k]!==a.meta?.[k]))) throw new Error('Units and instruments must match. Cross-frequency aggregation and unit conversion are not supported.');
}
export function expectedAsOf(meta) {
  if (meta?.observationKind !== 'expected-schedule') return null;
  if (meta.forecastAsOfStatus === 'unknown' && meta.forecastAsOfDate === null) return 'Forecast as-of unknown';
  const date = meta.forecastAsOfDate;
  if (meta.forecastAsOfStatus === 'known' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date+'T00:00:00Z')) && new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date) return `Forecast as-of ${date}`;
  throw new Error('Expected schedule has no valid source-bound forecast as-of status');
}
export function assertExpectedPolicy(r) {
  if (r.meta?.observationKind !== 'expected-schedule') return;
  expectedAsOf(r.meta);
  if (!r.quality?.canInterpret || r.quality.observationKind !== 'expected-schedule' || r.quality.canCompare !== false || !r.quality.review?.sourceVersion || !/^[a-f0-9]{64}$/.test(r.quality.binding?.records?.[r.key] || '')) throw new Error('Expected schedule exports require an explicit reviewed source policy');
}
export function observations(r, range = {}) {
  const estimates=new Set(r.series.estimated||[]);
  return r.dates.map((date,i) => ({date, period:r.periods?.[i]||date, value:r.series.data[i], estimated:estimates.has(date),...(r.meta?.observationKind==='expected-schedule'?{expected:(r.series.expected||[]).includes(date),observationKind:'expected-schedule'}:{})})).filter(d => (!range.from || d.date >= range.from) && (!range.to || d.date <= range.to));
}
export function aligned(records, range = {}) {
  assertCompatible(records);
  const maps = records.map(r => new Map(observations(r, range).map(d=>[d.date,d.value])));
  const dates = [...new Set(maps.flatMap(m=>[...m.keys()]))].sort();
  return dates.map(date=>({date, values:maps.map(m=>m.get(date) ?? null)}));
}
const esc = v => { const s=v == null?'':String(v); return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
export function selectedCSV(records, range = {}) {
  if(records.some(r=>r.quality?.canInterpret===false))throw new Error('Interpreted exports are withheld while source mapping or units are under review.');
  records.forEach(assertExpectedPolicy);
  const expected=records.some(r=>r.meta?.observationKind==='expected-schedule');
  return [['date', ...records.map(r=>r.id), 'reference_period', ...records.map(r=>r.id+'_estimated'),...(expected?[...records.map(r=>r.id+'_expected'),'observation_kind','forecast_as_of_status','forecast_as_of_date']:[])], ...aligned(records,range).map(d=>[d.date,...d.values,records[0].periods?.[records[0].dates.indexOf(d.date)]||d.date,...records.map(r=>(r.series.estimated||[]).includes(d.date)),...(expected?[...records.map(r=>(r.series.expected||[]).includes(d.date)),records[0].meta.observationKind,records[0].meta.forecastAsOfStatus,records[0].meta.forecastAsOfDate??'']:[])])].map(row=>row.map(esc).join(',')).join('\r\n')+'\r\n';
}
export function selectedJSON(records, range = {}) {
  records.forEach(assertExpectedPolicy);
  if(records.some(r=>r.quality!=null&&!validComparisonPolicy(r.quality)))throw new Error('Comparison capability or its explanation is invalid; interpretation is withheld.');
  if(records.length>1&&records.some(r=>!canComparePolicy(r.quality)))throw new Error('Comparison exports are withheld by source policy. Export each reviewed series individually.');
  if(records.some(r=>r.quality?.canInterpret===false))throw new Error('Interpreted exports are withheld while source mapping or units are under review.');
  return {schemaVersion:1, alignment:'sorted union of published date keys; missing values are null; no interpolation or transformations', range, series:records.map(r=>({identity:r.id,bundle:r.bundle,key:r.key,meta:publicMetadata(r),canonicalMeta:r.meta,sourceQuality:r.quality,unit:r.unit,series:{...r.series,data:undefined},observations:observations(r,range)}))};
}
export function chunkFor(manifest, anchor) {
  const part = manifest.chunks.find(c => anchor >= c.first && anchor <= c.last);
  if (!part) throw new Error('This series is unavailable in this release. Its instrument may have been retired; use the guide to find its replacement.');
  return part;
}

export function unitLabel(unit) {
  const constant=/^usd_constant_(\d{4})$/.exec(unit||'');
  if(constant)return `US dollars at constant ${constant[1]} prices`;
  return ({degc:'°C',wm2:'W/m²',ms:'m/s',degday_c:'degree-days, °C',degday_f:'degree-days, °F',gwh:'GWh',twh:'TWh',kwh:'kWh',pj:'PJ',bcm:'billion cubic metres',mmscm:'million standard cubic metres',ktoe:'thousand tonnes of oil equivalent',kt_co2e:'thousand tonnes, CO₂-equivalent',mt_co2e:'million tonnes, CO₂-equivalent',mt:'million tonnes',g_co2e_per_kwh:'g CO₂-equivalent per kWh',g_per_kwh:'g per kWh',mwh_per_person:'MWh per person',usd_per_troy_oz:'US dollars per troy ounce',usc_per_troy_oz:'US cents per troy ounce',usd_per_barrel:'US dollars per barrel',lcu:'local currency units',ppp_usd:'purchasing-power-parity US dollars',usd_ppp_2021:'purchasing-power-parity US dollars, 2021 prices',usd_ppp_2021_million:'millions of purchasing-power-parity US dollars, 2021 prices',usd_2015:'US dollars, 2015 prices',intl_usd_2011:'international dollars, 2011 prices',sdr_million:'million special drawing rights',sq_km:'km²',ha:'hectares',doy:'day of year',bps:'basis points',pp:'percentage points',gpi:'gender parity index',mpi_index:'multidimensional poverty index',gini_index:'Gini index',qty_kgs:'kg (published quantity unit)',qty_ton:'tonnes (published quantity unit)',pct_yoy:'year-on-year change, per cent',pct:'per cent',pct_rse:'Relative standard error (%)',percent:'per cent',pct_gdp:'per cent of GDP',index:'index',per_1000:'per 1,000',inr:'rupees',inr_amount:'rupees',inr_crore:'₹ crore',inr_lakh:'₹ lakh',usd:'US dollars',usd_million:'US dollars, millions',usd_millions:'US dollars, millions',mw:'MW',source_scaled_gwh:'source-scaled GWh (audit values)',count_x1e7:'source count multiplied by 10⁷'})[unit] || String(unit || 'Unit not declared').replace(/^pct_/,'per cent ').replace(/^inr_/,'rupees ').replace(/_/g,' ');
}

// Axis notation only. Plot coordinates and selected downloads remain in source units.
export function compactAxisValue(value) {
  if (value === 0) return '0';
  const magnitude=Math.abs(value);
  let scale=1,suffix='';
  for(const [threshold,word] of [[1e12,' tn'],[1e9,' bn'],[1e6,' m'],[1e3,' k']]) {
    if(magnitude>=threshold){scale=threshold;suffix=word;break;}
  }
  const label=magnitude>=1e15 || magnitude<1e-3
    ? magnitude.toExponential(1)
    : (magnitude/scale).toLocaleString('en-IN',{maximumSignificantDigits:3})+suffix;
  return (value<0?'−':'')+label;
}

export function publicMetadata(r) {
  if(r.quality?.sourceRevisionStatus!=='unknown')return r.meta;
  return {...r.meta,vintage:null,vintageStatus:'unknown',vintageNote:'The source API does not publish a revision timestamp; an archive capture does not establish data vintage.',archiveCapturedDate:r.quality.archiveCapturedDate,referencePeriod:r.quality.referencePeriod,coverage:r.quality.definition||r.meta.coverage};
}
