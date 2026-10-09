// scripts/lib/bis.mjs: the family client for the Bank for International Settlements' statistics.
//
// Two paths, for two jobs:
//   - VALUES come from the owner's Data Bank (datasets bis_series and bis_daily), which mirrors
//     the BIS SDMX API under its own validation rules (its docs/BIS_SOURCES.md). Read-only,
//     through scripts/lib/databank.mjs databankQuery(); the Atlas never re-fetches BIS values.
//   - The CATALOGUE (what BIS publishes for India) comes from BIS itself: one series-key listing
//     per dataflow, `detail=serieskeysonly&format=csv`, a few kilobytes each. This is the
//     coverage ledger's source of truth (docs/CONTRACT-coverage.md): a list we did not type,
//     so a series BIS adds for India fails the gate until the ledger takes a position on it.
//
// Etiquette: BIS documents no rate limit; we keep one request at a time with a 3-second gap.
import { getText } from "./net.mjs";
import { parseCsv } from "./tabular.mjs";

export const BIS_API = "https://stats.bis.org/api/v1";

/** Every series key BIS lists for a dataflow, as rows of { DIM: code }. */
export async function bisSeriesKeys(flow) {
  const text = await getText(`${BIS_API}/data/${flow}/all?detail=serieskeysonly&format=csv`, { gapMs: 3000, retries: 4, deadlineMs: 180_000 });
  const rows = parseCsv(text, ",");
  const header = rows[0];
  if (!header?.includes("FREQ")) throw new Error(`bis: ${flow} key listing has no FREQ column (got "${String(header).slice(0, 120)}")`);
  const out = rows.slice(1).filter((r) => r.length >= header.length - 1 && r[0])
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
  await new Promise((r) => setTimeout(r, 3000));
  return { dims: header.filter((h) => !["TIME_PERIOD", "OBS_VALUE"].includes(h)), keys: out };
}
