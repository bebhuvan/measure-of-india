# trade: status

Guide: merchandise trade (`/guides/trade/`), branch `lb/trade`, port 4402. Updated 2026-10-09.

## Done

- Read the brief, contracts, design and template guides.
- Mapped all 48 TradeStat forms live (field names, unit codes) into `docs/reference/tradestat.md`.
- `scripts/lib/tradestat.mjs`: the client (fresh token and cookie per POST, one request at a
  time, backoff on 419/429/5xx). `requestRaw` appended to `scripts/lib/net.mjs` for POST.
- Fetch phase of the adapter: one archived file per call under `data/raw/trade/`, resumable.

## Now

- Full TradeStat download running (about 12,700 calls, newest first).
- DBIE side (Data Bank) adapter.

## Next

Bake bundles, value checks, coverage ledger, guide page, prose, gates, look at it.

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

## Source quirks

- Each form names its fields differently, and unit codes differ by form (MEIDB commodity:
  1 US$, 3 ₹, 2 quantity; FTPA: 2 US$, 1 ₹; the import region form: 2 for ₹).
- Region view growth rates disagree with their own values (Europe 7.52% vs 6.99% for the
  same two numbers): we compute growth ourselves, never read it.
- Footnote on the 8-digit tables: some ITC-HS codes were dropped or re-allocated, with
  units changed, from April 2024 and April 2026 (marked `*`).
- FTPA (principal commodities) runs a month ahead of MEIDB (quick estimates, flagged P) and
  back to April 2009.

## Blocked

- Nothing yet.

## For the owner

- Nothing yet.
