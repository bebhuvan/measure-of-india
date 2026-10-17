// NSS 77 API label corrections, each proven against the printed Report 587 appendix.
// The API serves some tables with category labels that do not match the numbers under them
// (docs/reference/farm-households.md, "Defects and deterministic remedies"). A correction here
// relabels raw rows before they are keyed; the values are never touched, and the original API
// label is kept in the series note. reconcileFarmLabels() replays every corrected cell against the
// report table the correction cites and the bake stops unless every matched cell agrees.

const AGRI = 'Agricultural Households', NONAGRI = 'Non-agricultural Households';
const SWAP = {map: {[AGRI]: NONAGRI, [NONAGRI]: AGRI}, why: 'the API swaps the agricultural and non-agricultural household labels'};
const IN_MILK = r => ['Cattle', 'Buffalo'].includes(r.livestock_owned) && r.stock == null && r.gender == null;

// code -> {table: the Report 587 appendix table that proves it, rules}
// A rule relabels one dimension: `map` from API label to report label, or `set` a label where
// `when` holds (null API labels), or `add` a dimension the API leaves out. `when` reads the
// original API row.
export const LABEL_CORRECTIONS = {
 18: {table: '5', rules: [
  {dim: 'household_classification', ...SWAP},
  {dim: 'Social Group', when: r => r.state === 'Himachal Pradesh', map: {OBC: 'Others', Others: 'All'}, why: 'the report prints no OBC block for Himachal Pradesh, and the API shifts its others and all blocks up one label'}]},
 19: {table: '36', rules: [{dim: 'household_classification', ...SWAP}]},
 34: {table: '31', rules: [{dim: 'household_classification', ...SWAP}]},
 36: {table: '34', rules: [{dim: 'sub_indicator', map: {
  'No. Per 1000 of Households Reporting Leasing-out of Land Belonging to': 'No. Per 1000 of Households Reporting Leasing-in of Land Belonging to',
  'Average Leased-out Area Per Reporting Household (ha)': 'Average Leased-in Area Per Reporting Household (ha)'},
  why: 'the API sub-indicator says leasing-out, but the values are the leasing-in table'}]},
 39: {table: '45', rules: [
  {dim: 'stock', when: IN_MILK, set: 'In milk', why: 'cattle and buffalo rows with no stock or gender are the report\'s in-milk columns (2) and (9)'},
  {dim: 'gender', map: {Person: 'Male and female'}, why: 'the report\'s person column is male and female together'},
  {dim: 'season', add: 'July 2018-December 2018', why: 'Table 45 is the first visit, July to December 2018; the API omits the season'}]},
};

/** One raw API row, relabelled. Returns the corrected row and the changes made (dim, from, to). */
export function correctFarmRow(code, r) {
 const spec = LABEL_CORRECTIONS[code];
 if (!spec) return {row: r, changes: []};
 const row = {...r}, changes = [];
 for (const rule of spec.rules) {
  if (rule.when && !rule.when(r)) continue;
  if (rule.add !== undefined) {
   if (rule.dim in r) throw Error(`Farm ${code}: the API now serves ${rule.dim}; review the correction`);
   row[rule.dim] = rule.add; changes.push({dim: rule.dim, from: null, to: rule.add, why: rule.why}); continue;
  }
  const from = r[rule.dim], to = rule.set !== undefined ? rule.set : rule.map[from];
  if (to === undefined || to === from) continue;
  row[rule.dim] = to; changes.push({dim: rule.dim, from: from ?? null, to, why: rule.why});
 }
 return {row, changes};
}

/** The series note for a corrected cell, naming the original API labels. */
export function correctionNote(code, changes) {
 if (!changes.length) return null;
 const parts = changes.map(c => c.from == null ? `${c.dim} "${c.to}", blank or absent in the API (${c.why})` : `${c.dim} "${c.from}" in the API is "${c.to}" in the report (${c.why})`);
 return `API label corrected against Report 587 Table ${LABEL_CORRECTIONS[code].table}: ${parts.join('; ')}. Values unchanged; every corrected cell matches the printed table.`;
}

// ---- Report 587 appendix tables as blocks of labelled number rows ----
const NUM = /^(?:-?[\d,]+(?:\.\d+)?|X)$/, LABEL = /^[<>A-Za-z0-9.&=\- ]+$/;
// A row is a label, two or more spaces, then only numbers (X is the report's blank). Split rather
// than one regex: pdftotext lines are wide and a backtracking pattern takes minutes on them.
const splitRow = l => {
 const parts = l.trim().split(/\s{2,}/);
 if (parts.length < 2 || !LABEL.test(parts[0])) return null;
 const nums = parts.slice(1).join(' ').split(/\s+/);
 return nums.every(x => NUM.test(x)) ? [parts[0], nums] : null;
};
/** Blocks {table, ctx: [state, ...context parts], rows: Map(label -> numbers)} for the named tables. */
export function reportBlocks(text, tables) {
 const want = new Set(tables.map(String)), out = new Map([...want].map(t => [t, []]));
 let cur = null;
 for (const l of text.split('\n')) {
  const h = l.match(/^\s*Table ?(\d+[A-Z]?):/);
  if (h) { cur = want.has(h[1]) ? {table: h[1], ctx: null, rows: new Map()} : null; if (cur) out.get(h[1]).push(cur); continue; }
  if (!cur) continue;
  if (!cur.ctx && /(social group:|Season:)/.test(l) && !/^\s*\(/.test(l)) { cur.ctx = l.trim().split(/\s{2,}/).map(p => p.replace(/^(social group|Season):\s*/, '')); continue; }
  const m = splitRow(l);
  if (m && !/^\(?\d+\)?$/.test(m[0].trim())) { const label = norm(m[0]); if (!cur.rows.has(label)) cur.rows.set(label, m[1].map(x => x === 'X' ? null : Number(x.replace(/,/g, '')))); }
 }
 return out;
}
export const norm = s => String(s ?? '').toLowerCase().replace(/[–—]/g, '-').replace(/^all-india$/, 'all india').replace(/^(nill?|0\.000)$/, 'nil').replace(/^all sizes?$/, 'all sizes').replace(/\s+/g, ' ').trim();
const num = v => { const t = String(v ?? '').replace(/,/g, '').trim(); return t === '' || !Number.isFinite(Number(t)) ? null : Number(t); };

// Per code: where a corrected API row sits in its report table (block context, row label, column).
// Report columns are counted from 0 at the first number column.
const COL18 = {'self-employment in|crop production': 0, 'self-employment in|livestock farming': 1, 'self-employment in|other agricultural activities': 2, 'self-employment in|non-agricultural enterprise': 3, 'regular wage/salary earning in|agriculture': 4, 'regular wage/salary earning in|non- agriculture': 5, 'casual labour in|agriculture': 6, 'casual labour in|non- agriculture': 7, 'other|': 8, 'all|': 9, 'number of households|': 10};
const SUB19 = ['No. Per 1000 of Opr. Holdings', 'Avg. Area Per Opr. Holding (ha)', 'Avg. Area Owned and Possessed Per Opr. Holding (ha)', 'Avg. Area Operated (used for Agri. Activities) Per Holding (ha)', 'No. of Parcels Per Holding', 'Number of Joint Holdings Per 1000 of Holdings', 'Per 1000 Distribution of Operational Holdings by Number of Crops Harvested as 0', 'Per 1000 Distribution of Operational Holdings by Number of Crops Harvested as 1', 'Per 1000 Distribution of Operational Holdings by Number of Crops Harvested as 2', 'Per 1000 Distribution of Operational Holdings by Number of Crops Harvested as 3', 'Per 1000 Distribution of Operational Holdings by Number of Crops Harvested as More Than 3', 'Avg. No. of Crops Harvested Per Hh Opr. Holding'];
const COL34 = ['Average Household Size', 'Per 1000 Distribution of Households', 'Average Area Homestead land Owned per hh(ha)', 'Average area Land Owned, Excluding Homestead Land per hh (ha)', 'Average Area Owned per hh (ha)'];
const SG36 = ['st', 'sc', 'obc', 'others', 'all'];
const COL39 = ['cattle|in milk|', 'cattle|young stock|male', 'cattle|young stock|female', 'cattle|young stock|male and female', 'cattle|others|male', 'cattle|others|female', 'cattle|others|male and female', 'buffalo|in milk|', 'buffalo|young stock|male', 'buffalo|young stock|female', 'buffalo|young stock|male and female', 'buffalo|others|male', 'buffalo|others|female', 'buffalo|others|male and female', 'ovine and other mammals||', 'poultry birds||', 'others||'];
const LOCATE = {
 18: r => ({ctx: [r.state, r['Social Group'], r.household_classification], label: r['Land_Possessed(hectares)'] == null ? 'estimated no.' : r['Land_Possessed(hectares)'], col: COL18[norm(r.household_employment) + '|' + norm(r.household_sub_employment)]}),
 19: r => ({ctx: [r.state, r['Social Group'], r.household_classification, r.season], label: r.operational_holding, col: SUB19.indexOf(r.sub_indicator)}),
 34: r => ({ctx: [r.state, r['Social Group'], r.household_classification, r.season], label: r.ownership_holding, col: COL34.indexOf(r.ownership_holding_area)}),
 36: r => ({ctx: [r.state, r.season], label: r.ownership_holding, col: SG36.indexOf(norm(r['Social Group'])) + (/Area/.test(r.sub_indicator) ? 5 : 0)}),
 39: r => ({ctx: [r.state, r['Social Group'], r.season], label: r.ownership_holding, col: COL39.indexOf([r.livestock_owned, r.stock, r.gender].map(norm).join('|'))}),
};
// Matched-cell counts the reconciliation must reach; a parser or source change that matches fewer
// cells stops the bake instead of passing on a smaller sample.
export const EXPECTED_MATCHED = {18: 33176, 19: 127008, 34: 85050, 36: 13950, 39: 32130};

/** Replay corrected API rows ({code: rows}) against the report. Throws unless every matched cell agrees. */
export function reconcileFarmLabels(text, rowsByCode, {strict = true, correct = true} = {}) {
 const codes = Object.keys(rowsByCode).map(Number), blocks = reportBlocks(text, codes.map(c => LABEL_CORRECTIONS[c].table)), result = {};
 for (const code of codes) {
  const table = LABEL_CORRECTIONS[code].table, index = new Map();
  for (const b of blocks.get(table)) if (b.ctx) { const k = b.ctx.map(norm).join('|'); if (!index.has(k)) index.set(k, b.rows); }
  const res = {reportTable: table, apiRows: rowsByCode[code].length, matched: 0, agree: 0, blankBoth: 0, disagree: 0, unmatched: 0, corrected: 0, examples: []};
  for (const raw of rowsByCode[code]) {
   const {row, changes} = correct ? correctFarmRow(code, raw) : {row: raw, changes: []};
   if (changes.length) res.corrected++;
   const at = LOCATE[code](row), nums = index.get(at.ctx.map(norm).join('|'))?.get(norm(at.label));
   if (!nums || at.col == null || at.col < 0 || at.col >= nums.length) { res.unmatched++; continue; }
   res.matched++;
   const a = num(row.value), p = nums[at.col];
   if (a == null && p == null) res.blankBoth++;
   else if (a != null && p != null && Math.abs(a - p) < 1e-9) res.agree++;
   else { res.disagree++; if (res.examples.length < 5) res.examples.push({dims: at, api: raw.value, report: p}); }
  }
  if (!res.examples.length) delete res.examples;
  result[code] = res;
  if (strict && (res.disagree || res.matched < EXPECTED_MATCHED[code])) throw Error(`Farm ${code}: corrected labels against Report 587 Table ${table}: ${res.agree + res.blankBoth} of ${res.matched} matched cells agree (expected ${EXPECTED_MATCHED[code]} matched, all agreeing)${res.examples ? ' e.g. ' + JSON.stringify(res.examples[0]) : ''}`);
 }
 return result;
}
