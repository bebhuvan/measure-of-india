// /search-index.json: every series on the site, for the home page search.
// Built from data/series at build time, so the index can never disagree with the guides.
// One compact row per series: [label, context, latest value, period, guide slug, recent values].
// The home page fetches it only when a reader starts to search.
import fs from "node:fs";
import path from "node:path";
import { DOSSIERS } from "../dossiers/registry.js";

const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const period = (freq, iso) => {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
  if (freq === "monthly") return `${M3[m - 1]} ${y}`;
  if (freq === "quarterly") return `${M3[m - 1]} to ${M3[(m + 1) % 12]} ${m === 11 ? y + 1 : y}`;
  if (freq === "annual" && iso.length > 4 && m === 4) return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  return String(y);
};
const fmt = (v) => Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-IN") : Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2);
const round3 = (v) => v == null ? null : +v.toPrecision(4);
// labels arrive as published; raw slugs ("kerala", "andhra_pradesh") are given capitals
const tidy = (l) => { const t = l.replace(/ · /g, ", ").replace(/_/g, " ").trim(); return /^[a-z][a-z ]*$/.test(t) ? t.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and") : t; };

export function GET() {
  const guideOf = {};
  for (const d of DOSSIERS) for (const b of [d.currentBundle, ...(d.bundles || [])]) guideOf[b] ??= d.slug;
  const rows = [];
  for (const f of fs.readdirSync("data/series").filter((f) => f.endsWith(".json")).sort()) {
    const slug = f.replace(/\.json$/, "");
    const b = JSON.parse(fs.readFileSync(path.join("data/series", f), "utf8"));
    const m = b.meta || {};
    const ctx = [m.product || m.source, m.base && m.base !== "null" ? `base ${m.base}` : null, m.frequency].filter(Boolean).join(", ");
    for (const s of Object.values(b.series)) {
      let i = s.data.length - 1; while (i >= 0 && s.data[i] == null) i--;
      if (i < 0) continue;
      const recent = s.data.slice(Math.max(0, i - 23), i + 1).map(round3);
      rows.push([tidy(s.label), ctx, fmt(s.data[i]), period(m.frequency, b.dates[i]), guideOf[slug] ?? null, recent]);
    }
  }
  const guides = Object.fromEntries(DOSSIERS.map((d) => [d.slug, d.title]));
  return new Response(JSON.stringify({ n: rows.length, guides, rows }), { headers: { "Content-Type": "application/json" } });
}
