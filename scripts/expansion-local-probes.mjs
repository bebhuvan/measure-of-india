#!/usr/bin/env node
// Read-only checks of candidate Data Bank publications. No ingestion/promotion.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
const cfg = YAML.parse(fs.readFileSync('data/sources.yml', 'utf8'));
const bankRoot = (process.env.INDIA_ATLAS_DATABANK ?? cfg.families.databank.root).replace(/^~(?=\/)/, os.homedir());
const probes = [
  ['amfi_industry_flows', 'SELECT COUNT(*) AS rows, COUNT(DISTINCT period_end) AS periods, MIN(period_end) AS first_period, MAX(period_end) AS last_period, COUNT(DISTINCT sub_category) AS categories FROM (SELECT DISTINCT period_end, parent_category, sub_category, row_kind, n_schemes, n_folios, funds_mobilized_inr_cr, repurchase_redemption_inr_cr, net_flow_inr_cr, net_aum_inr_cr, avg_aum_inr_cr FROM {table}) ORDER BY first_period'],
  ['amfi_statewise_aum', 'SELECT COUNT(*) AS rows, COUNT(DISTINCT state) AS states, COUNT(DISTINCT category) AS categories, MIN(date) AS first_period, MAX(date) AS last_period FROM (SELECT DISTINCT state, date, category, aum_inr_cr FROM {table}) ORDER BY first_period'],
  ['sebi_bulletin_series', 'SELECT family, COUNT(*) AS rows, COUNT(DISTINCT series) AS series, MIN(period_month) AS first_period, MAX(period_month) AS last_period FROM (SELECT DISTINCT family, entity, series, measure, unit, period_month, value FROM {table}) GROUP BY family ORDER BY family'],
  ['imf_portwatch_ports_daily', "SELECT iso3, COUNT(*) AS rows, COUNT(DISTINCT portid) AS ports, MIN(date) AS first_period, MAX(date) AS last_period FROM (SELECT DISTINCT iso3, portid, date FROM {table}) GROUP BY iso3 ORDER BY iso3"],
  ['rbi_dbie_webi_prompted_rows', 'SELECT report_id, report_name, COUNT(*) AS rows, COUNT(DISTINCT prompt_answer) AS prompt_answers FROM (SELECT DISTINCT report_id, report_name, prompt_answer, dataprovider_id, row_no, record_json FROM {table}) GROUP BY report_id, report_name ORDER BY report_id, report_name']
];
const result = { checkedAt: new Date().toISOString(), bankRoot,
  methodology: 'Read only the Data Bank publications selected by its CLI, with --lineage-only. Exact duplicate records are removed within the listed query columns; counts are not cross-provider reconciled or assertions of statistical correctness. Data readiness still requires keys, units, identities and source-cell checks.', probes: [] };
for (const [dataset, sql] of probes) {
  const stdout = execFileSync('uv', ['run', '--quiet', 'databank', 'query', 'sql', dataset, sql, '--lineage-only', '--json'],
    { cwd: bankRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  const rows = JSON.parse(stdout.slice(stdout.indexOf('[')));
  if (!rows.length) throw new Error(`${dataset}: publication probe returned no rows`);
  result.probes.push({ dataset, sql, rows });
  console.log(dataset, JSON.stringify(rows));
}
const output = path.resolve('docs/reference/expansion-local-probes.json');
fs.writeFileSync(output + '.tmp', JSON.stringify(result, null, 2) + '\n');
fs.renameSync(output + '.tmp', output);
