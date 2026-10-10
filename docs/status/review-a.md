# review-a: launch read-through

Pages: cpi, wpi, iip, factories, manufacturing, gdp, services, states, jobs, ilo. Also the
site-wide precision rule for prose (brief item 3). Branch `lb/review-a`, October 2026.

## How the pages were read

- One build in a slot. Playwright with Chrome at 1440 and 390. For every guide: full-page
  screenshots, the page text, unfilled `–` placeholders, NaN, horizontal overflow at 390
  outside the sideways plot zones, missing in-page anchors, internal link status, console
  errors. All ten were clean on overflow, links, anchors and errors. The only `–` left are
  real empty table cells.
- Then each page's text was read top to bottom, and every typed claim was checked against
  the bundles.

## The precision rule (site-wide)

- `pipeline/lib/precision.mjs` and `src/dossiers/precision.js` hold the rule. Growth, rates
  and shares are written at the precision the agency publishes: one decimal everywhere, two
  for WPI (the OEA prints two) and for `rates` (basis points matter). Counts and money go in
  readable units: at most one decimal on a lakh, crore, million or billion figure, and none
  from a thousand up ("about 2,366 crore").
- `facts.mjs` reads every bundle with its rate series already rounded. Deltas are therefore
  what a reader computes from the published figures: 7.8 against 8.6 is 0.8, never the 0.7
  you get from 7.82 and 8.56.
- The writer is told the rule. `verify.mjs` rejects a finer figure. `contract.mjs` accepts
  the whole-number form of a large required figure.
- CPI: MoSPI's press release prints two decimals. The brief asked for one, as RBI statements
  do, so the site uses one. To switch, edit the one table in `pipeline/lib/precision.mjs`.
- My ten pages show rates at the same precision. They round once, as the bundles load, so
  every delta and spread on screen matches the figures beside it. The qc checks follow.
  Plate CSVs carry the displayed precision; the guide data downloads keep the full figures.

## Prose pipeline fixes found while reading

- A deep cut holding several measures (participation, worker ratio and unemployment; factory
  counts beside rupees) is now ranked within each measure. Before, jobs called rural women's
  3.9% unemployment "the lowest reading" of a cut that also held participation rates.
- `spread` in `proseInputs` was the spread of year-on-year *changes*. GDP's writer called it
  "the spread across the eight industry groups" (25.6 points; the true range was 14.5). It is
  now `spreadOfChangesOnAYearAgo`, beside a new `rangeOfLatestReadings`.
- "the sheet" and "facts sheet" are banned (review-b found them on rates and debt). The writer
  is told not to use bookkeeping words ("the age cut", "those worker series") and that the
  rate which sped up most is not the one that grew most.
- Prose regenerated (DeepSeek), every file read by hand: all slots that failed the rule or
  read badly. That covers my ten guides and banks, consumption, credit, external, farms,
  gender, housing, markets, nfhs, payments, population, poverty, public-finance, rates and
  debt. WPI's "what the print says" was rejected twice on regeneration and keeps its earlier,
  valid text.

## Fixes on the pages (truth first)

- **cpi**: the 2024 base has twelve divisions, not thirteen (in five places). Retired-plate
  notes are in the past tense ("the base-effect gift expires by spring" was written in
  January). The farm-wage gap is stated as an average gap, not "a month". Sentence-start
  numerals are now words, and zero reads "none". The rural/urban division gap reads "the same
  rate in both", not "0.00 points".
- **wpi**: the 2011-12 plates were written as if April 2026 were now. They are in the past
  tense now and point to the new base. "What this measures" no longer says the basket is
  2011-12. Citation and colophon name the current print (they named April and promised a
  June revision). The food lag reads "with no shift", not "shifted 0 months later".
- **iip**: the "fastest and slowest" plate kept wood products as a laggard after it turned to
  +8.6%. Its four lines are now chosen from the data: the two fastest and two slowest
  industries by twelve-month average growth. Notes saying March 2025 was never loaded
  contradicted the data (it was loaded) and are gone. The ISP grid footnote and table no
  longer say "fourteen months" and "May 2025". "As they have through 2026" is cut, since
  mining is contracting. Section references corrected.
- **manufacturing**: the plate title said three falls; the data has four (2022, −1.7%). Falls
  are now counted. "The highest since the early 2000s" for the 2024 export share was wrong:
  2015 to 2021 were all higher. It is now computed ("the highest since 2021").
- **gdp**: eight "As of November 2025" notes on the old base spoke in the present ("today's
  8.2", "the wedge has nearly closed", "agriculture's second good year"). They are now past
  tense and anchored to Q2 FY26, the old base's last quarter, and point to the new base.
  "Constant 2011-12 prices" now names the current base. The engine small multiples had no
  scale at all; each panel now prints its low, its high and the zero rule.
- **services**: the ISP plate title is counted (ten of the nineteen growing in double digits;
  repair services *and* air transport shrinking, not air transport alone). The "every month
  of the record" claim is computed.
- **states**: lakh crore figures at one decimal; sentence-start numerals.
- **jobs**: "no fifteen-month bulletin" (it is seventeen months old); "halved" became "nearly
  halved" (6.0 to 3.2); typed participation figures in a misreading are gone; numerals.
- **ilo**: the women's participation plate said the ILO flags no year as a survey reading.
  2010 is flagged, but the flag sits on the ILO's twin "aggregate" series. Flags are now read
  from the twin when the values are identical. Also "between 2.1% to 3.8%".
- **factories**: colophon section references corrected; numerals.
- Arrows print "unchanged" for a zero move (jobs' register showed "▲ +0.00 pt").

## Found, not fixed (for the coordinator or owner)

- **GDP's order**: after the current reading, the guide still leads with old-base plates
  (to Q2 FY26). The new base sits near the end, in §14. The notes are now honest, but the
  guide would read better with §14 moved up. That is a structure decision, so I left it.
- **Phone dot strips**: at 390, dot and bar strips with wide label margins (services growth
  and ISP, the CPI state strips) open on their labels, with the data off to the right. This
  follows DESIGN.md §3 and the shared `guide.client.js`, so I left it. A phone-width variant
  for categorical strips would help.
- **EveryCut**: "1 files" pluralisation in the shared component (furniture, review-c).
- **Annual titles still typed**: services' "Air travel, storage and phones grew fastest" and
  "Over a full year, shops, hotels and repair grew most" are true for the latest year
  (FY25, FY26). They will need a re-read when the next year's detail lands.
- **Consumption prose** says "1.7 times ... against 1.71": two precisions for one ratio. It
  is legal under the rule but reads oddly. Review-c's page.

## Routed from review-c (via the coordinator)

- **Headline figures** (`src/dossiers/headline.js`: home page, guides index, RSS). CPI, GDP,
  IIP and bank NPAs now show one decimal. Factories and AISHE counts show one decimal of a
  lakh or crore. UPI payments are whole ("2,366 crore"). Population is in crore
  ("143.8 crore"), as the rest of the site counts people. WPI and rates keep two decimals.
  qc's home-page checks follow.
- **Share cards** regenerated for cpi, gdp, wpi, iip, jobs, factories and population
  (`OG_ONLY`, the same lines as on lb/review-c). Two cards drew retired series: WPI the
  2011-12 base, and jobs the original design's urban bulletin, which ended in December 2024.
  Both now draw the current series. Card footers lose their middle dots.
- **"CPI is final on release, never revised"** was false. MoSPI prints the latest month as
  provisional and the previous month as final. Checked against two releases. On the 2012
  base, 12 April 2024: "Mar. 2024 (Prov.)", "Feb. 2024 (Final)". On the 2024 base, the
  July 2026 release: "July, 2026 (Provisional)" with a section "June 2026 (Final)". So the
  rule holds on both bases. Corrected on the CPI, WPI and GDP guides, the method page, the
  revisions and noise-and-trend learn pages, the GDP corpus, `sources.yml` (CPI
  revision_policy) and the CPI adapter's comment. The CPI guide now tells the reader that
  the latest month is provisional and the one before it final.
- **Data-level, not mine to rebake**: `data/series/cpi.json` and `cpi-2024.json` (and the
  other CPI bundles) still carry `meta.revisionPolicy: "CPI is final on release; never
  revised."` from the old `sources.yml` text. They will pick up the new wording on the next
  bake. CPI-AL/RL and CPI-IW keep "final on release" in `sources.yml`. I did not check the
  Labour Bureau's practice, so they are left as they were.

## Build-time bugs found and fixed

- `src/dossiers/precision.js` first imported `unitOf` from `everycut.js`, which imports
  `node:fs`. In the browser the CPI page script threw ("i.join is not a function") and qc
  caught it. `unitOf` now lives in `src/dossiers/units.js`, which has no node imports, and
  `everycut.js` re-exports it.
- The rebuilt IIP industry plate let two data-chosen end labels bleed past the plot. The
  right margin now fits the longest label.
- `test/figures.test.mjs` expected "US$" in the external prose; the new prose writes "$". The
  test now accepts both. New `test/precision.test.mjs` covers the rule.

## Checks (final, 2026-10-10, after merging launch-build 46090dd)

- `npx astro build` then `npm run gates`, in a slot: exit 0. QC passed, chart lint clean
  (855 SVGs, 87 pages), as-of 464 paragraphs verified, prose fresh 52/52. `./dist` deleted.
- `npm test`: 62 passed, 0 failed. `npm run prose:dry`: exit 0. verify, lint and contract
  pass on every `pipeline/out/prose-*.md`.
- Playwright on the final build, all ten guides: no overflow at 390 outside the sideways
  zones, no broken internal links or anchors, no console errors. The only `–` left are real
  empty table cells. One share image from each guide downloads as both PNG and SVG; the CPI
  and GDP PNGs were opened and read.
- "Finer detail" Hugging Face links: one, on ilo (`huggingface.co/datasets/bebhuvan1/india-atlas-archive/tree/main/tables/ilo`). It points at the planned path and will 404 until the upload. Kept, as the brief asks.
