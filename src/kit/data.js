// src/kit/data.js: canonical bundles (docs/CONTRACT-series.md) as the kit's [date, value] pairs.
// Rates are rounded once, at the precision the agency publishes (src/dossiers/precision.js),
// so a chart's labels and the page's prose show the same figure.
import { roundRates } from "../dossiers/precision.js";

const cache = new WeakMap();
const rounded = (b) => { let r = cache.get(b); if (!r) cache.set(b, (r = roundRates(b))); return r; };

/** [[date, value]] for one series; nulls kept, so a missing month is a gap, never a zero. */
export function pairs(bundle, key, { from = null, to = null, round = true } = {}) {
  const b = round ? rounded(bundle) : bundle, s = b.series[key];
  if (!s) throw new Error(`no series "${key}" in bundle ${bundle.meta?.dossier ?? ""}`);
  const out = b.dates.map((d, i) => [d, s.data[i] ?? null]);
  return out.filter(([d]) => (!from || d >= from) && (!to || d <= to));
}
/** The latest non-null [date, value]. */
export const last = (P) => { for (let i = P.length - 1; i >= 0; i--) if (P[i][1] != null) return P[i]; return null; };
export const first = (P) => P.find((p) => p[1] != null) ?? null;
const MLONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MSHORT = MLONG.map((m) => m.slice(0, 3));
export const monthLong = (d) => `${MLONG[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
export const monthShort = (d) => `${MSHORT[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
