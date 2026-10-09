# framework: status

Session: atlas-framework, branch `lb/framework`, port 4411. Brief: `docs/briefs/framework.md`.

## Done

- **F6 every-cut table** (2026-10-09). On all 14 guides, just before "Data and downloads".
  Lists every series of every bundle in the guide's registry entry: label, cut, latest
  with period, change on a year earlier, sparkline, CSV link. Sort by series, cut, latest,
  change; filter by cut, by data file, and by free text. Shows 25 rows, then "Show all".
  Bundles over 150 series get their own page (`/guides/<slug>/every-cut/<bundle>/`), split
  at 1,000 rows with groups kept whole. qc checks the row counts equal the bundles'
  series counts (CPI 629, WPI 1,994, factories 892 ...). Looked at 1440 and 390.

- **F4 seams on charts** (2026-10-09). `seamMarks(treatment, rulers, marker)` and
  `seamOverlap(a, b)` in `src/charts/plumbing.js`: "side", "overlap", "agency", nothing
  else; it throws on one ruler, on an agency link whose label names no agency, or on a
  back-cast stretch outside an agency seam. Moved onto it: CPI §02 (agency: NSO back-cast,
  now a solid pale tint instead of 55% opacity, per DESIGN), CPI-AL (side), WPI §02
  (overlap), IIP two bases (side), GDP §11 three rulers (side, no marker: they never
  meet; legend now says "NSO back series"). Facts sheets carry `ruler` on every series,
  every proseInputs summary and the CPI legacy block (bundle, base, product, seam window,
  agency link) from `sources.yml seams:`. verify.mjs skips `ruler` keys and no longer
  lets the digits of a base string ("2022-23=100") trace a figure; every existing prose
  file still verifies.

## Next

F5 IDH cross-check, ledgers for 13 guides.

## Note for family sessions: adding the every-cut table

1. In your guide page: `import EveryCut from "../../components/EveryCut.astro";` and put
   `<EveryCut slug="<slug>" />` on the line before `<GuideData slug="<slug>" />`.
2. It reads your registry entry's `currentBundle` and `bundles`: every bundle the guide
   uses must be listed there, or its series will not appear.
3. Units: each series needs a unit the table knows (`UNITS` in `src/dossiers/everycut.js`).
   It reads `series.unit`, then the series name (`..._yoy_pct`, `..._pct`, `..._inr`,
   `..._usd_millions`, `..._index...`), then `meta.unit`. An unknown unit fails the build
   with the series named. Prefer setting `series.unit` in your adapter; if you need a new
   unit, add it to `UNITS` in one block marked with your slug.
4. Cuts: the cut column comes from `CUT_BY_BUNDLE`, then the bundle slug (`-states`,
   `-items`, `-partners`, `-hs2` ...). Add your bundles to `CUT_BY_BUNDLE` in one block
   marked with your slug, or pass `cuts={{ "<bundle>": "Partner" }}` to the component.
   A series' `group` (or `division`, `lineage`) becomes the group filter on long-tail pages:
   set it for long tails (HS chapter for HS lines, division for items).
5. Survey rounds dated by one year: add a `PERIOD_LABELS` entry.
6. Run `npx astro build && npm run qc`: qc fails if the table misses a series or a
   long-tail page exceeds 1.2 MB.

## Proposed doc edits (for the coordinator)

- `docs/CONTRACT-dossier-structure.md`: new "End matter" section naming the every-cut table
  (edited on this branch).
- `docs/CONTRACT-render.md`: HTML budget line for guide and long-tail pages (edited).

## Decisions

- Change on a year earlier: points for rates and shares, per cent for levels, plain
  difference for ratios and coefficients; a dash when there is no same-period value a year
  earlier, when the frequency is not monthly, quarterly or annual (survey rounds, decades),
  or when a level's previous value is zero or negative (a per cent change of a flow that
  changes sign means nothing).
- Sparklines follow DESIGN §5: y-domain from min(0, min) to max; gaps break the line.
- The guide's "On this page" list now includes "Every series, every cut"
  (`src/dossiers/guide.client.js`, one selector added).

## Data quirks found (other owners)

- `nfhs-child` (nfhs): mortality rates labelled "(per 1000 live births)" carry
  `unit: percent`. The table trusts the label; the bundle should say `per_1000`.
- `cpialrl-states-2019` is baked but not in the cpi registry `bundles`, so no page shows it.
- Several state labels are lower case from the source (`plfs-states`, `cpi-states`:
  "andaman nicobar islands", "West bengal").
