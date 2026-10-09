# climate: status

Branch `lb/climate`. Guide `/guides/climate/`, preview port 4408. Updated 2026-10-09.

## Done

- **Sources.** OWID (CO2 and energy datasets for India, China, the US and the world; OWID's
  ERA5 temperature and rain, wildfires, warming contributions, heat-death projections, a
  youth survey) and the World Bank CCKP (CRU TS 4.10 from 1901, ERA5 from 1950, CMIP6
  projections to 2100; India and 35 state units). Family clients `scripts/lib/owid.mjs`,
  `scripts/lib/cckp.mjs`; adapters `owid-climate.mjs`, `cckp.mjs` (+ `cckp-vars.mjs`).
  Notes: `docs/reference/owid.md`, `docs/reference/cckp.md`.
- **62 bundles**, about 12 MB, 16,909 series. Each names its instrument; all ten
  instruments registered under `seams: climate` (never joined).
- **Validation** (`validate.mjs`, climate block): instrument and geography per bundle,
  unit-keyed ranges, nested thresholds and min ≤ mean ≤ max (India and every state), CRU
  annual = sum/mean of months, CCKP's published 1991-2020 climatology = our mean (India and
  35 states), OWID fuel split = total CO2, per capita = total / population, India's share =
  India / World, electricity shares sum to 100, CMIP6 p10 ≤ median ≤ p90.
- **Coverage**: `climate-owid` 1,092 items (57 shown, 778 baked, 257 excluded); `climate-cckp`
  23,559 items (71 shown, 3,213 baked, 18,540 excluded, 1,735 blocked). Every baked or
  shown item checked by script against the series in its bundles. Nothing pending.
- **Guide**: 14 sections, 22 plates, every-cut table (18 long-tail pages), state explorer,
  OG card, registry, headline, register rows, qc PAGES (24
  recomputed figures), 22 governed As-of notes, prose slots, corpus, keyword map.
- **Prose** generated (DeepSeek) and read against the facts sheet: every figure checks.
- **Looked at**: 1440px plate by plate, 390px (no page overflow; plates scroll in frame),
  century plate PNG downloaded and read.
- Gates green: build, `npm run gates`, `npm test` (27), `npm run prose:dry`.

## Hand checks (one per bundle family)

- CRU TS: CRU's own India file gives +0.91°C (2016-25 vs 1901-30) and +0.57°C (1996-2025 vs
  1951-80); ours +0.87 and +0.56. Levels differ ~0.7°C (mask: CCKP has no J&K or Ladakh
  unit); rain 2024 agrees (1,256.1 vs 1,253.5 mm). Disclosed in §03.
- ERA5 (CCKP): published 1991-2020 climatology equals our means (validate checks it).
- CMIP6: SSP2-4.5 2040-59 tas +1.18°C re-read from the API.
- OWID CO2: India 2024 3,193 Mt, 8.3% of world; Global Carbon Budget 2025: 3.2 Gt, 8%.
- OWID energy: solar 9.4%, wind+solar 14.4%, low-carbon 26.7% (2025); Ember: 9.4%, 14%, 27%.
- OWID ERA5 monthly: August 2026 0.6251755 matches OWID's grapher CSV (Copernicus publishes
  no country series).

## Findings worth knowing

- The heat story is humid and nocturnal: nights ≥26°C 46 → 67 days a year (1951-80 →
  1996-2025), wet-bulb ≥27°C 2.6 → 11.8, heat index ≥41°C 0.6 → 3.5; days ≥40°C flat
  (21 → 20). In the north-western plains 40°C days fell (Delhi −10 a year) while humid days rose by 23 to 32.
- The two records disagree on where it warmed most: CRU puts the south first (Lakshadweep,
  Kerala, Tamil Nadu), ERA5 the hills and north-east. The plate shows both.
- National monsoon total and timing barely moved since 1901 (1,133 → 1,138 mm).

## Decisions (for HISTORY)

- Change is always the difference of two 30-year means inside one instrument (1951-80 →
  1996-2025); the headline century figure is 2016-25 vs 1901-30, stated.
- `proseInputs` limited to the OWID ERA5 bundles (facts.mjs refuses mixed instruments); the
  CRU century context enters the facts sheet as its own labelled `climate` block.
- OWID's current-year annual averages (part-year) are dropped from annual bundles, disclosed.
- WDI climate indicators: not used. The Data Bank holds no WDI climate series, and OWID and
  CCKP cover the same ground; WDI's EDGAR-based GHG would be a third estimate for later.
- No IDH series match these bundles.

## Source quirks

- CCKP: fill values ~1e20 served as data; ERA5 simplified WBGT corrupt (1e18 in 2024-25);
  CMIP6 WBGT not served; CMIP6 wet-bulb corrupt (India mean ~8°C); one CMIP6 percentile out
  of order (rxmonth SSP1-1.9 p90, withheld); 21 variable/product/scenario combinations
  listed in the bucket return no data from the API (all `blocked`, dated).
- CCKP's web portal is behind Cloudflare; the API and S3 bucket are open. Place names come
  only from the xlsx output.
- OWID: codebooks 404 on owid-public, fine on GitHub; monthly indicators are day offsets.

## Owner decisions flagged (taken provisionally, easy to reverse)

- **Size exclusions**: CCKP state-by-season and state-by-month series, CMIP6 state time series,
  state p10/p90 and climatologies, and CMIP6 monthly/seasonal windows are `excluded` for size
  (they would multiply the archive 10-15x); CCKP serves them on request. If the owner wants
  them, the adapter can bake them; the cost is tens of MB of bundles.
- The CCKP raw dump is 13 MB, plus one same-day archived vintage (rename of bundles).

## Shared files touched (append-only blocks, marked climate)

`data/sources.yml` (families, dossiers, seams), `src/dossiers/registry.js`, `headline.js`,
`scripts/validate.mjs`, `scripts/qc.mjs`, `scripts/og.mjs`, `scripts/fetch.mjs` (2 imports,
registry entries), `pipeline/slots.yml`, `pipeline/asof-manifest.json`, `pipeline/facts.mjs`
(a `slug === "climate"` block), `pipeline/lib/series-kws.mjs`, `src/dossiers/everycut.js`
(units, cuts, period labels). **`scripts/lib/net.mjs`**: two opt-in options (`markup` for XML
listings, `encoding` for binary), defaults unchanged. Not touched: `src/dossiers/periods.js`
(no period words needed; the page derives its periods from the bundles). `src/dossiers/register.client.js`: one appended block (three climate rows).

## Follow-up (2026-10-09, after the first merge)

- **Seasonal levels.** The prose had called a May-to-August fall in the monthly temperature
  level a streak; that is the calendar. Fixed at the source: a series flag `seasonal: true`
  (set by both adapters on monthly and seasonal levels of temperature, rain and burnt area,
  never on anomalies) makes `pipeline/facts.mjs` drop month-on-month moves, runs, `last4`,
  year-start and base-effect fields for that series, keeping same-month comparisons and
  extremes. **Generic, small and marked**: any guide can set the flag; no other guide sets it.
- `proseInputs` is now `climate-temp-annual` only: the ERA5 rain total (about 1,400 mm) runs
  above the IMD all-India figure readers know (normal about 1,160 mm), so it stays out of the
  prose. The page's rain plates use the station record and say how it differs from IMD.
- Slot briefs: state the rank once; never describe the level rising or falling month to
  month. Prose regenerated and re-read: every figure checks against the facts sheet.
- New misreading on the page (no. 2): monthly temperature always falls into the monsoon;
  watch the anomaly, not the level.
- Size exclusion: unchanged, with the owner.
