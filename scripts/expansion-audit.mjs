#!/usr/bin/env node
// Read-only census of coverage readiness, not a replacement for source/reader QA.
// Writes derived metadata only; never changes raw data, bundles or ledgers.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { DOSSIERS } from '../src/dossiers/registry.js';
import { guideBundles } from '../src/dossiers/everycut.js';
import { parseCsv } from './lib/tabular.mjs';
import { readCatalogue } from './lib/catalogue.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// guideBundles resolves files relative to cwd, as the site's build does.
if (process.cwd() !== root) throw new Error('Run expansion-audit from the Atlas repository root.');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const list = x => x == null ? [] : Array.isArray(x) ? x : [x];
const glob = s => new RegExp('^' + s.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
const owners = new Map();
const guides = DOSSIERS.map(d => {
  const slugs = guideBundles(d);
  for (const s of slugs) { if (!owners.has(s)) owners.set(s, []); owners.get(s).push(d.slug); }
  return { slug: d.slug, title: d.title, bundles: slugs.length };
});
const bundles = fs.readdirSync(path.join(root, 'data/series')).filter(f => f.endsWith('.json')).sort().map(f => {
  const b = read('data/series/' + f), entries = Object.entries(b.series);
  let observations = 0, first = null, last = null;
  for (const [key, s] of entries) {
    if (!Array.isArray(s.data) || s.data.length !== b.dates.length) throw new Error(`${f}:${key}: malformed parallel arrays`);
    for (let i = 0; i < s.data.length; i++) {
      if (s.data[i] == null) continue;
      if (!Number.isFinite(s.data[i])) throw new Error(`${f}:${key}: non-finite value`);
      observations++;
      const date = b.dates[i];
      if (first == null || date < first) first = date;
      if (last == null || date > last) last = date;
    }
  }
  const slug = f.slice(0, -5);
  return { slug, family: b.meta.dossier, source: b.meta.source, vintage: b.meta.vintage,
    base: b.meta.base, frequency: b.meta.frequency, series: entries.length,
    observations, first, last, guides: owners.get(slug) ?? [] };
});
const byBundle = new Map(bundles.map(b => [b.slug, b]));
const ledgerFamilies = [];
const reportLinks = new Map();
for (const f of fs.readdirSync(path.join(root, 'data/coverage')).filter(f => /\.ya?ml$/.test(f)).sort()) {
  const ledger = YAML.parse(fs.readFileSync(path.join(root, 'data/coverage', f), 'utf8'));
  const catalogue = readCatalogue(ledger.catalogue, root);
  const rules = ledger.rules.map(r => ({ ...r, patterns: list(r.match).map(glob) }));
  const counts = { shown: 0, baked: 0, excluded: 0, blocked: 0, pending: 0, unmatched: 0 };
  const withoutGuide = [];
  for (const item of catalogue.items) {
    const rule = rules.find(r => r.patterns.some(p => p.test(item.id)));
    counts[rule?.status ?? 'unmatched']++;
    if (rule && ['shown', 'baked'].includes(rule.status)) {
      const named = list(rule.bundle);
      if (named.some(b => !byBundle.has(b))) throw new Error(`${f}:${item.id}: nonexistent bundle`);
      if (!named.some(b => byBundle.get(b).guides.length)) withoutGuide.push(item.id);
    }
    // Only explicit catalogue report metadata is accepted. No numeric-ID guessing.
    const report = item.dims?.report ?? item.dims?.report_id ?? item.id.match(/^dbie:(\d+)(?::|$)/)?.[1];
    if (report != null) {
      const id = String(report);
      if (!reportLinks.has(id)) reportLinks.set(id, new Map());
      const familyCounts = reportLinks.get(id);
      const link = familyCounts.get(ledger.family) ?? { family: ledger.family, items: 0, statuses: {} };
      link.items++; link.statuses[rule?.status ?? 'unmatched'] = (link.statuses[rule?.status ?? 'unmatched'] ?? 0) + 1;
      familyCounts.set(ledger.family, link);
    }
  }
  ledgerFamilies.push({ family: ledger.family, catalogue: ledger.catalogue,
    generatedAt: catalogue.generated_at, declaredGuides: list(ledger.guides),
    items: catalogue.items.length, counts, itemsNamingBundlesOutsideGuideTables: withoutGuide.length });
}
const summary = selected => ({ bundles: selected.length,
  series: selected.reduce((n, b) => n + b.series, 0),
  observations: selected.reduce((n, b) => n + b.observations, 0) });
const unreachable = bundles.filter(b => !b.guides.length);
const groups = [...new Set(bundles.map(b => b.family))].sort().map(family => {
  const all = bundles.filter(b => b.family === family);
  return { family, ...summary(all), outsideGuideTables: summary(all.filter(b => !b.guides.length)) };
});
const profilePlan = read('data/raw/profiles-mospi-index.json');
const mospi = Object.entries(profilePlan.products).map(([product, p]) => {
  const inds = p.indicators ?? [];
  const baked = bundles.filter(b => b.slug.startsWith('profiles-mospi-' + product + '-'));
  return { product, indicators: inds.length, archived: inds.filter(i => i.done === true).length,
    expectedRows: inds.reduce((n, i) => n + (i.expected ?? 0), 0),
    expectedRowsOfCompletedIndicators: inds.filter(i => i.done === true).reduce((n, i) => n + (i.expected ?? 0), 0),
    ...summary(baked), failures: inds.filter(i => i.fetchError || i.error).map(i => ({ code: i.code, survey: i.survey, error: i.fetchError ?? i.error })),
    unarchived: inds.filter(i => i.done !== true).map(i => ({ code: i.code, survey: i.survey, expected: i.expected, label: i.label })),
    error: p.error ?? null };
});
const cfg = YAML.parse(fs.readFileSync(path.join(root, 'data/sources.yml'), 'utf8'));
const bankRoot = (process.env.INDIA_ATLAS_DATABANK ?? cfg.families.databank.root).replace(/^~(?=\/)/, os.homedir());
const invPath = path.join(bankRoot, 'data/derived/rbi_dbie_webi_inventory.csv');
let dbie = { available: false, inventory: invPath };
if (fs.existsSync(invPath)) {
  const [header, ...rows] = parseCsv(fs.readFileSync(invPath, 'utf8'), ',');
  const reports = rows.filter(r => r.length === header.length).map(row => Object.fromEntries(header.map((h, i) => [h, row[i]])));
  if (new Set(reports.map(r => r.report_id)).size !== reports.length) throw new Error('DBIE inventory has duplicate report IDs');
  const detail = reports.map(r => ({ id: r.report_id, name: r.report_name, menu: r.menu, frequency: r.frequency,
    sourceLastPeriod: r.dbie_to_date, status: r.last_status,
    catalogueReferences: [...(reportLinks.get(r.report_id)?.values() ?? [])] }));
  dbie = { available: true, inventory: invPath, reports: detail.length,
    rawValidated: detail.filter(r => r.status === 'raw_validated').length,
    withoutExplicitCatalogueReportReference: detail.filter(r => !r.catalogueReferences.length).length,
    menus: [...new Set(detail.map(r => r.menu))].sort().map(menu => ({ menu,
      reports: detail.filter(r => r.menu === menu).length,
      withoutReference: detail.filter(r => r.menu === menu && !r.catalogueReferences.length).length })), detail };
}
const out = {
  methodology: [
    'Counts are series entries, not distinct economic concepts; duplicates across bundles and source mirrors remain counted.',
    'Observations count finite non-null values in committed canonical bundles, including estimates.',
    'Guide access uses the same guideBundles function as EveryCut, including family-prefix expansion; it does not prove a chart or explanation exists.',
    'State-profile tiles may use bundles outside national guide tables; outsideGuideTables does not mean absent from the entire site.',
    'Ledger shown/baked statuses are recorded as declared, not independently reverified.',
    'DBIE references use explicit dims.report/report_id metadata or a dbie:<report ID> item ID; an unreferenced report may be a duplicate, out of scope or referenced elsewhere. This is a discovery list, not a list of missing unique series.',
    'MoSPI row counts are expected source counts in the existing ingestion index, not newly recounted archived rows.'
  ],
  guides, totals: summary(bundles), outsideGuideTables: summary(unreachable),
  groups, ledgers: ledgerFamilies, mospi, dbie, bundles
};
const output = path.join(root, 'docs/expansion-audit.json');
fs.writeFileSync(output + '.tmp', JSON.stringify(out, null, 2) + '\n');
fs.renameSync(output + '.tmp', output);
console.log(JSON.stringify({ guides: guides.length, totals: out.totals, outsideGuideTables: out.outsideGuideTables,
  mospi: mospi.map(({ unarchived, failures, ...p }) => ({ ...p, unarchived: unarchived.length, failures: failures.length })),
  dbie: { reports: dbie.reports, rawValidated: dbie.rawValidated, withoutExplicitCatalogueReportReference: dbie.withoutExplicitCatalogueReportReference }, output }, null, 2));
