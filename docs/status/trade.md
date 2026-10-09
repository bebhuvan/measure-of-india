# trade: status

Guide: merchandise trade (`/guides/trade/`), branch `lb/trade`, port 4402. Updated 2026-10-09 (late).

## Done

- Contracts, design and templates read; all 48 TradeStat forms mapped live.
- `scripts/lib/tradestat.mjs`: the client (fresh token and cookie per POST, one request at a
  time, backoff; its own POST helper, `net.mjs` stays GET-only).
- TradeStat adapter (`products/tradestat*.mjs`): resumable per-call archive
  (`data/raw/trade/`, gzipped JSON, cells as printed), bake and catalogue. Baked so far:
  totals, HS 2 and 4 (monthly, financial year, year to date; US$ and ₹), partners and
  regions, balance by partner, principal commodities since 2009-10 (FTPA), principal
  commodity quantities (FTSPCC), partner history since 2009-10 (FTSPCC).
- DBIE adapter (`products/dbie-trade.mjs`): 20 bundles, the long view since 1970-71.
- Value checks done and recorded in the adapter headers (see Decisions).
- `validate.mjs` trade block: parts sum to printed totals (to 0.001%), every financial year
  = sum of its months, TradeStat vs RBI annual within 0.3%, partners sum to India total.
- Guide page and client drafted (17 plates), merged launch-build (every-cut table in).

## Now

Done, 2026-10-09. Build (537 pages), `npm run gates`, `npm test`, `npm run prose:dry` green;
both prose slots verified, linted, contract-checked and read against the data.

## Next

- Archive builder: upload `data/archive/staging/trade/` (110 long-format files, 9.5 million
  rows: 6/8-digit lines, US$ / ₹ / quantity; plus partner x heading) and
  `data/archive/staging/trade-raw/` (12,627 calls, indexed in `data/raw/trade-index.json`),
  then fill the link in the guide's `#xp-archive-link` note.
- April 2027: nothing to bump in the registry (6/8-digit files are no longer listed).

## Decisions (and why)

- **MEIDB (monthly) is the source of record for every commodity and partner figure.**
  Annual values are the March call's April-to-March cumulative. EIDB (annual) is fetched
  only to document a defect: its 2023-24 commodity tables count every record twice (chapter
  sum 874,144 vs printed total 437,072; fish 12,248 = 2 x 6,124 in MEIDB). That is the
  "fish at 12,248" the probe saw.
- An unpublished month comes back as HTTP 200 with every value 0.00 flagged "(A)". The
  client treats an all-zero column as "not published", never as zero trade.
- Quantity is fetched only at HS 8 digits: at 2, 4 and 6 digits TradeStat prints no unit
  (kilograms, numbers and litres summed together). One month of each is archived as evidence.
- Commodity by country: annual (April to March) and the current year to date, at HS 2 and
  4 digits, US$, every partner. Monthly commodity x country would be about 50,000 calls; see
  "For the owner" below.
- Raw dumps are gzipped JSON per call (cells as printed). Plain JSON for the 8-digit tables
  would add several hundred MB to git.

- Plate titles that make a claim are computed from the data (for example "electronics grew
  8.6 times, to 4th place among 21 export groups"); my first hand-typed titles got three of
  them wrong (electronics is not top three; the China deficit nearly quadrupled, not
  tripled; import volumes rose more than import prices).
- The 2012-base export quantum index for 2025-26 (473.58 after 179.21) is withheld: with the
  unit value index it implies exports grew 178% in value against 5.4% in rupees. General rule
  in the adapter (any year off by more than 60 points), disclosed on the series and plate.

## Source quirks

- Each form names its fields differently, and unit codes differ by form (MEIDB commodity:
  1 US$, 3 ₹, 2 quantity; FTPA: 2 US$, 1 ₹; the import region form: 2 for ₹).
- Region view growth rates disagree with their own values (Europe 7.52% vs 6.99% for the
  same two numbers): we compute growth ourselves, never read it.
- Footnote on the 8-digit tables: some ITC-HS codes were dropped or re-allocated, with
  units changed, from April 2024 and April 2026 (marked `*`).
- FTPA (principal commodities) runs a month ahead of MEIDB (quick estimates, flagged P) and
  back to April 2009.

- DBIE: the RBI's oil split for Feb and Mar 2017 does not add to its total (an earlier
  print, about 1.3%); the June 2001 rupee balance is printed as -1,970 crore against
  exports minus imports of -1,904. Both shown as published, named in validate.
- DBIE commodity unit-value tables: the coordinator's quoted-cell CSV fix (merged
  2026-10-09) corrected 96 import series that a naive ";" split had misaligned. My provider
  reader (`products/dbie-providers.mjs`) now uses the same parse.
- TradeStat lists about 40 small territories under "Unspecified Region"; labelled "no region
  assigned".

## Blocked

- Nothing yet.

## IDH series that match (for the coordinator's cross-check)

The Data Bank's `india_data_hub_series` holds no merchandise-trade totals yet (the macro
trade series would need adding to its IDH config). Partial matches, all PPAC petroleum:
- `PGPTCROLIM11M:IND` crude oil imports, US$ monthly ~ `trade-hs4-imports` c2709
- `PGPTTTPREX11M:IND` petroleum product exports, US$ ~ `trade-hs4-exports` c2710 / `trade-dbie-monthly` exports_oil
- `PGPTTTPTIM11M:IND` crude and product imports, US$ ~ `trade-dbie-monthly` imports_oil
- `ENPTCRUIMP11M:IND` crude imports, million tonnes, monthly ~ `trade-dbie-oil-volumes` crude_imports (annual sums)
- `ENPTPRDEXP11M:IND`, `ENPTPRDIMP11M:IND` product exports and imports, tonnes ~ `trade-principal-quantity-*` S6
(PPAC's definitions differ a little from DGCI&S chapters: expect small gaps, not matches.)

## For the owner

- **Decided by the coordinator for the owner (2026-10-09), done:** 6/8-digit tables (US$,
  ₹ and quantity, every month since January 2017) are the deep-archive tier, staged as
  long-format gzipped CSV in `data/archive/staging/trade/` (git-ignored; one file per
  flow, level, unit and financial year on one HS edition; 9.5 million rows); the
  per-call raw archive is staged in `data/archive/staging/trade-raw/` and indexed in
  `data/raw/trade-index.json` (committed, sha256 per call). The guide's 6/8-digit look-up
  became a note awaiting the archive links (`#xp-archive-link`). My branch history was
  rewritten locally so the 450 MB never entered it; the old tip is
  `lb/trade-backup-prearchive` (safe to delete after the merge).
- **Partner x product is annual, at 2 and 4 digits**; monthly partner history (about 50,000
  calls) is excluded, not for launch (coordinator, 2026-10-09).
- **Census.** Even without the 6/8-digit tables, `census trade` writes 53 MB (partner x
  chapter alone is about 20,000 series); not committed. trade-dbie's is 2 MB.
- **Partner x heading** (about 150,000 pairs, 95 MB as bundles) went to the archive tier on
  the same rule as the 6/8-digit tables; partner x chapter stays baked and drawn.
