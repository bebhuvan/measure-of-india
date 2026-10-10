# industry: status

Session atlas-industry, branch `lb/industry`, port 4423. Brief: `docs/briefs/industry.md` (wave 2).
Guides `iip` and `factories`; ledgers `iip`, `isp`, `core`, `iip-dbie`, `asi`, `asuse`.

## State: done (2026-10-10)

Nothing pending in my ledgers (`coverage --strict`: asi 59,121 items, asuse 2,275, iip 266,
isp 38, core 52, iip-dbie 161, all decided). `npx astro build`, `npm run gates`, `npm test`
(41/41), `npm run prose:dry` green after the second launch-build merge (1bf0f5e). Both pages
looked at 1440 and 390; every new chart read; one share PNG downloaded (factories, state x
division mix: title, chart, source, brand all present).

## What is built

**IIP guide**
- Financial years, every MoSPI base: `iip-annual-2022/2011/2004/1993` (levels and published
  growth as served). Each annual General index equals the mean of its twelve monthly levels.
- Base 1980-81, which MoSPI's API does not serve, from the RBI's copy (DBIE 638, 219):
  `iip-1980` (General and sectors, y/y 1982-1998), `iip-industries-1980` (17 groups to 1994),
  `iip-annual-1980`. A fifth seam.
- Eight core industries (DBIE 499, 989), three bases: `core-1993`, `core-2004`, `core-2011`.
- Plates: §03 deep ledger now three retired rulers; §04 financial years on five rulers; §07 the
  core eight (latest year by industry with weights; composite on three rulers against the IIP).
  Misreading on the core; provenance rewritten. Prose regenerated and read.
- ISP annual: the services guide's `services-isp-annual` (same call); listed in iip downloads.

**Factories guide**
- ASI, every indicator of every NIC block at every grain served: `asi[-<block>]-nic2/3/4`,
  `asi-states-all`, `asi-<block>-states`, `asi-<block>-accounts`, NIC 2008 states by division
  as `asi-state-nic2-<state>` (37 files). Archive tier, staged in `data/archive/staging/asi/`
  (long csv.gz): all states x 3-digit groups (2008, 2004, 1987) and the older blocks' states x
  2-digit divisions (2,281,445 rows in six files). State x 4-digit is not served at all.
- ASUSE, every annual table in both rulers: `asuse-tNN` (2021-22 to 2023-24) and
  `asuse-2025-tNN` (calendar 2025), 73 bundles, 20,225 series; full crosses (630,011 rows) in
  `data/archive/staging/asuse/`. Quarterly bulletin to Apr-Jun 2026.
- New plates: what a factory job pays by industry; persons per factory; the 20 largest 4-digit
  classes; state x division mix; ASUSE 2025 workers by trade; women's share by trade. Every-cut:
  111,253 series (4 family views: ASUSE FY, ASUSE 2025, ASI 2008, ASI older). Prose regenerated
  and read.
- Raw: complete tables gzipped in staging, committed indexes `data/raw/asi-index.json` (174
  tables, 3,354,765 rows) and `data/raw/asuse-index.json`. Retired: `asuse-records.json` and
  the old per-cut ASI dumps (in git history).

## Hand checks

- Core: composite growth 2025-26 2.7% (DBIE) = OEA's revised cumulative 2025-26 (release of
  20 May 2026).
- IIP 1980-81: 1986-87 annual average 155.09 (report 219) = mean of report 638's months.
- IIP annual 2022-23 base: 2025-26 growth 4.3% as reported from MoSPI's 1 June 2026 release.
- ASI 2023-24: GVA ₹24,58,336 crore and persons engaged 1,95,89,131 = MoSPI's ASI 2023-24
  results; top five industries by GVA match asi-nic2's top five. Divisions' GVA sums to All
  India exactly (validate).
- ASUSE: All India establishments in `asuse-t01` identical to `asuse-annual`.

## Decisions (for HISTORY.md)

- Core industries are annual only: DBIE has no monthly index. The monthly series (OEA, DPIIT)
  is a new source, not added; follow-up.
- Core 1993-94 base: the RBI's 1994-95 growth rows are measured against the 1980-81 base's
  level (composite -55.5%): a splice, dropped (raw keeps it); rule checked for every base.
  The second, not-full-year set of 2010-11 rows on that base is not baked.
- ASI 2008, 4-digit, 2023-24: indicators 36-49 arrive shifted one code down (persons engaged
  stops adding up; adds up read one code up). Detected by the identity per grain and year;
  indicators 36-50 of that year quarantined. Indicator 36 (children) excluded everywhere.
- Archive line: NIC 2008 states x division baked (current ruler, 47k series, 22 MB); older
  blocks' states x division and every states x 3-digit to the archive (69k + series, 28 MB+).
- ASUSE baked/archive split by the catalogue's own definition of an item: a series varies at
  most one of the five cuts; full crosses to the archive.
- Pages carry build-time picks for the big tables (`#u25-data`, `#asi-deep-data`), keeping page
  JS small.
- Prose: core and other mixed-unit bundles are not prose inputs; slot briefs force readable
  scales (₹ lakh crore, crore), "accelerated/slowed" for growth-rate counts, no cross-unit
  rankings, and the 2025 ASUSE round named as its own year. Factories requiredFigures now
  GVA growth and the factory count (the contract needs literal figures).

## Source quirks

- MoSPI has released ASI 2024-25 (factsheet); eSankhyiki still ends at 2023-24 (2026-10-10).
- MoSPI annual IIP, base 2022-23: API growth 6.8% (2023-24) and 5.7% (2024-25); press summaries
  quote 6.7% and 6.4%. API annual levels equal the monthly means. Release PDF: HTTP 403. Open.
- ASUSE table 9 relabelled its headline row ("any kind of  Account in Financial Institutions",
  double space); values unchanged. Tables 1 and 2 now carry a count and a percentage measure.
- ASI listings name items with no rows: NIC 98 (all blocks), 1987 division 36 and group 249,
  rural/urban sectors in 1987 and 1998, 1998 states x 3-digit. Excluded with reasons.
- ASI NIC 99999 copies disagree in 3,853 cells across grains (mostly the 2023-24 4-digit shift
  at state level); majority copy kept, as before.
- Paging audit (launch-build c683ad4): all 174 ASI tables and 52 ASUSE tables have zero repeated
  row keys; IIP monthly moved onto `mospiAll`; the offline rebake of every family changed nothing
  in `data/series`; no "pages slipped" warnings.
- IDH: the Data Bank's `india_data_hub_series` holds no IIP, core, ASI or ASUSE series.

## Shared files touched (my blocks)

`data/sources.yml` (core, iip-1980; seams: iip base 1980-81 and annual bundles, core, asuse, asi
bundle lists), `scripts/fetch.mjs`, `scripts/validate.mjs`, `scripts/qc.mjs`,
`src/dossiers/registry.js` (iip and factories entries), `src/dossiers/everycut.js`,
`pipeline/asof-manifest.json`, `pipeline/slots.yml`, `public/og/iip.png`. Read, not owned:
`services-isp-annual`.
