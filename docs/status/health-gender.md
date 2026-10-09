# health-gender: status

Session atlas-health-gender, branch `lb/health-gender`, port 4425. Brief: `docs/briefs/health-gender.md`
(wave 2). Guides: `nfhs` (Family health) and `gender` (Women and men).

## Done

- **NFHS, every cell baked** (2026-10-10). 21 tables x two rounds x India and every state and UT x
  total, rural and urban: 22,698 series in 37 bundles (`nfhs-4-<table>`, `nfhs-5-<table>`; five NFHS-4
  tables have nothing left to bake, see below). The two rounds are two rulers (`sources.yml seams: nfhs`),
  each a single-date cross-section, never joined into a series. Bracketed fact-sheet values (25-49
  cases) are now baked and flagged `caution`; the old adapter silently dropped about a thousand of them.
- **MoSPI's API misfiles NFHS-4 values.** In tables 6, 14, 16, 19 and 20 the NFHS-4 column is
  shifted against the labels, identically in every state: women's bank accounts 3.3% (the NFHS-5 report
  says 53%), violence in pregnancy 57.6% (DHS: 3.9%). The old guide printed "3% to 79%" and "46 to 29
  per cent" from these, and validate.mjs asserted the false bank-account jump. 10 such NFHS-4 lines are
  withheld, and 15 more where NFHS-4 measured a different age group or question (blood pressure, sugar,
  tobacco and alcohol at 15-49; cancer examinations). Table 8 (maternity care) was shifted the same way
  in the 2026-08-10 dump and is **correct** in the 2026-10-10 re-fetch, so MoSPI fixes lines without
  notice: each quarantine now records the value it was withheld for (`served`) and the bake stops if
  MoSPI serves something else. Evidence in the adapter's `QUARANTINE`; re-proved on every bake against
  the DHS Program's tabulation (`data/raw/nfhs-dhs-crosscheck.json`, 58 agreeing pairs). Notes:
  `docs/reference/nfhs.md`.
- **Gender compendium, all 154 indicators baked** (2026-10-10). Fresh full fetch (about 600 MoSPI
  requests, no failures), 24,835 series in 180 bundles (`gender-t<code>`), split by instrument where the
  compendium joins two: census and NSS literacy, three PLFS rulers, ESAG and UDISE+, NFHS rounds,
  cumulative and yearly start-ups. Projections marked `estimated`. Every bundle names its source agency
  and compendium table (from the 2025 PDF). The 12 codes in MoSPI's MCP definitions the API no longer
  serves are in the catalogue and `blocked` (No Data Found, 2026-10-10). Notes:
  `docs/reference/gender-compendium.md`.
- **Ledgers, nothing pending.** nfhs: 11,152 items, 1,188 shown, 7,255 baked, 2,709 excluded (each
  with a reason: misfiled, different age group, not in that round, place not in that round,
  suppressed). gender: 4,840 items, 340 shown, 4,488 baked, 12 blocked. Both written by generators
  (`scripts/lib/products/nfhs-ledger.mjs`, `gender-ledger.mjs`) whose plate tables mirror the pages.
- **Both guides rebuilt.** Family health: 20 plates (what changed, anaemia and by state, children,
  vaccines, births and caesareans by state, blood pressure and sugar, cancer screening, women's
  money and phones, violence, tobacco, household, fertility and family planning, village and town,
  a twelve-measure state table). Women and men: 23 plates (sex ratio at birth and by state, census,
  infant and maternal deaths, life expectancy, fertility by schooling, marriage, school and literacy,
  work on three PLFS rulers, participation and wages by state, time use, money, Lok Sabha and office,
  crime, convictions, causes of death). Both now carry generated prose (`factsModule`, below).
- validate.mjs: family blocks for both (unit ranges, round bases and dates, total-between-rural-and-
  urban for 7,065 NFHS triplets, shares summing to 100, census low point, women outliving men, the
  compendium's NFHS reprints matching the NFHS bundles).

- **launch-build merged** (c683ad4) and both families re-fetched through the new `mospiAll`: no
  "pages slipped" warnings for either. Gender came back unchanged. NFHS changed only in table 8 (above).
  Series keys are now independent of the API's row order (the August key order swapped two vaccine
  series between fetches); only `nfhs-4-maternity` takes a new vintage, since its data changed.
- Gates at the final commit: astro build, `npm run gates` (validate, asof, qc, chart lint, coverage),
  `npm test` (34 pass), `npm run prose:dry`, all green. Prose generated with DeepSeek for both guides
  and read by hand against the data; two drafts were wrong and were fixed at the source (the facts
  sheet once picked NFHS-4's "tried to quit tobacco" for "uses tobacco"; a reason string said "new in
  NFHS-5" for lines NFHS-4 did measure). Looked at 1440 and 390; share images downloaded from both.

## Decisions

- Two rounds, two bundles: the brief's "never a trend line through two points". Plates use
  dumbbells (grey NFHS-4, blue NFHS-5); the home spark and OG card stay a labelled before-and-after,
  now read from the bundles (the old OG card hardcoded 58 and 67).
- Withhold, never repair, the misfiled NFHS-4 lines. The shift is clear, but re-mapping values by
  inference is filling from judgement. The compendium's correct NFHS-4 reprints (unmet need 12.9,
  spousal violence 30.9) are baked in the gender guide and cited from Family health.
- Prose for survey guides: `pipeline/facts.mjs` hands a registry entry with `factsModule` to that
  module (`pipeline/lib/facts-health-gender.mjs`), which assembles the sheet in the usual shape. No
  series-keyword map: streak and record claim checks do not apply to cross-sections; every figure is
  still traced.
- Copy figures are computed at build time from the bundles (`nfhs.data.js`, `gender.data.js`), as
  the ILO guide does; the client only draws. Shared helpers: `src/dossiers/health-gender.charts.js`.

## Shared files touched (for the coordinator)

- `scripts/lib/net.mjs`: an optional `headers` option on `requestOnce` (the DHS API refuses requests
  without a User-Agent). Additive; no other caller changes.
- `pipeline/facts.mjs`: the `factsModule` hook (one block after the registry lookup).
- `src/dossiers/headline.js`: `SPARK` accepts `rounds` (one point from each of two bundles).
- `src/dossiers/register.client.js`: the gender and NFHS rows now read the new bundles.
- `src/dossiers/everycut.js`: one block of units, and per-bundle cut names and period labels read
  from bundle meta (`healthGenderMeta`). Old nfhs/gender lines removed. One logic line in `rowsOf`:
  an estimated latest value marks its change as estimated even when the frequency shows no change
  (the test failed on census-year projections).
- `scripts/validate.mjs`, `scripts/qc.mjs`, `scripts/og.mjs`, `data/sources.yml`, `pipeline/slots.yml`,
  `pipeline/asof-manifest.json`: my entries replaced or appended.

## Not done / next

- On phones the state strips scroll sideways (the site's rule for full plates). A narrower mobile
  rendering would read better; that is a shared-chart decision, so it is left as is.
- NFHS-6 has not been released; when it is, it becomes a third ruler (`nfhs-6-*`) beside the two.

## Data quirks for other owners

- None of other families' bundles needed changing.
