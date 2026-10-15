// Resolve the actual index/RSS headline and spark paths before a costly build.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DOSSIERS} from '../src/dossiers/registry.js';
import {HEADLINE, SPARK, bundle, headlineOf, sparkOf} from '../src/dossiers/headline.js';

for (const d of DOSSIERS) {
 test(`${d.slug}: headline and spark resolve to valid registered source cells`, () => {
  assert.ok(HEADLINE[d.slug], `${d.slug}: missing headline definition`);
  const current = bundle(d.currentBundle), headline = headlineOf(d);
  assert.equal(headline.bundle, current);
  for (const field of ['value', 'what', 'period']) {
   assert.equal(typeof headline[field], 'string', `${d.slug}: ${field}`);
   assert.ok(headline[field].trim(), `${d.slug}: empty ${field}`);
   assert.doesNotMatch(headline[field], /\b(?:NaN|Infinity|undefined|null)\b/, `${d.slug}: invalid ${field}`);
  }
  assert.equal(headline.asOf, HEADLINE[d.slug].asOf ? HEADLINE[d.slug].asOf(current) : current.dates.at(-1));

  const spec = SPARK[d.slug];
  assert.ok(spec, `${d.slug}: missing spark definition`);
  const sourceNames = spec.rounds ?? [spec.bundle];
  const sources = sourceNames.map(slug => {
   assert.ok(d.bundles.includes(slug), `${d.slug}: unregistered spark source ${slug}`);
   const b = bundle(slug);
   const s = spec.series ? b.series[spec.series] : Object.values(b.series).find(x => x.label.includes(spec.label));
   assert.ok(s, `${d.slug}: missing spark series ${spec.series ?? spec.label} in ${slug}`);
   assert.equal(s.data.length, b.dates.length, `${d.slug}: source axis mismatch`);
   return {b, s};
  });
  const spark = sparkOf(d);
  assert.ok(spark.dates.length, `${d.slug}: empty spark`);
  assert.equal(spark.values.length, spark.dates.length, `${d.slug}: spark axis mismatch`);
  assert.ok(spark.values.some(Number.isFinite), `${d.slug}: no numerical spark observation`);
  for (let i = 0; i < spark.dates.length; i++) {
   const date = spark.dates[i], value = spark.values[i];
   assert.ok(value === null || Number.isFinite(value), `${d.slug}: invalid spark value at ${date}`);
   assert.ok(sources.some(({b, s}) => b.dates.some((sourceDate, j) => sourceDate === date && s.data[j] === value)), `${d.slug}: spark invents an observation at ${date}`);
   if (i) assert.ok(date > spark.dates[i - 1], `${d.slug}: spark dates are not chronological`);
  }
  if (!spec.rounds && sources[0].b.dates.length === 1) {
   assert.equal(spark.dates.length, 1, `${d.slug}: snapshot acquired synthetic history`);
   assert.equal(spark.slope, false, `${d.slug}: snapshot presented as a two-round comparison`);
  }
 });
}
