# Services (`services`): status

Branch `lb/services`. Updated 2026-10-09. **Done**, all gates green.

## What is built

- **Guide** `/guides/services/`: 10 sections, 16 plates. What counts as a service (lived
  reality), size and growth (NAS, two bases), the trial ISP, services trade (75 years, monthly,
  BPM6 categories, purpose codes behind GCC-type work), who works in services (PLFS),
  informal service enterprises (ASUSE), an "Every cut" explorer (loads each bundle's JSON
  only when opened), what this measures, six misreadings, data and provenance.
- **Adapter** `scripts/lib/products/services.mjs`: five products, one dossier key each in
  `sources.yml` (`services-isp`, `-nas`, `-trade`, `-jobs`, `-asuse`), plus `--catalogue`.
- **14 bundles**: `services-isp-growth`, `-isp-annual`; `services-gva-{2022,2011}-{share,growth,level}`;
  `services-trade-monthly`, `-bop-quarterly`, `-invisibles-quarterly`, `-bop-annual`;
  `services-jobs-ay`, `-jobs-cy`; `services-asuse`, `-asuse-profile`, `-asuse-2025`,
  `-asuse-profile-2025`. Raw archives `data/raw/services-*.json`.
- **Coverage**: 3,524 catalogue items: 1,060 shown, 2,336 baked, 128 excluded, 0 blocked.
  Every shown and baked claim checked item by item against bundle data (not only bundle
  existence).
- **Prose** generated (DeepSeek) and read by hand against the data; two rounds of brief
  fixes (see decisions).
- Looked at 1440 and 390 px; every chart read; one share PNG downloaded and checked.

## Gates (at the commit)

`npx astro build` ok; `npm run gates` ok (validate, coverage, asof, qc, chart lint);
`npm test` 18/18; `npm run prose:dry` ok; both prose files pass verify.

## Hand checks (against the agencies' own releases)

- ISP: MoSPI release 14 Jul 2026 (2025-26 retail 130.5, hotels 135.6; Apr 2026 retail 137.50,
  +30.8%) and 29 Jul 2026 (retail May +13.3%). Match.
- BoP: RBI release 27 Jun 2025, net services Q4 FY25 $53.3 bn, a year earlier $42.7 bn;
  Q2 FY25 $44.5 bn. Match.
- Monthly trade: RBI release 30 Jun 2026, May receipts 33,355 / payments 17,637 ($ mn). Match.
- NAS: groups equal the sum of parts (validate). ASUSE: aggregates equal `asuse-sectors`.
  PLFS 2023-24 services CWS 31.6% equals `plfs-status`.

## Decisions (for HISTORY.md)

- Five dossier keys, not one: bundles are checked against their own base and the prose
  base-check stays meaningful.
- Headline / current bundle: services' share of GVA, 2022-23 base (54.0%, 2025-26).
- NAS 2011-12 base: the three combined service groups are served only as advance and
  provisional estimates, their parts as revised estimates, so the two disagree in the same
  year. The services total uses the six parts where they exist; validate compares group and
  parts only at the same revision stage.
- Growth bundle carries service industries and total GVA only (farm and factory growth is the
  GDP guide's); it also kept the prose writer from mixing a 2025-26 utilities figure into a
  2024-25 list.
- DBIE: keep the most mature version per period (Final > Partially Revised > Provisional >
  Preliminary). Quarantined the Jan-Mar 2013 purpose-code receipts (a full year filed under one
  quarter); raw kept. RBI's 1985-86 services row does not add up as published: kept, exception
  named in validate.
- PLFS: lone NIC-group rows (100% totals) and an undocumented non-farm row are excluded.
- ASUSE: every activity-carrying indicator baked for service activities; 2025 round is a
  calendar year, separate bundles. One activity key shortened (`wholesale_on_fee_or_contract`)
  because the full slug ends in "basis", which qc's smoothing-curve grep rejects.
- Page JS budget: the jobs, ASUSE and BoP-detail bundles are megabytes, so the page carries a
  build-time pick of the series the plates draw (`#svc-data`); whole files stay in downloads
  and the explorer.
- Prose brief: shares that add to 100 must not explain each other; every figure with its unit
  and own period; the "we do not know" is about informal-firm growth (PLFS does publish the
  jobs share, so jobs are not unknown).

## Source quirks (details in `docs/reference/services-sources.md`)

- **DBIE 1501 lags RBI's press releases**: the Data Bank copy ends May 2026 with May's first
  estimate; RBI has since revised May and published June to August. Not a Data Bank fault;
  the DBIE table itself is behind. The page says so.
- **`dbieReport` misaligns rows with ";" inside quoted text** (report 1076, item 3.4.2.1,
  5,232 rows: the BoP financial account). No services row is affected, but the external
  guide reads this report. Needs a quote-aware split in `scripts/lib/databank.mjs`
  (coordinator's file).
- BPM6 services sub-items (computer services, R&D) are published only to Mar 2021 plus Mar
  2024; the purpose-code tables carry the detail to Jun 2025.

## Shared files touched (append-only blocks, marked `services`)

`data/sources.yml` (5 dossiers + 4 seams), `src/dossiers/registry.js` (no "15"),
`headline.js`, `register.client.js`, `scripts/validate.mjs`, `scripts/qc.mjs`, `scripts/og.mjs`,
`pipeline/asof-manifest.json` (16 entries), `pipeline/slots.yml`. Also needed and not on the
append-only list: `scripts/fetch.mjs` (import + one `Object.assign` line) and
`pipeline/lib/series-kws.mjs` (the prose contract needs a keyword map per guide).
`og.mjs` regenerates every card; only `public/og/services.png` is committed.

## Read, not owned

`isp` (iip guide), `gdp-2022-industries`, `gdp-2022`, `gdp`, `gdp-industries` (GDP guide),
`asuse-sectors` (factories guide), `plfs-status` (hand check only).

## IDH

No IDH series in the Data Bank matches these bundles (its services entries are bank credit to
services and UPI by merchant code).

## Next (not blocking)

- When DBIE catches up, monthly trade gains Jun to Aug 2026; asof stamps will flag.
- State services (GSVA by state) belongs to the states guide; a link from here once it lands.
