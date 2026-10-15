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
    "vintage": "YYYY-MM-DD — data vintage, or null under the declared-unknown contract below",
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
   published period of the bundle as a whole, except for the independently
   proved source-unpublished snapshot class in rule 2c.
2b. **Estimated points are disclosed where they live.** A value produced by
   an estimator (linear interpolation, imputation) is data — it stays in
   `data`, never becomes `null` — but its date must be listed in that
   series' `estimated`. validate checks each estimated date: on the axis,
   non-null, never also a gap, and either interior to the series' own span
   (an interpolation) or part of one unbroken run of estimates that ends the
   series (an agency's extrapolation of its latest periods, such as BIS's
   India credit after the last financial-accounts quarter). Say how the
   estimate was made in the series' `estimatedNote`.
2c. **Source-unpublished survey cells are a narrow snapshot class.** A
   cross-sectional bundle with exactly one source period may retain a series
   containing exactly one null only when the original archived source prints
   an exact dash for that exact observed cut. This is not an all-null history,
   an estimate, a zero or a claim that the denominator is zero. The series
   declares `unavailable.kind: "source-unpublished"` and its exact source record
   key/marker; the bundle shares the portable archival file, stored-body hash,
   instrument, context, sole period and plain reason. An independent raw/report
   replay must bind every declaration, unit and full measure label to the
   original source cell. Canonical flags alone never authorize this exception.
   Missing proof, altered source/provenance, alternate blank/null markers,
   mismatched rulers, multiple periods and all-null histories fail. Numeric
   observations remain subject to ordinary range checks. Qualified records stay
   discoverable with their known period and reason, a null/em dash and no
   calculated change; downloads retain the same identity and source marker.
   This exception requires explicit reviewed source-contract wiring and never
   applies automatically to other missing cells or statistical families.
2d. **A fully expected source schedule is separate from observed estimates.**
   Optional `meta.observationKind: "expected-schedule"` declares a source-bound
   administrative schedule, never realised events or an observed current stock.
   `series.expected` lists every and only non-null source date; `expectedNote`
   gives the source method. Unknown forecast as-of is `forecastAsOfDate: null`
   and `forecastAsOfStatus: "unknown"`, never a capture date or a date borrowed
   from another edition. A pinned independently reviewed descriptor and original
   source replay must prove title, method, unit, population, ruler, exact dates,
   cells and values, with private process-branded proofs plus exact canonical
   record fingerprints. Flags or copied proof JSON cannot authorize this class.
   All-null records receive no exception. Expected dates cannot also be observed
   estimate dates. Rule2b and its first-point rejection remain unchanged for
   ordinary estimates. Consumers label every expected observation, retain the
   entire source schedule, and withhold observed latest, YoY, realised-exit
   headlines and current state-profile claims. CSV/JSON preserve exact dates,
   values and nulls with explicit expected flags; legacy exports are unchanged.
   Source headings and actual table windows that disagree remain disclosed.
2e. **A series with no figure is not a series.** A source cell with no value
   (a blank, an "X", a quarantined or withheld cell) is kept out of the bundle:
   the adapter splits it off with `splitEmptySeries` (`scripts/lib/util.mjs`) and
   records it in its catalogue as withheld, with the reason, so coverage still
   accounts for every cell the source lists. `writeSeries` refuses an all-null
   series (other than a rule-2c declaration) and a bundle with no series.
2f. **Every series sits inside the envelope of its unit.** `scripts/lib/unit-envelope.mjs`
   gives every stored unit its plausible range, from what the unit means: a share
   stays within 0-100, a rate per 1,000 within plus or minus 1,000, a published
   percentage within -100 to 1,000. validate.mjs applies it to every series of
   every bundle, after the family checks, and gives any bundle no family
   range-checked the null rule as well. A family may be stricter, never looser;
   a unit missing from the table fails. A value outside its envelope is a
   mislabelled unit or a source defect: fix the adapter's unit, or keep the
   cell out with its reason (rule 2e), never widen the envelope to pass it.
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

## Exact source-date display

Optional `meta.periodLabelMode: "source-date"` declares that an ISO axis key is
an exact source reference or valuation date. EveryCut formats it as `8 Oct 2026`
(including January's day) before legacy calendar heuristics or single-period
labels. Omitted mode retains existing calendar labels. Any other supplied value,
including null, is invalid. Source-date axes must contain real ISO calendar dates;
CSV date columns and JSON dates remain the original ISO keys; CSV reference-period
labels retain the same full source day. This flag
changes display only: it grants no observed status, freshness, comparability,
territorial scope or permission to interpret a record.

## Producers and consumers

- Producers: `scripts/lib/products/*.mjs` (one adapter per source product).
- Consumers: `src/**/*.client.js` (via `hydrate()` in `src/charts/plumbing.js`),
  `pipeline/facts.mjs`, `scripts/qc.mjs`, `src/pages/rss.xml.js`.
- QC loads bundles lazily by slug and fails cleanly on a missing file; its
  dossier-page coverage is guarded against `src/dossiers/registry.js` — a
  dossier cannot ship with unverified rendered numbers.

### Explicitly unpublished revision dates

A source without a published data revision timestamp must not borrow its archive
capture date or a report publication date as `meta.vintage`. In this case only,
use `vintage: null`, `vintageStatus: "unknown"` and a substantive `vintageNote`
explaining the unavailable source date. Missing or undeclared null vintages
remain errors. Dated vintages must remain real, nonfuture ISO dates.

Keep `archiveCapturedDate`, `reportEditionDate` and `apiRevisionDate` as separate
provenance fields when known; a missing revision date stays null. A dated report
edition can retain its publication date with `vintageBasis: "report-edition"`;
that does not establish a revision date for a separately served API. Shared
validation and display use `scripts/lib/vintage.mjs`. Mixed families must expose
unknown revisions rather than silently selecting the newest known date. Guide
headers can derive an explicitly labelled edition stamp from `reportEditionDate`.
