#!/usr/bin/env node
// Run only the TradeStat fetch phase (the slow part), resumably:
//   node scripts/lib/products/tradestat-fetch.mjs [group ...]
// groups: cw region ftpa eidb cwq cw6 cw8 cw8q cxc2 cxc4 (default: all, in that priority).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAll } from "./tradestat.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const only = process.argv.slice(2);
await fetchAll(ROOT, new Date().toISOString().slice(0, 10), { only: only.length ? only : null, log: (m) => console.log(new Date().toISOString().slice(11, 19), m) });
