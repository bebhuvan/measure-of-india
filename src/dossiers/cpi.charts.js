// CPI guide: the plates, drawn at build time with the chart kit (src/kit/). Each export returns
// a bare figure for a plate's .plotzone; the plate's title, source line and buttons stay in
// src/pages/guides/cpi.astro. Rates come rounded to the published precision (src/kit/data.js).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import linked24 from "../../data/series/cpi-2024-linked.json";
import base12 from "../../data/series/cpi.json";

const PCT = { suffix: "%" };

/** §02: the continuous 2024-base headline (NSO back-cast, then live), the retired 2012 ruler faint. */
export function nb() {
  const linked = pairs(linked24, "headline", { from: "2014-01-01" });
  const old = pairs(base12, "headline", { from: "2014-01-01" });
  return figure({
    bare: true, file: "india-atlas_cpi2024_linked-headline_2014-2026",
    label: "Headline CPI as one continuous series on the 2024 base, the NSO's back-cast drawn lighter before January 2025, beside the retired 2012 base",
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Base 2012, retired", short: "2012 base", data: old, role: "ctx2", label: false },
        { name: "Base 2024", short: "2024 base", data: linked, role: "lead", recon: "2024-12-01" },
      ],
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
      refs: [{ y: 4, label: "Target 4%" }],
      seam: { t: "2025-01-01", before: "NSO back-cast", after: "Live prices" },
    }),
  });
}
