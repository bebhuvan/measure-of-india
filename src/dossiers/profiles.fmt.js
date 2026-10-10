// src/dossiers/profiles.fmt.js: the number formats of the state profiles. Pure, no imports
// beyond the site's formatter, so the page (build time), the charts (browser) and qc all
// render through the same functions.
import * as F from "../charts/format.js";
const MINUS = "−";
const g = (v) => F.inr(v);
const neg = (s, v) => (v < 0 ? MINUS + s.replace(/^-/, "") : s);
export const FMT = {
  num2: (v) => v.toFixed(2),
  round: (v) => String(Math.round(v)),
  inr: (v) => F.inrR(v),
  inrDay: (v) => F.inrR(v) + " a day",
  pct1: (v) => neg(Math.abs(v).toFixed(1) + "%", v),
  pct2: (v) => neg(Math.abs(v).toFixed(2) + "%", v),
  lakhcrFromCrore: (v) => (v >= 1e5 ? "₹" + (v / 1e5).toFixed(2) + " lakh crore" : "₹" + g(v) + " crore"),
  lakhcr: (v) => (v >= 1 ? "₹" + v.toFixed(2) + " lakh crore" : "₹" + g(v * 1e5) + " crore"),
  croreFromLakh: (v) => "₹" + g(v / 100) + " crore",
  count: (v) => g(v),
  mw: (v) => g(v) + " MW",
  kwh: (v) => g(v) + " kWh",
  lakhTonnesFromThousand: (v) => (v >= 1e4 ? g(v / 100) : (v / 100).toFixed(1)) + " lakh tonnes",
  kgha: (v) => g(v) + " kg a hectare",
  per1000: (v) => g(v) + " per 1,000",
  years: (v) => v.toFixed(1) + " years",
  births: (v) => v.toFixed(1),
  degC: (v) => neg(Math.abs(v).toFixed(1) + "°C", v),
  degCdiff: (v) => (v < 0 ? MINUS : "+") + Math.abs(v).toFixed(1) + "°C",
  mm: (v) => g(v) + " mm",
  days: (v) => g(v) + (Math.round(v) === 1 ? " day" : " days"),
  ratio: (v) => g(v),
  gini: (v) => v.toFixed(3),
  daysPlus: (v) => (v < 0 ? MINUS : "+") + g(Math.abs(v)) + (Math.round(Math.abs(v)) === 1 ? " day" : " days"),
  pct2pa: (v) => v.toFixed(2) + "% a year",
  usd: (v) => (v >= 1e9 ? "US$" + (v / 1e9).toFixed(2) + " billion" : "US$" + g(v / 1e6) + " million"),
  score: (v) => g(v) + " out of 100",
  ptr: (v) => g(v) + " pupils for each teacher",
};
