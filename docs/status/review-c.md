# review-c: the launch read-through (my share)

Branch `lb/review-c`. Brief: `docs/briefs/review.md`. Pages: consumption, aishe, gender, nfhs, mnre,
poverty, population, climate, farms; the 36 state profiles; the site furniture.

## How I read

One build, then Playwright (Chrome) over every page at 1440 and 390: full-page tiles, the page text,
any element wider than the screen, leftover "–" placeholders, NaN, console errors. I read each guide's
text top to bottom against its bundles, checked the typed claims against the data with small scripts,
and looked at every tile at 1440 and at the 390 tiles as 4-up montages. No page overflows at 390 (the
sideways plot zones aside); no placeholders, NaN or console errors on any page I own.

Read in full: the nine guides; Bihar, Kerala, Maharashtra, Delhi and Ladakh; home, guides index,
register (Indicators), learn index and all 20 learn pages (text), about, method, 404, RSS, sitemap,
the `/dossiers/` redirects, OG cards. Search: twenty real queries (below).

## Fixed

Site-wide
- Phone: a sideways plot whose x axis is not time (dot strips, bars) opened on its names with no hint
  that the dots lay off-screen. It now carries a "More of the chart to the right →" cue until the
  reader reaches the end (`guide.client.js`; DESIGN.md §3 updated).
- Every-cut: a "remaining files" group holding one file now shows that file's own title and "One
  file" (it read "1 files").
- Search: synonyms for words readers type (forex, MSP, heatwave, stunting, anaemia/anemia, home,
  salary, monsoon, poor, loans). "forex reserves", "wheat MSP", "heatwave" found nothing useful before.
- Learn pages whose charts draw a retired ruler (CPI base 2012 to Dec 2025; GDP at 2011-12 prices to
  Jul-Sep 2025) now say so in a note at the top and point to the guide with the current figures
  (`learn/registry.js` `ruler`, `layouts/Learn.astro`). The base-year, index-numbers, index-weights,
  real-vs-nominal and per-capita pages described the 2012/2011-12 bases as current: rewritten for the
  2026 rebasing.

Furniture
- Home: rates at one decimal (CPI, GDP, IIP), comparisons made on the figures shown ("a little slower"
  only within a point), IIP says "shrank" when negative; sources line lists every kind of source the
  site now uses.
- Method: the sources section described a MoSPI-only site and "headline CPI computed by us" (true only
  of the retired 2012 base); base-year margin note said CPI 2012 and GDP 2011-12. Rewritten; dated
  October 2026. About: the build sentence and the list of subjects. 404 title had an em dash. Learn
  index title was lower-case. Register footer said "MoSPI via eSankhyiki".
- Register (Indicators): three guides (manufacturing, farms, markets) had empty tables; GDP showed the
  retired 2011-12 series as "Real GDP" with a Nov 2025 vintage; hand-typed vintages (CPI 2024, IIP,
  PLFS, MNRE, deposits) had gone stale. All now read from the bundles; GDP leads with the 2022-23 base.
- OG: site card at one decimal; profile cards no longer say "NFHS-5" (they use NFHS-6). `og.mjs` takes
  `OG_ONLY=site,profiles` so a session can render just its own cards.
- State profiles: CPI figures at one decimal (were 4.22%); "₹100 … cost about ₹104"; the pupil-teacher
  sentence; misreading 2 typo; misreading 3 typed survey years (stale since NFHS-6) made period-free;
  the GSDP growth chart labels its newest bar as the latest estimate; header "Data to 2026-10-10" (a
  fetch date) now "Updated 10 Oct 2026".

Guides
- farms: the procurement plate's title read "The government buys about 0% of India's rice and wheat"
  (a fraction printed as a per cent). It is about 31%, "a third". Dropped an unsourced China yield claim.
- mnre: growth "238%" was computed across the Dec 2023 large-hydro seam the page says it never
  crosses; now large hydro is left out (178%). Typed multiples were wrong or stale ("quadrupled",
  "nine-fold" for rooftop: it is thirteen-fold; "37 GW to 162 GW"; "Rajasthan 43 GW"): now computed at
  build time. A wind misreading built on an unsupported repowering claim replaced by a real one
  (rooftop is not only homes). Register rows at one decimal; small states' labels in MW, not "0.0 GW".
- consumption: "the largest moves are all food" was false (fuel and light fell 0.6 pt rural and is the
  largest move in towns); the edible-oil sentence muddled the price direction. Gini note comma splice.
- aishe: a raw `<span class="pc">%</span>` leaked into the reading text; counts in crore and lakh, not
  "4,32,68,181"; "About 28 of every hundred Indians of college age were enrolled" contradicted the
  guide's own misreading (GER counts enrolments); "a third of all enrolment" (it is 27%); "the two
  reserved categories … under a third" (OBC is reserved too); GPI "moved from 1.01 to 1.01";
  "Plate 9" that does not exist; a margin note about a corrupted download; PTR "librarians in the
  denominator". Plate 7 drew men's and women's bars on top of each other: now side by side. Axes and
  labels in lakh, not "k"; a tick past the domain drew off the plate. CSV header typo.
- gender: nine states' rural casual wage for women printed as "0" (the table's 0 means no estimate):
  left out and named. Census sex-ratio axis ticked 1959, 1967…: now the census years. Life expectancy
  end labels showed the projection (74.7) beside a title quoting 72.5: now the last measured year.
  Lok Sabha 13.7% vs 13.6% explained (542 seats polled vs 543). Crime axis in Indian digits. Delhi
  misreading no longer asserts unsourced causes.
- nfhs: NFHS-6 (2023-24) India figures were baked but the guide never showed them. New section 02,
  "The newest round, NFHS-6": NFHS-5 beside NFHS-6 for 24 measures, as the NFHS-6 fact sheets print
  them (asof-manifest entry `nfhs#cb-nfhs6`). Lede and the "trend" misreading updated. "Puduchery"
  (MoSPI's spelling) shown as Puducherry.
- climate: "1996-25" now "1996-2025" everywhere (a window across a century); warmest and driest years
  say their order; the projected-warming axis label no longer sits on the last tick; rainfall subtitle
  says what the blue bars are.
- poverty: the every-measure table printed "0.7700"; now "0.77".
- population: read in full; no change needed.

## Search, twenty queries (before the synonyms)

Good: onion prices, GDP growth, unemployment rate women, repo rate, UPI transactions, rice production,
rupee dollar, petrol, gold imports, college enrolment, solar capacity Rajasthan, poverty line,
population 2050, home loans, Tamil Nadu GSDP. Poor: "inflation in Kerala" ranks CPI-AL/RL rows above
Kerala's CPI (ranking, not fixed); "forex reserves", "wheat MSP", "heatwave", "child stunting Bihar"
(synonyms added).

## Found, not mine to fix (sent to the coordinator)

- Data: `gender-t087-cy25` stores 0 for "no estimate" (nine women's rural wages): should be null.
  `mnre-sources.large_hydro` is 0 before Dec 2023 (not counted then: null). `mnre-solar-categories`
  hybrid and off-grid start at 0 in Jan 2020 (check: real zero or not yet reported).
  `external-debt-annual` "E.9 Forex Reserves - Total Debt Ratio" carries a money unit (search shows
  "$0.10 bn"). HCES state bundles' titles carry key jargon ("Keys <state>_<sector> are …") that the
  every-cut links print: move it to `meta.note`.
- `headline.js` precision (home, guides index, RSS, OG): CPI 4.82%, GDP 7.82%, IIP 7.97%, WPI 9.92%,
  UPI "2,365.84 crore", population "1.438 billion" (crore elsewhere). Generated prose in my guides
  also carries two decimals (consumption 47.04%, nfhs 67.12%, population 28.06 years, "979,000"): the
  site-wide precision rule is review-a's.
- CPI "final on release, never revised" (cpi guide, method margin note, learn revisions and
  noise-and-trend): MoSPI's releases print the previous month as final and the current as
  provisional, as I remember them. Needs a check against a release before anyone rewrites it.
- NFHS guide: its plates still compare NFHS-4 and NFHS-5. Rebuilding them on NFHS-6 (which has no
  anaemia or mortality) is a family-sized job.
- Registry: mnre `register.unit` types "Jan 2020 to Jun 2026" (data runs to Jul 2026).
- The site has no contact address, though Method says "write to us".

## Checks

- All 36 profiles and the states index at 390: no overflow, placeholders, NaN or console errors.
- `npm test`: 58 pass. `npm run prose:dry`: clean. `npm run gates` after merging launch-build
  (46090dd): QC all checks passed, chart lint clean (856 SVGs). The final build, with the last label tweak, re-ran the gates: QC all passed, chart lint clean. `dist/` deleted.
- No prose regenerated: the generated slots in my guides are review-a's precision pass.
