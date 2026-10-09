# industry: status

Session atlas-industry, branch `lb/industry`, port 4423. Brief: `docs/briefs/industry.md` (wave 2).
Guides `iip` and `factories`; ledgers `iip`, `isp`, `core`, `iip-dbie`, `asi`, `asuse`.

## Done

- **IIP financial years, every base** (2026-10-10): `iip-annual-2022/2011/2004/1993`, MoSPI's
  own annual rows (frequency=Annually), levels and published growth. Checked: each annual
  General index is the mean of its twelve monthly levels (within 0.05), growth matches levels.
- **IIP base 1980-81** (new ruler, from the RBI's copy, DBIE 638 and 219): `iip-1980` (General
  and three sectors, y/y Apr 1982 to Mar 1998), `iip-industries-1980` (17 manufacturing groups
  to Mar 1994), `iip-annual-1980`. MoSPI's API does not serve this base. Seam registered.
- **Eight core industries** (DBIE 499, 989): `core-1993`, `core-2004`, `core-2011`, annual index
  and published growth. Ledger `core`.
- ISP annual: the services guide already bakes `services-isp-annual` from the same call; the
  `isp` ledger points at it and the iip guide lists it in downloads (no second copy).

## In progress

- Full MoSPI pull in the background (one call at a time, `logs/industry-queue.log`): every
  ASUSE indicator, then every ASI table of every NIC block (~34,000 calls, ~3.5 hours).

## Decisions

- Core industries: DBIE has annual tables only. The monthly index (OEA, DPIIT) is not in DBIE
  or the Data Bank, so the guide carries the annual record; monthly is a follow-up (new source).
- Core 1993-94 base: the RBI's 1994-95 growth rows are measured against the 1980-81 base's
  level (composite -55.5%). A splice across rulers: dropped (raw keeps them), disclosed. Rule
  checked generically for every base and industry.
- Core 1993-94 base, 2010-11: the RBI prints two sets of growth rows; only the full-year ("Y")
  set is baked.

## Source quirks

- MoSPI annual IIP, base 2022-23: API growth 6.8% (2023-24), 5.7% (2024-25), 4.3% (2025-26);
  annual levels equal the monthly means. Press summaries of the 1 June 2026 release quote 6.7%
  and 6.4% for the first two. The release PDF returned HTTP 403, so unresolved; flagged.
- DBIE 638 carries the 2022-23 base to Jul 2026 with Quick/Revised/Final versions; MoSPI
  remains the source of record.
