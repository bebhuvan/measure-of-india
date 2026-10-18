# CONTRACT — rendering (pages, charts, client JS)

The site is build-time rendered: data is baked into JS modules at build,
charts are drawn once on load, nothing re-renders. This document is the
budget of what a page may do. `scripts/qc.mjs` enforces the mechanical
parts by executing every page's JS in jsdom.

## Number formatting

Every display format is defined once, in `src/charts/format.js` (re-exported
from `plumbing.js` as `fmt`). Clients render through it; `scripts/qc.mjs`
renders its expected strings through the same module — a formatter change
updates both sides, and hand-typed rendering in qc (the old shape) can no
longer false-fail or drift. Titleblock stamps and vintage labels are derived
the same way, from bundle meta, by `src/dossiers/display.js`; qc compares
every rendered page against the derivation, so a hand-typed stamp fails the
build.

## Pages and plates

0. **Dossier metadata lives in `src/dossiers/registry.js`** — title, kicker,
   crumb, blurb, vintage labels, bundles, current bundle, spark spec. Pages,
   homepage, register, RSS, 404, OG cards and both gates derive from it;
   never hardcode a dossier fact in a page.
1. **One dossier page = one client module** (`src/dossiers/<slug>.client.js`),
   imported by its `.astro` page. No globals, no cross-module state.
2. **Every numeric slot is an element with an id** that the module fills.
   Unfilled placeholders (`–`) fail QC.
3. **Every plate that shows data offers SVG / PNG / CSV download** via
   `wireTools()`. A download is a published artifact: title, source, brand
   are composed in by `composeCardSVG()` — never ship a bare plot.
4. **Charts are Observable Plot, each authored chart drawn once.** Heavy guides may cooperatively complete the full authored list in approximately 45 ms task batches through `queueCharts()`. Every registered job records its promise, total/completed count and errors in the per-document `__atlasChartJobs` list. Gates await all jobs with a bounded 120-second timeout and reject errors or incomplete work; browser QA waits for every expected chart. `beforeprint` drains pending work synchronously and idempotently. This scheduling never omits offscreen charts, fetches new data or uses IntersectionObserver. No redraw loops or resize listeners are introduced; rendering cost remains bounded by the authored plate list.

## Robustness floor (plumbing.js is normative)

- **Nulls render as gaps/`—`, never as 0 and never as NaN.** The default
  crosshair formatter, `peakOf`/`troughOf`/`dodgeEndLabels`/`spark` all skip
  unpublished points. Do not re-introduce index-based assumptions.
- **CSV downloads join by date key** (union of dates, sorted). Series with
  different start dates on one plate must never be index-joined.
- **No hardcoded series lengths, no magic indices** (`data[13]`) without a
  neighbouring assertion that fails loudly when the shape changes.
- **A missing element id or series key must not blank the page.** Guard with
  `?.`/filter, or let QC catch it — a plate that cannot render should say so,
  not eat the plates below it.
- **Ticks are strings.** `tickFormat` must return formatted strings (en-IN
  grouping, `%`, `₹`); QC greps for violations.
- **No smoothing.** No `curve*`, catmull, monotone, basis. Lines are straight
  between published points. QC greps for this.

## Accessibility floor

- Every plate gets `role="img"` + `aria-label` + `<title>` via `a11y()`.
- Sparklines and decorative marks are `aria-hidden`.
- Downloads and legend chips are real `<button>`s.
- Colour is never the only channel: label the line, not just the key.

## Budgets

- **Page JS (gzipped): ≤ 150 KB** above the shared Plot/plumbing chunk.
  Below-the-fold ledgers that blow the budget move to lazily fetched JSON —
  not more inlining.
- **HTML: a guide page stays well under 1 MB; a long-tail every-cut page under 1.2 MB**
  (qc fails both). The every-cut table on a guide inlines at most 600 rows. Long bundles, bundle
  families and the overflow go on `/guides/<slug>/every-cut/<id>/`, split at 5,000 rows.
  - **Each table renders its first 100 rows in HTML.** The rest of the page arrives in its pack,
    `/ec/<guide>/<view>/<page>.<hash>.gz`. The pack is gzip of the same row markup
    (`src/dossiers/everycut-html.js`, the one row template), streamed in after first paint in
    short batches. Then sort, filter and find-in-page cover every row.
  - On Save-Data or 2G, the pack waits for the reader to reach for the table.
  - qc counts the rows of the page and its pack together. `perf-browser` loads the three
    heaviest every-cut pages and fails on long tasks or a failed stream.
- **No runtime data fetching of published series from anywhere but the site's own static
  files.** Data rides in the bundle the page was built from, or in the content-named static files
  the build writes beside it: search shards, explorer shards and every-cut packs. The deployed
  site makes no request beyond its own static assets.
- **Structured data (JSON-LD) is metadata, not payload** (2026-10-17). `perf-budget` reports it as
  `ld`, apart from inline `json` data, with its own ceiling per page kind in `perf/budgets.json`
  (4 KB gzipped for guides and data-file pages, 2 KB for state profiles, 1 KB elsewhere). Its bytes
  still count inside the page's `html` ceiling. A guide's Dataset does not list its files; each
  file's Dataset, on `/data/<file>/`, names the guide's as the one it is part of.
- **No file in dist over 20 MB** (Cloudflare Workers static assets refuse any file over 25 MiB; qc fails at 20 MB).
- **Site search: a core of fixed size, everything per row fetched by need** (index v2, 2026-10-15).
  Static files the build writes under `/search/` (`scripts/search-index.mjs`, run by the build
  hook, packing through `src/dossiers/search-pack.js`). The engine is `src/dossiers/search-core.js`,
  shared by the home page, the explorer, qc and `scripts/perf-search.mjs`.
  - The core index is fetched when a reader is about to search, and is **≤ 150 KB gzipped**.
    It holds:
    - every guide, chart (title and finding), every-cut view and state profile;
    - the quality policies;
    - per bundle, only its guide and row count;
    - the first word of each token shard.

    Nothing in it is per row, so it grows with guides and charts, not with data.
  - These files are fetched only when a query needs them, **each ≤ 1 MB**:
    - token shards (row and bundle postings, about 32 KB);
    - row chunks (512 rows);
    - bundle records (64 per file);
    - quantity-group rows;
    - the vocabulary, fetched only to suggest a spelling.
  - **A cold query fetches ≤ 300 KB gzipped beyond the core.** `perf-search` measures every
    labelled query.
  - Every result links to a plate (`#<figure id>`), an every-cut row (`#s…`, everycut.js
    `rowAnchor`, stable across releases) or a bundle's download.
  - **The result order is `layout()`**, rendered by the home page and judged by `perf-search`
    against `perf/search-queries.json`. A query marked `known` there is a recorded miss. A new
    miss, or a known one that starts passing without its mark removed, fails the gate.

  qc fails a core over budget, any file over 1 MB, and any of a sample of series from every guide
  that its own label does not find, or whose link does not open on its row.
- Charts render at their intrinsic width; containers may scale via CSS
  (`width:100%` on the svg) but plot geometry is computed once.

## When you touch plumbing

`src/charts/plumbing.js` changes affect every page. After any change:
`npx astro build && npm run qc` — both must pass before the change is real.

## Indicator explorer exception (owner-authorized, 13 October 2026)

Static guides and EveryCut tables retain their existing publication contract.
The supplemental `/explore/` view may lazily fetch **first-party published static
series shards**. It never requests an agency API. This narrowly overrides the
no-runtime-published-series rule for the explorer alone. No database, paid data
service or per-record server rendering is introduced.

Identity v1 is `<canonical bundle>:<stable EveryCut row anchor>`. Bundle identity
includes the instrument/base/methodology; canonical series keys encode declared
cuts. A new ruler needs a new bundle. Values, title and row order are not identity
inputs. The packer fails on anchor collisions; retired/unavailable series are
reported rather than silently replaced. Search offsets remain release-local.

Bundle manifests are packed into deterministic SHA-256-prefix buckets (256 possible files), revalidated once and pinned for the page session. Each manifest names SHA-256-content-addressed chunks. Tiny chunks (at most 64 KiB) may share a bounded container, with records isolated by canonical instrument.
Each exact selected-series read transfers one manifest bucket (maximum 1 MiB) and one
chunk (maximum 256 KiB). The browser verifies the chunk hash/schema/bundle and
axis length before displaying it. Missing files, mixed versions and invalid IDs
fail with a readable retry/refresh message. Abort navigation and epoch checks
prevent stale results from replacing a newer selection. Immutable shard cache
holds at most eight chunks; manifest cache holds at most eight buckets; manifests must not resolve a shard from another
release. Manifests and HTML revalidate; hashed chunks may cache immutably.

The view may redraw on explicit selection/date changes. It preserves every
published observation and null, with a paginated underlying table and exact
selected-range CSV/JSON. One-period estimates render as snapshots. Up to four
compatible series share one unit axis, differentiated by line style and labelled
legend. Comparisons use a sorted union of published date keys with explicit nulls;
there is no interpolation, frequency aggregation, unit conversion, base-year
splicing or synthesized cross-tab. Same unit alone is insufficient: an audited
comparison signature must match (same-instrument CPI inflation components, or
explicit observed state/sector cuts with every other dimension fixed).

The shared addressable route serves the complete eligible catalogue without
millions of HTML files. A few reviewed static landing pages carry crawlable values
and a no-JS table; long-tail query addresses require JavaScript and point back to
static guide/EveryCut context. Their canonical is the common explorer entrance.
`test/explore-model.test.mjs`, `scripts/explore-audit.mjs`,
`scripts/explore-verify.mjs` and the integrated gates enforce this exception.

The final integrated artifact must contain at most `perf/budgets.json` `deploy.maxFiles` files (90,000, leaving headroom under the 100,000 that Workers Paid static assets allow; `docs/RUNBOOK-workers-cutover.md`). Full post-build verification checks every series value/field, date axis, instrument metadata, identity and chunk hash against canonical source files; it fails on omissions, duplicates or budgets. Related cuts are fetched only on request, keeping initial exact-series lookup to two data requests.

Search index files are named with one release hash (core `rel`), so they cache immutably and an
open tab can never read the next release's reordered rows: a missing name is a recoverable error,
never mixed data. Numeric posting offsets are release-local. Identity interface v1 exposes both
`explorerHref` and `guideHref`, derived from bundle and anchor. Token, row and bundle caches are
bounded (24/48/32 files). Independent reads overlap, failed promises are evicted, and
cancellation is checked before fetching rows and during large scans. Typo suggestions require
one unambiguous edit and do not silently alter valid cuts. Guide charts all complete through the shared explicit readiness lifecycle; scheduling is cooperative rather than viewport-dependent.


### Source quality and publication eligibility

All canonical identities and original fields remain represented, including records
whose interpretation is withheld. Numerical parity is not a semantic certificate.
`data/source-quality.json` and `src/explore/source-quality.js` are the authoritative,
version-hashed review policy shared by explorer and search. Specific archived
mislabel/unit evidence, unreviewed generic-mapper provenance and missing/mixed or
unestablished units/scales can withhold numeric interpretation. A percentage above
100 is not itself a reason to quarantine a growth rate or development ratio.

Pending records get a neutral review title, precise reason, stable shareable address,
official source access and explicitly unvalidated canonical-record inspection.
Numeric charts, latest-value readouts, comparisons and interpreted CSV/JSON/image
exports are disabled. Search indexes original source labels for discovery while
showing neutral review labels and suppressing numbers/sparklines. Optional search
v1 fields include core `quality` definitions, per-bundle policies and run-encoded
sparse row overrides; blocked quick-file results open a source-record review view.

Reviewed opt-ins must be scoped to named records or genuinely homogeneous audited
bundles, with source/report references, source/evidence versions, reviewer rationale,
unit/population/reference-period evidence and raw/canonical drift bindings. An
unexpected measure, unit, label, geography, data, axis or instrument/schema change
invalidates the review. Timestamp provenance annotations do not constitute a new
measurement. Source API revision dates remain unknown when unpublished; archive
capture and report edition stay separate. Public interpreted JSON preserves raw
`canonicalMeta` separately from corrected public `meta` and `sourceQuality`.

New explorer/home pages carry the compiled quality-policy version. Manifest/core
version or missing-policy mismatches fail closed with a refresh message; they may
never default to an interpretable numeric view. Post-build verification checks every
record's policy and ensures pending records cannot advertise comparison links.

Numeric axis abbreviations are presentation only: k, m, bn and tn mean thousand,
million, billion and trillion source units; very small/large ticks may use scientific
notation. Coordinate values, units, nulls and downloads are unchanged. Numeric
geometry fixtures sample the full catalogue's unit/magnitude/sign/zero extremes.
Survey axis dates remain anchors with explicit reference-period labels; matched
single-observation comparisons require the same reference period.


## Governed source-quality presentation

A guide may opt into `sourceQualityMode: "required"` in the registry. The only
supported supplied value is `required`; omission retains existing reader behavior.
EveryCut resolves the authoritative source-quality policy for every exact record.
An uncovered default policy is a build error for an opted-in guide, preventing new
records from inheriting global numeric eligibility. Pending or stale bindings retain
source identities, labels, reference periods and source access, with no numeric
latest/change, sorting values or spark. Reviewed rows display their primary definition
and reference basis. This flag supplies no interpretation grant and changes no
canonical dates, numbers, identities or raw files. Guide charts, client payloads,
facts and headline consumers must independently resolve the same policy; a row/table
review cannot authorize an unreviewed plate or cross-record comparison. Fully expected
schedules need the separately reviewed expected-schedule class and reader labels;
this source-quality patch alone cannot authorize them.

Required-governance bundle downloads carry explicit scope. Reviewed-column CSVs
include only eligible exact source columns, with source period, policy version,
reviewed/pending/source-only counts, a complete policy-manifest link and the original
workbook link. The date column is the canonical date key; reference_period and
record policy preserve the source label and statistical endpoint. A joint
source-column table grants no comparison capability. Selected
multi-record CSV/JSON remains subject to the existing comparison restriction.
A fully pending bundle returns a named, metadata-only review-status CSV enumerating
every record and its source access; it contains no observation date, value or unit
columns. This response is labelled Review status CSV in every download view.

The direct JSON route is labelled ARCHIVAL, with a versioned whole/record policy
overlay. Its original meta, series, dates and other canonical fields remain exact;
unreviewed values and units are explicitly unvalidated. Selected interpreted JSON
continues to reject pending records. Every pending and held source record has exact
original-workbook access. The full source ledger reconciles interpreted, pending
and source-only records and includes metadata source workbooks. QC verifies actual
CSV/JSON/native-download bytes and reader labels, not link presence alone.

Pension interpretation additionally requires the pinned supporting-source contract
in `data/coverage/pensions-source-policy-evidence-contract.json`. The production
validator and source-quality resolver enforce the exact approved rule definitions,
record scope, final pending catchall, original workbook hashes, catalogue archive and
body hashes, explicit catalogue unit contexts, and edition-specific handbook hash.
Missing or changed evidence fails before packaging or rendering. Registered or
canonical pension data cannot bypass the gate by removing its policies. Expected
schedule proof remains separate; handbook edition dates never supply current
workbook association or forecast dates. The guard itself participates in the
quality version, invalidating older explorer/search certificates when it changes.

### Literal-source EveryCut changes

A guide may set `everyCutChangeMode: "none"` when its admission covers source observations without derived changes. The only explicit mode is `none`; omission preserves legacy computation. Unknown values fail before row or plan caches are consulted. The owning registry applies the mode to direct row consumers, including profiles, search and downloads. Cache keys include the resolved mode. Suppression retains approved source endpoints, units, periods and single-record histories, while every computed change is null, its readout is an em dash and its estimate flag is false. Required source-quality, expected and pending rules remain independent. The reader states “Derived changes are not supplied.” This does not alter the separate cross-record `canCompare` policy.
