# RUNBOOK — adding a data source

One source product = one adapter = one registry entry = one bundle set.
Follow this exactly; the order is load-bearing. Estimated time for a simple
JSON API: an hour. For a CSV dump with Indian-format cells: two.

## 0. What you need first

- The source's actual API or file URL, and its rate-limit etiquette.
- Which dossier(s) the data serves (or a new dossier — that's a bigger
  conversation, stop here and plan it).
- The release cadence and the base-year / methodology seams. If the source
  ever changed rulers, you are shipping MULTIPLE bundles (CONTRACT-series §3).

## 1. Register it — `data/sources.yml`

Add the entry: `family`, `geo` (ISO3), cadence, release-day rule, base years,
plausibility ranges, seams. The family must exist under `families:` — if it
doesn't, you're adding a family, not just a source: write the
`scripts/lib/<family>.mjs` host wrapper first (model it on `mospi.mjs` /
`worldbank.mjs`). Validators read this file; hardcoding ranges in an adapter
is how allowlists rot.

If the source feeds a NEW dossier (not an existing one), the dossier entry in
`src/dossiers/registry.js` comes first — homepage, register, RSS, 404, OG
cards and both post-build gates derive from it. Set its `calendar`
(`fiscal-apr` | `calendar`), `bands` (only where a policy band exists in
law), and `proseConstants` (the structural numbers its prose may cite).

## 2. Write the adapter — `scripts/lib/products/<name>.mjs`

Export `async function build<Name>(ROOT, dcfg, VINTAGE)` and register it in
`scripts/fetch.mjs`'s `REGISTRY` under the product key.

- **Network:** use the family client (`scripts/lib/mospi.mjs`,
  `scripts/lib/worldbank.mjs`), which sits on `scripts/lib/net.mjs`
  (`getJson`/`getText`). net.mjs owns deadlines, size caps, retries, throttle
  classification. Never `fetch()`/`https.get` directly in an adapter.
- **Tabular parsing:** use `scripts/lib/tabular.mjs` — `sniffDelimiter`,
  `parseCsv`, `findHeader`, `parseNumber` (Indian grouping, `(123)`
  negatives, NA conventions → null), `parseDate` (ISO, `Apr-2026`,
  DD-MM-YYYY), `toBundle` (parallel-array assembly with nulls). Never write
  your own; every homegrown parser is a future corruption.
- **Address rows by content, not position.** Find rows by label/industry
  code/period match; row order is not a contract. If a mapping is
  unrecognized, `console.warn` and skip — never guess.
- **Anchor assertion (mandatory).** The adapter must fail loudly when the
  source serves nothing: an expected series with a known value range
  ("no data returned: <anchor>"). A 200-OK-but-empty response must never
  bake. Every existing adapter has one; copy the pattern.
- **Archive then canonicalize.** `writeRaw()` the archival dump FIRST (it is
  the audit trail), then `writeSeries()` the canonical bundles. Never edit
  `data/raw/` by hand.
- **Disclosure lives on the series.** Missing data is `null`; an interior
  null is disclosed in that series' `gaps` (+ `gapsNote` for the
  non-obvious why); an interpolated/imputed value stays in `data` but its
  date is listed in that series' `estimated`. Never assemble a bundle-level
  `meta.gaps` union — it is retired (CONTRACT-series rule 2) and validate
  rejects it. If an adapter still emits the legacy shape, `writeSeries`
  migrates it onto the series mechanically — that is a safety net, not a
  licence; write per-series disclosure directly.

## 3. Validate — `scripts/validate.mjs`

Add checks that would catch the failure modes you can imagine for THIS
source: cadence monotonic, ranges from sources.yml, weights sum to 100,
computed-vs-published crosschecks, seam cleanliness. A source with no
source-specific identity check is not done.

## 4. Render — page + client module

- Bundle(s) imported by the dossier's `.client.js`; hydrate via
  `src/charts/plumbing.js`. Follow CONTRACT-render (a11y, downloads,
  null-safety, no magic indices).
- Add number checks to the dossier's `PAGES` entry in `scripts/qc.mjs`: the
  rendered title block must equal the bundle's latest value. qc refuses to
  run for a registry dossier with no PAGES entry — a new dossier cannot ship
  unverified. Unverified rendered numbers are how errors ship.

## 5. Prose (if the dossier has dated slots)

- `pipeline/slots.yml`: add/extend slots with `requiredFigures`; the
  `current-reading.what-the-print-says` slot carries the coverage floors
  (`minSeriesMentioned`, `mustName: [extremes]`, `mustAcknowledge:
  [contradictions]`).
- `pipeline/facts.mjs`: reads the CURRENT bundle from the registry's
  `currentBundle` (prose describes the current ruler, not a retired one) and
  labels periods per the registry's `calendar`. Declare the sibling bundles
  the writer must see as the registry's `proseInputs`. Ensure the facts
  sheet exposes the figures the slots require.
- Hand-written "As of" paragraphs on the page are governed: each `.now`
  block needs a `pipeline/asof-manifest.json` entry, and the gate runs in
  CI (`pipeline/asof.mjs`; `docs/RELEASE-CHECKLIST.md` §1b).
- Run `npm run prose:dry` and read the prompt. If the facts sheet can't
  support the brief, fix the facts sheet, not the prompt.

## 6. International sources (World Bank, OWID, …)

Same pipeline, three extra decisions, all made in config — never in prose:

1. **Family.** WB products use `family: worldbank` and the
   `scripts/lib/worldbank.mjs` client (WB API v2 envelope). OWID needs a CSV
   path — `net.mjs getText` + `tabular.mjs` — behind a new `owid` family
   wrapper when the first OWID product lands.
2. **Geography.** `geo:` is the ISO3 code on the sources.yml entry and in
   every bundle's `meta.geo` (validate checks they agree). One bundle, one
   geography; comparisons are separate bundles (CONTRACT-series §8).
3. **Calendar.** Registry `calendar: "calendar"`: bare-year annual labels,
   Jan–Mar Q1. Prose, verification and the freshness gate all follow it.
   Irregular OWID updates set `release_calendar: "irregular"` and ride the
   weekly cron; `meta.vintage` still means data vintage, never fetch date.

## 7. Prove it

```
node scripts/fetch.mjs only <name>   # (or full npm run data if dependencies shared)
node scripts/validate.mjs
npx astro build && npm run qc
```

All green, then have someone else re-run the release checklist on your diff.
If you touched anything render-side, `npm run gates` is the minimum.

## Anti-patterns (each of these has shipped a bug somewhere)

- Splicing two base years into one series "for continuity".
- Encoding missing as 0 because "it's basically zero".
- Trusting row order because "the file has always looked like that".
- A range check copied from another source's numbers.
- A new bundle that QC doesn't load (rendered numbers unverified).
- Stamping `meta.vintage` with today's date on unchanged data.
