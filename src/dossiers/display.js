// src/dossiers/display.js — derives the display strings the registry used to
// hand-type: the titleblock dateStamp and the vintageLabel. Data facts (which
// print, which vintage, which round) come from the bundles at build time, so a
// new release can never leave a stale label behind; the registry keeps only
// the derivation style (`stamp`) and, where no bundle fact exists (page
// revision months on survey dossiers), an explicit text. scripts/qc.mjs
// verifies every rendered dossier page against these derivations.
//
// Styles (stamp.dateStyle / stamp.vintageStyle):
//   "release"      — the current bundle's releaseDate (month or short date)
//   "month"        — the current bundle's latest data month
//   "monthNext"    — the month after the latest data month (the release month
//                    of a MoSPI monthly print, which lands the following month)
//   "vintageMonth" / "vintage" — the current bundle's meta.vintage
//   "round"        — the survey round of the latest period ("2023-24";
//                    stamp.plural appends "s" for multi-survey dossiers)
//   "latestRound"  — the newest round across the dossier's bundles with a
//                    prefix (stamp.vintagePrefix)
//   absent         — stamp.dateText / stamp.vintageText, a hand-typed string
//                    allowed only where no bundle fact exists

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const cache = {};

export function bundleOf(slug) {
  if (!cache[slug]) {
    cache[slug] = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));
  }
  return cache[slug];
}

const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const monthYearFull = (iso) => cap(`${MF[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`);
const monthYearShort = (iso) => `${MS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const dateShort = (iso) => `${Number(iso.slice(8, 10))} ${MS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const shiftMonth = (ym, n) => {
  let [y, m] = ym.split("-").map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}`;
};

// the survey round of a fiscal data point: latestPeriod "2023-04" → "2023-24"
const roundOf = (bundle) => {
  const ym = String(bundle.meta.latestPeriod ?? "").match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    if (ym[2] === "04" || ym[2] === "03") return `${ym[1]}-${String(Number(ym[1]) + 1).slice(2)}`;
    return ym[1];
  }
  const lp = String(bundle.meta.latestPeriod ?? "");
  return /^\d{4}$/.test(lp) ? lp : (String(bundle.meta.vintage ?? "").match(/\d{4}-\d{2}(?= |\b)/) ?? [null])[0];
};

function stampValue(d, which) {
  const s = d.stamp ?? {};
  const style = which === "date" ? s.dateStyle : s.vintageStyle;
  const b = bundleOf(d.currentBundle);
  const rel = b.meta.releaseDate ?? b.meta.vintage;
  if (which === "date" && s.dateText) return s.dateText;
  if (which === "vintage" && s.vintageText) return s.vintageText;
  const label = (str) => (which === "date" ? monthYearFull(str) : (s.vintagePrefix ?? "Vintage ") + monthYearShort(str));
  switch (style) {
    case "release":
      return which === "date" ? monthYearFull(rel) : (s.vintagePrefix ?? "Vintage ") + dateShort(rel);
    case "month":
      return label(b.meta.latestPeriod);
    case "monthNext":
      return label(shiftMonth(String(b.meta.latestPeriod), 1));
    case "vintageMonth":
    case "vintage":
      return which === "date" ? monthYearFull(b.meta.vintage) : (s.vintagePrefix ?? "Vintage ") + dateShort(b.meta.vintage);
    case "retired":
      return (s.vintagePrefix ?? "Vintage ") + dateShort(bundleOf(s.retiredBundle).meta.vintage);
    case "round":
      return `Vintage ${roundOf(b)} round${s.plural ? "s" : ""}`;
    default:
      return "";
  }
}

export const dateStamp = (d) => stampValue(d, "date");
export const vintageLabel = (d) => stampValue(d, "vintage");
