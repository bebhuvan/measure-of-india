// scripts/lib/products/tradestat-build.mjs: the `tradestat` product entry point for
// scripts/fetch.mjs. Fetch (resumable; skipped with TRADESTAT_OFFLINE=1), then bake from the
// archive, then write the coverage catalogue. See tradestat.mjs and tradestat-bake.mjs.
import fs from "node:fs";
import path from "node:path";
import { fetchAll, RAW, readRaw, valueColumns, rel } from "./tradestat.mjs";
import { allZero } from "../tradestat.mjs";
import { bakeTradestat } from "./tradestat-bake.mjs";
import { writeTradeCatalogue } from "./trade-catalogue.mjs";

/** The newest month in the archive whose own column is published (offline runs). */
function latestInArchive(root, dir, re) {
  const files = fs.readdirSync(path.join(root, RAW, dir)).filter((f) => re.test(f)).sort().reverse();
  for (const f of files) {
    const r = readRaw(root, `${RAW}/${dir}/${f}`);
    const c = valueColumns(r.header)[1];
    if (c && !allZero(r.rows, c.i)) return f.match(/(\d{4}-\d{2})\.json\.gz$/)[1];
  }
  throw new Error(`tradestat: no published month in ${RAW}/${dir}`);
}

export async function buildTradestat(root, dcfg, vintage, cfg) {
  let latest, latestFtpa;
  if (process.env.TRADESTAT_OFFLINE === "1") {
    latest = latestInArchive(root, "meidb-commodity", /^export-hs2-usd-/);
    latestFtpa = latestInArchive(root, "ftpa", /^export-usd-/);
    console.log(`tradestat: offline bake, archive runs to ${latest} (MEIDB) and ${latestFtpa} (FTPA)`);
  } else {
    ({ latest, latestFtpa } = await fetchAll(root, vintage));
  }
  // anchor: the source must have served the headline table for the latest month
  const anchor = readRaw(root, rel.cw("export", 2, "usd", latest));
  if (!anchor || !anchor.rows.length) throw new Error(`tradestat: no data returned: exports by chapter, ${latest}`);
  const { written } = bakeTradestat(root, dcfg, { latest, latestFtpa });
  writeTradeCatalogue(root, { latest, latestFtpa });
  console.log(`tradestat: ${written.length} bundles`);
}
