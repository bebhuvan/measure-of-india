// scripts/lib/archive/trade.mjs: the trade family stages its archive tables itself
// (scripts/lib/products/tradestat-*.mjs write data/archive/staging/trade/ with files.json, and
// the per-call raw responses to staging/trade-raw/ indexed in data/raw/trade-index.json), so it
// needs no export hook, only this: which ledger rule each staged table comes from, and which
// baked bundles it rolls up to.
//   - partner x heading tables -> the rule on "country-hs4", rolling up to the partner-by-chapter
//     bundle of the same flow;
//   - 6- and 8-digit line tables -> the rule on hs6/hs8, rolling up to the heading (hs4) bundle
//     of the same flow.
export function stagedRule(entry, rules) {
  const partner = /partner/.test(entry.cut ?? "") || /partner/.test(entry.file);
  const r = rules.find(({ rule }) => [].concat(rule.match).some((m) => (partner ? /country-hs4/.test(m) : /hs[68]/.test(m))));
  if (!r) return null;
  const flow = entry.flow;
  const rolls = [].concat(r.rule.rolls_up_to ?? []);
  return { rule: [].concat(r.rule.match).join(", "), rolls_up_to: rolls.filter((b) => !flow || b.includes(flow)).length ? rolls.filter((b) => b.includes(flow)) : rolls };
}
