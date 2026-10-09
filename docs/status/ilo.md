# ilo: work in India, the ILO's estimates

Branch `lb/ilo`. Port 4407. Updated 2026-10-09.

## Done

- ILOSTAT API found and documented. `rplumber.ilo.org` returns empty bodies; the SDMX API at
  `sdmx.ilo.org` works. Client: `scripts/lib/ilostat.mjs`.
- Catalogue: 1,215 ILOSTAT dataflows, 693 hold India, 2.54 million Indian observations,
  3,445 catalogue items (instrument x frequency x flow x classification version).
- Adapter `scripts/lib/products/ilostat.mjs`: 177 bundles, raw dumps `data/raw/ilo-*.json`.
- Ledger `data/coverage/ilo.yml`: every item decided. Validate: ranges, cadence, identities,
  instruments registered under `seams: ilo`.

## Next

Guide page, client, registry, headline, periods, OG, qc, asof, prose.

## Decisions (for HISTORY.md)

- **Scale: owner to confirm.** India's ILOSTAT data is 2.54 million observations. Baked:
  every modelled series; every PLFS and NSS table by sex and one other classification
  (annual); quarterly PLFS by sex, plus quarterly rates by sex and age and by sex and area;
  every Census and administrative series. About 200,000 observations, 18 MB of bundles,
  28 MB of raw dumps. Not baked: the three-way cubes (951,000 cells) and the finer quarterly
  tables (1.35 million cells), listed `excluded` in the ledger with the reason. One flag
  (`ilo.bake.annualMaxCuts: 3` in `data/sources.yml`) bakes the cubes, at roughly 50 MB more.
- **Instruments are rulers.** ILOEST (modelled), PLFS as processed by the ILO, NSS rounds,
  the Census and each administrative source are separate bundles and separate seams bases.
- **Projections apart.** Modelled years from the edition year on (2025 to 2027 in the
  November 2025 edition; 2024 on for the UN population estimates) sit in
  `ilo-est-projections`, never on the headline axis.
- **ILO flags travel with the data.** Per series: `flags` (R real, U unreliable, B break,
  A adjusted, M model-based), `lower`/`upper` bounds where the ILO publishes them, and
  `withheld` for cells served blank with a flag.
- **Copies set aside.** ILOSTAT's CPI, exchange rates, PPP factors and dollar conversions of
  rupee earnings are `excluded` (other agencies are the source of record).
- **Peers:** China, Bangladesh, Indonesia, Vietnam (the brief's list), modelled series only.

## Source quirks

- A data query for a country the flow does not hold returns HTTP 500 (an Oracle error), so
  the client reads each flow's content constraint first.
- A constraint can omit a dimension (DF_LAP_2LID_QTL_RT has no DCL): the client retries
  with one more key slot on HTTP 422.
- Cloudflare occasionally answers 403 to a request it serves a minute later: retried.
- The ILO's NSS years are the year each round ends (2012 = July 2011 to June 2012).
- ILOSTAT's PLFS series are calendar years on current weekly status, not MoSPI's July-June
  usual-status figures.
- For India's modelled unemployment rate, only 2018 to 2024 are flagged real; 1991 to 2017
  are imputed, with bounds from about 2% to 15%.

## Shared files touched

- `scripts/lib/net.mjs`: one opt-in option, `markup: true` (default unchanged).
- Appended blocks: `data/sources.yml` (family, dossier, seams), `scripts/fetch.mjs`,
  `scripts/validate.mjs`.

## Hand checks

- ILOEST unemployment rate, India, 15+, 2024 = 4.173 (flag R), DF_UNE_2EAP_SEX_AGE_RT.
- PLFS women's LFPR 15+, calendar 2024 = 34.389, DF_EAP_DWAP_SEX_AGE_RT.
  Both read by hand from the API's labelled CSV; both asserted in validate.mjs.

## IDH series matching these bundles

To check (Data Bank `india_data_hub_series`).
