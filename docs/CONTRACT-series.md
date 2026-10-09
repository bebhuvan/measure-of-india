# CONTRACT — canonical series bundles (`data/series/*.json`)

Every data series served to a page lives in exactly one canonical bundle.
This file is the shape. `scripts/validate.mjs` enforces parts of it
mechanically; the rest is review discipline. If code and this document
disagree, file a bug — one of them is wrong.

## Bundle shape

```json
{
  "meta": {
    "source": "MoSPI / RBI / NSO …",
    "product": "which source product, exactly",
    "base": "2012=100 | 2024=100 | null",
    "frequency": "monthly | quarterly | annual | irregular",
    "unit": "pct_yoy | index | inr_lakh | count | …",
    "vintage": "YYYY-MM-DD  — the date the DATA changed, not the fetch date",
    "geo": "ISO3 country/economy code of the series' coverage",
    "latestPeriod": "human label of the last published period",
    "releaseDate": "YYYY-MM-DD of the source's press release, when knowable",
    "note": "disclosed quirks: quarantines, reconstructions, imputations"
  },
  "dates": ["2026-01-01", "2026-02-01"],
  "series": {
    "snake_case_key": {
      "name": "CSV column header",
      "label": "human display label",
      "color": "#RRGGBB (page palette, assigned at bake time)",
      "data": [1.2, null],
      "gaps": ["2026-02-01 — interior null dates OF THIS SERIES, disclosed where the data lives"],
      "gapsNote": "why this series misses those dates, when the reason is not obvious",
      "estimated": ["2019-01-01 — interior dates OF THIS SERIES whose value is an estimator's (interpolation, imputation), never a collected figure"]
    }
  }
}
```

## Rules

1. **`dates` is the shared axis.** ISO `YYYY-MM-DD`, ascending, unique. Every
   series' `data` array parallels it exactly — same length, index-aligned.
2. **Missing is `null`, never 0.** An unpublished value is `null`; a true zero
   is `0`. Interior nulls must be listed in the `gaps` of the very series
   that misses them (validate fails otherwise) — a bundle-level `meta.gaps`
   union is retired, because it cannot say which series actually misses
   which date. Trailing nulls are forbidden — the axis ends at the last
   published period of the bundle as a whole.
2b. **Estimated points are disclosed where they live.** A value produced by
   an estimator (linear interpolation, imputation) is data — it stays in
   `data`, never becomes `null` — but its date must be listed in that
   series' `estimated`. validate checks each estimated date: on the axis,
   non-null, never also a gap, and either interior to the series' own span
   (an interpolation) or part of one unbroken run of estimates that ends the
   series (an agency's extrapolation of its latest periods, such as BIS's
   India credit after the last financial-accounts quarter). Say how the
   estimate was made in the series' `estimatedNote`.
3. **One bundle, one instrument.** A base-year change, methodology revision,
   or coverage break starts a NEW bundle (`cpi.json` → `cpi-2024.json`).
   Never splice. Pages may show both, labelled as different rulers. Every base
   of a product that has changed ruler is registered in `data/sources.yml`
   `seams:` (window, bundles, and an agency `bridge` only where the agency
   publishes one); validate.mjs fails an unregistered bundle or one outside its
   base's window.
4. **`meta.vintage` is data vintage.** Adapters must not stamp the fetch date
   unless the body actually changed (see `writeRaw`'s comparison semantics in
   `scripts/lib/util.mjs`).
5. **Derived series are labelled.** Anything computed (y/y, shares, sums)
   carries its formula in `meta.note` or the series `label`.
6. **Numbers are JSON numbers.** Indian digit grouping belongs to renderers,
   never to stored values.
7. **Writes are atomic.** Series files are written via rename-after-write —
   `writeSeries` in `scripts/lib/util.mjs` writes to `<file>.tmp` and then
   `renameSync`s it into place — never in-place truncation.
8. **One bundle, one geography.** A multi-country comparison is a separate
   bundle per country — different geographies are different rulers, exactly
   like base years (rule 3). `meta.geo` is the ISO3 code; validate.mjs checks
   it against the dossier's `geo` in `data/sources.yml`.

## Producers and consumers

- Producers: `scripts/lib/products/*.mjs` (one adapter per source product).
- Consumers: `src/**/*.client.js` (via `hydrate()` in `src/charts/plumbing.js`),
  `pipeline/facts.mjs`, `scripts/qc.mjs`, `src/pages/rss.xml.js`.
- QC loads bundles lazily by slug and fails cleanly on a missing file; its
  dossier-page coverage is guarded against `src/dossiers/registry.js` — a
  dossier cannot ship with unverified rendered numbers.
