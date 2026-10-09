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

- **IIP guide**: §03 deep ledger now three retired rulers (1980-81 added); new §04 financial
  years on five rulers; new §07 the core eight (latest year by industry with weights; 31 years
  on three rulers against the IIP); misreading on the core; provenance rewritten. Prose
  regenerated (DeepSeek), verified (22 + 12 figures), read by hand: the brief now forces
  growth-rate counts to be called "accelerated"/"slowed" (the first draft said "17 rising
  against 15 falling", which read as output).
- **ASUSE, every table** (2026-10-10): all 44 annual indicators in both rulers, `asuse-tNN`
  (financial-year rounds) and `asuse-2025-tNN` (calendar 2025, its own seam), 73 bundles, 20,225
  series. Each series varies at most one of the five cuts (state, sector, activity, broad
  activity, establishment type), which is what a catalogue item is; the full crosses (630,011
  rows) are staged in `data/archive/staging/asuse/` rolling up to those bundles. Raw: per-table
  gzip in staging + committed `data/raw/asuse-index.json` (the 65 MB `asuse-records.json` is
  retired; it is in git history). Quarterly bulletin now to Apr-Jun 2026.
- **Factories guide so far**: what a factory job pays (emoluments per person by industry) and
  how big the plant is (persons per factory); the 2025 round: workers by trade (46 activities)
  and women's share by trade. Quarterly-bulletin text and the meta strip read their periods from
  the bundle (they had "Jan-Mar 2026" typed in).

## In progress

- Full MoSPI pull of every ASI table of every NIC block (one call at a time,
  `logs/industry-queue.log`, ~34,000 calls; page cache purged per table). Then: complete ASI
  bundles, the deeper ASI plates (4-digit classes, state by industry), factories prose.

## Decisions

- Core industries: DBIE has annual tables only. The monthly index (OEA, DPIIT) is not in DBIE
  or the Data Bank, so the guide carries the annual record; monthly is a follow-up (new source).
- Core 1993-94 base: the RBI's 1994-95 growth rows are measured against the 1980-81 base's
  level (composite -55.5%). A splice across rulers: dropped (raw keeps them), disclosed. Rule
  checked generically for every base and industry.
- Core 1993-94 base, 2010-11: the RBI prints two sets of growth rows; only the full-year ("Y")
  set is baked.

- ASUSE: the bake splits baked from archived by the cut rule above rather than by size, so the
  boundary is the catalogue's own definition of an item.
- ASUSE 2025 plates draw from a build-time pick (`#u25-data`): the table is 1.7 MB.
- The core-industries bundle is not a prose input: its summary mixes index levels and growth
  rates, which invited the writer to compare unlike figures.

## Source quirks

- ASUSE table 9: MoSPI relabelled the headline row ("Maintaining Bank/PO Savings Account" is
  now "Maintaining any kind of  Account in Financial Institutions", double space as served);
  the values are unchanged (666, 710, 761). Mapped; label updated.
- ASUSE tables 1 and 2 now carry a measure dimension (count and percentage of establishments).

- MoSPI annual IIP, base 2022-23: API growth 6.8% (2023-24), 5.7% (2024-25), 4.3% (2025-26);
  annual levels equal the monthly means. Press summaries of the 1 June 2026 release quote 6.7%
  and 6.4% for the first two. The release PDF returned HTTP 403, so unresolved; flagged.
- DBIE 638 carries the 2022-23 base to Jul 2026 with Quick/Revised/Final versions; MoSPI
  remains the source of record.
