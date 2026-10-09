# ilo: work in India, the ILO's estimates

Branch `lb/ilo`. Port 4407. Updated 2026-10-09. **State: done, gates green.**

## Done

- **Source.** ILOSTAT's SDMX API (`sdmx.ilo.org`); `rplumber.ilo.org` returns empty bodies.
  Notes: `docs/reference/ilostat.md`. Client `scripts/lib/ilostat.mjs`.
- **Catalogue.** 1,215 flows, 693 hold India, 2.54 million Indian observations, 3,445 items.
- **Bundles.** 68 (`ilo-*`), raw dumps `data/raw/ilo-{est,plfs,nss,other}.json`.
  Modelled: one bundle per indicator family. Survey: one per instrument and topic
  (`ilo-plfs-emp`), small topics folded into `ilo-<instrument>-more`. Quarterly PLFS, Census
  and each administrative source: one each. Projections apart. Four peers.
- **Ledger.** `data/coverage/ilo.yml`: 23 shown, 1,040 baked, 2,382 excluded, 0 blocked, 0 pending.
- **Validate.** Unit ranges, cadence, flags on the axis, bounds bracket values,
  EPR = LFPR x (1 - UR) for India and the peers, women and men bracket the total, status and
  class parts sum to employment, deciles sum to 100, two hand-checked anchors. Every instrument
  registered under `seams: ilo` (19 bases).
- **Guide** `/guides/ilo/`: 18 plates (participation; five rulers; the model's unemployment
  band; women by age, schooling and area; NEET; status; sector; informality; working poverty;
  labour share; deciles; hours; earnings; four peers; output per worker), every-cut table
  (41,656 series, 24 long-tail page sets), prose slots generated and read by hand.
- **Wiring.** Registry, headline, register rows, OG card, qc PAGES, as-of manifest (17),
  slots, corpus, keyword map, every-cut units and NSS period labels.
- **Gates.** `astro build`, `npm run gates`, `npm test` (27/27), `npm run prose:dry`: green.
  Chart lint clean. Looked at 1440 and 390 px; read every chart; downloaded the
  working-poverty share image.

## Decisions (for HISTORY.md)

- **Archive tier (interim, 2026-10-09).** The size-excluded cubes carry `archive: true` and
  `rolls_up_to: <baked bundle>` in the ledger (16 cube rules by instrument and topic, one
  quarterly rule), status `excluded`, held for the deep-archive tier the owner is deciding on.
- **Scale: owner to confirm.** Baked: every modelled series; every PLFS and NSS table by sex
  and one other classification (annual); quarterly PLFS by sex, and rates by sex and age or
  area; every Census and administrative series. About 200,000 observations, 18 MB of bundles,
  28 MB raw. Not baked, listed `excluded` with the reason: the three-way cubes (951,000 cells)
  and finer quarterly tables (1.35 million cells). `ilo.bake.annualMaxCuts: 3` in
  `data/sources.yml` bakes the cubes (roughly 50 MB more).
- **Instruments are rulers.** Model, PLFS-as-processed-by-ILO, NSS, Census and each admin source
  are separate bundles and seams bases; the five-rulers plate draws them through `seamMarks`.
- **Projections apart** (`ilo-est-projections`): the edition year on, never on a headline axis.
- **ILO flags travel with the data**: `flags` (R, U, B, A, M), `lower`/`upper`, `withheld`.
- **Copies set aside**: ILOSTAT's CPI, exchange rates, PPP factors, dollar earnings.
- **Peers**: China, Bangladesh, Indonesia, Vietnam; modelled series only.
- **Page data**: the guide embeds only the series it draws (`src/dossiers/ilo.data.js`, an
  inline JSON block) rather than importing whole bundles, to keep the page under budget.
- **Charted from another guide**: `plfs-annual` (jobs) for MoSPI's own PLFS beside the ILO's.

## Hand checks

- By eye against the ILO's labelled CSV: ILOEST unemployment 2024 = 4.173 (R);
  PLFS women's LFPR 2024 = 34.389. Both asserted in `validate.mjs`.
- `node scripts/lib/products/ilostat.mjs --spotcheck` (cache bypassed): one value per bundle,
  all 68 match the labelled CSV.

## Source quirks

- Unknown country gives HTTP 500 (Oracle error), so constraints are read first.
- Constraints can omit a dimension; 422 retried with one more key slot.
- Cloudflare sometimes 403s; retried. Structure messages are XML only.
- NSS years are the year each round ends (2012 = 2011-12).
- ILO's PLFS is calendar years, current weekly status: not MoSPI's July-June usual status.
- The model's unemployment rate is flat at 7.6% for 1991 to 2017 (imputed, band 1.9% to 14.7%)
  while the NSS rounds the ILO itself processed measured 2% to 4%.

## Shared files touched (one block each, marked `ilo`)

- `scripts/lib/net.mjs`: opt-in `markup: true` option (default unchanged). **Please review.**
- `data/sources.yml` (family, dossier, seams), `scripts/fetch.mjs`, `scripts/validate.mjs`,
  `src/dossiers/registry.js`, `src/dossiers/headline.js`, `src/dossiers/register.client.js`,
  `src/dossiers/everycut.js` (units, NSS period labels), `scripts/qc.mjs`, `scripts/og.mjs`,
  `pipeline/asof-manifest.json`, `pipeline/slots.yml`, `pipeline/lib/series-kws.mjs`.
- `pipeline/out/prose-manifest.json` changed (expected to conflict; regenerate).

## For the coordinator

- The guide page is 0.87 MB, mostly the inline every-cut rows (bundles under 150 series are
  listed inline). Within "well under 1 MB" only just; a per-guide inline cap in `EveryCut`
  would help guides with many small bundles.
- One `npx astro build` with the default heap was killed (exit 144, no output); with
  `NODE_OPTIONS=--max-old-space-size=8000` every build since has passed. Cause not confirmed.

## IDH series matching these bundles

None: the Data Bank's `india_data_hub_series` holds no labour-market series (queried 2026-10-09).
