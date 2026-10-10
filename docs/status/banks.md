# banks: India's banks one by one

Branch `lb/banks`, port 4434. Updated 2026-10-10.

## Done

- Adapter `scripts/lib/products/banks.mjs` (product `banks`, with `banks-ucb.mjs` and
  `banks-fi.mjs`), registered in `data/sources.yml` and `scripts/fetch.mjs`.
  `BANKS_FROM_RAW=1 node scripts/fetch.mjs only banks` re-bakes from the archive without
  calling the service.
- Sources: report 1221 and the Outlook grids (772, 784-789, 795-800) from the Reserve Bank
  Innovation Hub's service; the Outlook's typed tables (771, 773-777, 810-812) and the
  financial-institutions tables (382-398, 801, 873, 1372) from the Data Bank.
- 62 bundles (`banks-*`): 18 from 1221 (bank by bank and by bank group, eight tables,
  infrastructure split at its 2022 reclassification), `banks-shares` (derived),
  `banks-health` (bad-loan ratios by group: the current bundle) and `banks-ratios` (capital,
  returns, margins, deposit shares: the prose input), 22 for urban co-operative banks, 19 for
  the financial institutions. About 35,000 series.
- `validate.mjs` block: ranges, cadence, identities, cross-checks, hand-checked values.
- Catalogue (1,865 items) and ledger: 662 shown, 1,188 baked, 14 excluded, 1 blocked,
  nothing pending.
- Guide `/guides/banks/` (No. 26): 13 sections, 20 plates; build-time data module
  `src/dossiers/banks.data.js` embeds only what the plates draw (the bank-wise bundles are
  megabytes). Registry, headline and spark, OG card, register rows, qc PAGES (17 checks),
  20 as-of entries, slots, corpus, series keywords, every-cut cuts.
- Prose generated with DeepSeek for `banks` only and read against the data: every figure
  checked (1.82%, 2.31% a year earlier, 11.46% peak, public sector 2.11% and down 19
  quarters running, CRAR 16.59% up 0.49 point, SFB ROA 0.69% and ROE 6.38%, PSB deposit share
  57.03% down 0.56 point). One human edit: the first slot's last clause said the rest of the
  deposits sat "with private and foreign banks", leaving out small finance banks; the clause
  was cut, and verify, contract and lint re-run clean on the edited file.
- Draws three of the credit guide's bundles read-only: `credit-deep-branches-population`,
  `credit-deep-offices-bank-groups`, `credit-nbfc` (listed in my registry entry too).

- Gates (build under the shared lock): validate, coverage (strict), as-of, qc (17 number
  checks, every-cut lists all series once) and chart lint all clean; `npm test` 52/52;
  `prose:dry` clean. dist deleted after each run.
- Looked at 1440 and 390 px (Playwright, all 20 plates, no page errors, no horizontal scroll
  at 390); fixed by eye: labels that ran into bank names on the bank-by-bank plate, two label
  bleeds, a clipped axis label, a loss shown as "₹0.3 lakh crore". Share image of the bad-loans
  plate downloaded and read. OG card generated (only `public/og/banks.png` kept).

## Next

Nothing for this guide. Waiting on the coordinator's merge.

## Decisions

- Report 1221 prints amounts in thousands of rupees under a "Rs. Crores" header. Proved:
  every March equals the RBI's annual bank-wise table (report 336) to the crore in 1,790 of
  1,820 bank-years (the rest revised later), and SBI's March 2025 gross NPAs (₹76,880.20 crore)
  equal SBI's own results. Baked in ₹ crore.
- Banks are named as the RBI names them, keyed case-blind (the export switched from capitals
  to title case in 2022). Four rows are the same bank renamed and are joined: AB Bank Ltd to
  AB Bank PLC, Sonali Bank to Sonali Bank PLC, HSBC's two spellings, and the infrastructure
  table's "Scheduled Commercial Banks" row. Mergers are never joined: the merged bank's series
  ends; the acquirer's carries a `mergerNote` (SBI 2017, Bank of Baroda 2019, PNB, Canara,
  Union, Indian Bank 2020, DBS and Lakshmi Vilas 2020, HDFC 2023, AU and Fincare 2024,
  Slice and North East SFB 2025).
- Each bank's group is the group it was last listed in (IDBI Bank moved from public to private
  in 2019); a bank-group series is the RBI's own group row, so its composition changes with
  the RBI's lists. Disclosed on the page.
- Shares and the headline use domestic operations: the first five quarters (Dec 2013 to Dec
  2014) print no global figures.
- The all-bank row equals public + private + foreign + small finance banks (scheduled); local
  area banks and the non-scheduled small finance banks sit outside it (validate checks it).
- Infrastructure lending: the RBI replaced its R.a to R.f list with a renumbered list in June
  2022; two bundles each for banks and groups, registered as the `banks-infra` seam.
- Urban co-operative banks: two copies of the same Outlook, read apart and proved equal on every
  March both print (NPAs 180 values, indicators 108, balance-sheet shares 423, counts by CRAR
  band, rating and state). UCB names drift between editions; they are linked by content (each
  edition reprints the previous year's interest received, which must equal the earlier
  edition's for the same bank on two figures).
- The financial-institutions tables are read by a small reader of my own (`banks-fi.mjs`): their
  date columns ("2021-Mar-31", bare years) do not suit credit's generic reader.

## Source quirks (for HISTORY)

- 1221: the header says crore, the amounts are thousands of rupees. In some quarters the asset
  quality table's last variable (loss or gain on loan sales) has no header label; its columns
  are left out for those quarters, never guessed. Two printed NPA ratios (Krishna Bhima
  Samruddhi LAB, 2019) are twice what the table's own amounts give; kept as printed.
- The Hub's copy of report 798 (UCBs' bank-wise balance sheet) files nine copies of the 2024
  grid under the periods 2015-16 to 2022-23: only the 2015 and 2024 editions exist there, so
  bank-wise UCB balance sheets cover March 2014, 2015, 2023 and 2024. Editions are now dated by
  the years they print, and a repeated edition must be an exact copy.
- The Data Bank's Outlook tables 771, 773 and 774 stamp both rows of an edition with the
  edition's date: "Final" is the previous March, "Provisional" the edition's own. Read
  accordingly; proved against the grids (773's 2023-24 edition: NIM 2.99 Final = March 2023).
- 799 prints business and profit per employee in ₹ million, ₹ crore and plain rupees under
  labels that do not always say which: excluded. 812's four sub-groups carry no label: excluded.
- 777 stores counts of UCBs multiplied by 10 million (unit field "crore"); divided back.
- UCB balance sheet, March 2019: liabilities and assets differ by ₹107 crore as printed.
- Report 617 on the Hub is only the prompt page (no rows): blocked.

## Hand checks

- SBI gross NPAs, March 2025: ₹76,880.20 crore, ratio 1.82%: SBI's 2024-25 results report
  ₹76,880 crore and 1.82% (also report 336).
- All banks' gross NPA ratio, March 2025, global: 2.22% in 1221 and in the RBI's report 330.
- Insured deposits, March 2025: ₹1,00,12,064.5 crore in 384 = report 733's commercial plus
  co-operative banks; DICGC's Safety Net (issue 5) charts ₹100.12 lakh crore.

## Shared files touched

`data/sources.yml` (dossier and seam blocks), `scripts/fetch.mjs` (one import, one key),
`scripts/validate.mjs` (one block), `src/dossiers/registry.js`, `headline.js`, `everycut.js`,
`register.client.js`, `scripts/og.mjs`, `scripts/qc.mjs`, `pipeline/asof-manifest.json`,
`pipeline/slots.yml`, `pipeline/lib/series-kws.mjs`, `test/states-key.test.mjs` (the bank-wise
bundles declared "one row per bank", like credit's): one block each, marked banks.

## For the coordinator (framework)

- `pipeline/lib/periods.mjs`: quarterly labels assumed quarter-start months; a quarter-end axis
  (stocks as on 30 June, 30 September, 31 December) labelled every quarter "Q4". Fixed in
  general: any month of a quarter names it, and a Q label finds a quarter-end date when no
  start-month date exists. Start-month axes label exactly as before.
- The verifier's "highest/lowest of the sheet" guard compares across every series of the
  current bundle, so a bundle mixing measures cannot carry superlatives; split into
  `banks-health` (one measure) and `banks-ratios`.
- No India Data Hub series in the Data Bank matched these bundles (NPAs, CRAR, co-operative
  banks, insured deposits searched by name).
- State cut for the profiles: `banks-ucb-states` (urban co-operative banks by state, March 2014
  to 2024: number of UCBs, branches, deposits, advances, districts reached, extension counters,
  ATMs; each series carries `stateSlug`) and `banks-ucb-states-dbie` (number of UCBs by state,
  2019 to 2026).
- Registry number 26 taken; other DBIE-wave guides may collide.
