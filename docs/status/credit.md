# credit: money, credit and banks

Branch `lb/credit`, port 4403. Updated 2026-10-09.

## Done

- Adapter `scripts/lib/products/credit.mjs` (product `credit`), registered in
  `data/sources.yml` and `scripts/fetch.mjs`. Reads the Data Bank only.
- 55 bundles, `data/series/credit-*.json`, 7 raw archives `data/raw/credit-*.json`.
- Seams registered: sectoral credit 2007 vs 2019 format; spatial statements with and
  without RRBs.
- `validate.mjs` block: ranges, cadence, and identities (deposits = demand + time; credit =
  loans + bills; non-food = bank credit - food; industry = its sizes; personal loans = their
  nine types; NPA flow balances; M3 = its parts; credit used = used where sanctioned + brought
  in; growth = RBI's printed growth).

## Next

Guide page and client, registry, headline, OG card, qc, asof, slots, prose; coverage
catalogue and ledger; hand checks; look at it.

## Decisions

- Headline is bank credit growth on a year earlier (monthly, all SCBs), computed with RBI's
  own printed year-ago figure, so it equals the press release to the decimal.
- HDFC merger (July 2023): raw and "excluding the merger" series kept side by side, never
  joined. RBI's adjusted Section 42 figures run 14 Jul 2023 to 22 Aug 2025.
- December 2025 reporting calendar (15th and month-end, Banking Laws (Amendment) Act 2025):
  one series; growth compares with the nearest old-calendar Friday, as RBI does.
- Product tags in `meta.dossier` (credit-s42, credit-sibc, credit-money, credit-health,
  credit-place, credit-bsr1, credit-nbfc) so census and seams work per product.
- Andhra Pradesh and Jammu and Kashmir are split into two series where Telangana and Ladakh
  were carved out inside a bundle's span. Population groups split at the 2001 to 2011
  census switch (2015-16).

## Source quirks (for HISTORY)

- CAS money tables print 0 for discontinued ex-merger series after June 2025, and the monthly
  M3 then equals M1. Dropped and disclosed.
- Report 330: the pre-2011 "Private Sector Banks" ratio row is old + new ratios added up.
  Dropped. From March 2014 "New Private Sector Banks" means all private banks. Relabelled.
- Report 689: mid-2021 Final rows don't add up; the Provisional set does. Used, disclosed.
- Sectoral export: 13 dates carry a different fortnight's Section 42 totals. Replaced from
  689/1130, disclosed.
- Report 1555 prints an all-India row beside its districts. Read on its own.
- Reports 1114 and 336: unit column is junk (SECONDS, LAKH TONNES); values are rupees.
- BSR-1 quarterly tables skip June and September 2014.

## Shared files touched

- `scripts/lib/databank.mjs`: appended `dbieProvider()` (reports with several data providers).
- `scripts/fetch.mjs`: one import and one registry key.

## Blocked

Nothing yet.
