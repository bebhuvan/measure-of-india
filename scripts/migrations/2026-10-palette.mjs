// One-off palette migration for the 2026-10 redesign (warm vermilion system -> cool ultramarine system).
// Maps every colour of the old palette to its counterpart in the new one, at the same lightness
// and role, and rewrites hex literals in source, adapters, the OG renderer and the `color`
// presentation field of data/series bundles (no data value, vintage or date is touched).
// Idempotent: new colours are not keys of the map. Run: node scripts/migrations/2026-10-palette.mjs
import fs from "node:fs";
import path from "node:path";

export const PALETTE_MAP = {
  "#BE3E26":"#2E4BD8",  // accent: vermilion -> ultramarine
  "#E5B8AE":"#B9C3F3",  // accent tint
  "#1B1A17":"#161A22",  // ink
  "#33302B":"#2A2F3A",  // body text
  "#4A463F":"#4A5160",  // ink-soft
  "#5B564B":"#5F6675", "#5C574C":"#5F6675",   // grey1, supporting series
  "#8A857A":"#878D99",  // muted / grey4
  "#A8A293":"#A3A9B4",  // grey2
  "#B4AFA2":"#B5BAC4", "#B9B2A1":"#B5BAC4",   // faint
  "#C0B9A6":"#BFC4CD",
  "#C6C0B0":"#C9CED6",  // grey3
  "#C9C3B2":"#CDD1D8", "#C9C2B0":"#CDD1D8",
  "#D8D3C4":"#DADDE3", "#D8D2C2":"#DADDE3", "#D9D3C2":"#DADDE3", "#DDD6C4":"#DADDE3", "#DCD7C6":"#DADDE3",
  "#E0DACA":"#E3E6EB",
  "#E6E2D6":"#ECEEF2",  // rule
  "#E5DFCE":"#EEF0F3", "#EAE6D8":"#EEF0F3", "#EAE5D7":"#EEF0F3",
  "#EDE9DA":"#F0F2F5",  // grid
  "#F8F6F1":"#F4F6FD",  // reference band
  "#FAF8F2":"#F6F7F9", "#F4F0E5":"#F6F7F9",
};
const re = new RegExp(Object.keys(PALETTE_MAP).join("|"), "gi");
const swap = (s) => s.replace(re, (m) => PALETTE_MAP[m.toUpperCase()]);

const roots = ["src", "scripts/lib/products", "scripts/og.mjs", "public/favicon.svg"];
const exts = new Set([".js", ".mjs", ".astro", ".svg", ".json"]);
let files = 0, hits = 0;
function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const f of fs.readdirSync(p)) walk(path.join(p, f)); return; }
  if (!exts.has(path.extname(p))) return;
  const src = fs.readFileSync(p, "utf8"), out = swap(src);
  if (out !== src) { fs.writeFileSync(p, out); files++; hits += (src.match(re) || []).length; }
}
for (const r of roots) if (fs.existsSync(r)) walk(r);
// bundles: only the per-series `color` presentation field, edited in place so the file's
// formatting (and therefore its diff) is untouched apart from those values
let bundles = 0;
const colorField = /("color"\s*:\s*")(#[0-9A-Fa-f]{6})(")/g;
for (const f of fs.readdirSync("data/series")) {
  const p = path.join("data/series", f), raw = fs.readFileSync(p, "utf8");
  const out = raw.replace(colorField, (m, a, hex, b) => a + (PALETTE_MAP[hex.toUpperCase()] || hex) + b);
  if (out !== raw) { fs.writeFileSync(p, out); bundles++; }
}
console.log(`palette: ${hits} literals in ${files} source files; color field in ${bundles} bundles`);
