# review-b: launch read-through of the money and trade guides

Branch `lb/review-b`. Brief: `docs/briefs/review.md`. Read 2026-10-10.

## Pages read

All eleven, top to bottom, at 1440 and 390 (Playwright, Chrome), every plate title and
"How to read this" / "As of" note checked against the bundles, one share image downloaded
per guide and looked at:

external, trade, credit, deposits, rates, debt, housing, payments, banks, public-finance,
markets.

No console errors, no `–` placeholders left, no NaN on any page. Every in-page link and every
local download link resolved in the build. The "Finer detail" archive links (trade, credit)
point at the planned Hugging Face paths and were left alone.

## Fixed (21 commits)

Titles that said something the data does not:
- housing: "Since 2019, house prices have barely outpaced inflation". After inflation they
  fell from 2019 to 2023. The title is now computed from the current run of the real line
  ("Since Jan to Mar 2024, house prices have risen faster than inflation every quarter, but
  only just").
- housing: the 2022-23 city title and its As-of note named Chennai and Delhi by hand. Both now
  take the top and bottom city from the data (qc check moved to max/min).
- deposits: "by 2026 almost none [earned below 6%]" was 6.3%. Now "about one rupee in sixteen".
- external: the As-of note typed "four January to March quarters ... and three around the
  lockdowns". Now counted from the bars.
- public-finance: the states' revenue plate added the RBI's "tax receipts" and "non-tax
  receipts" beside the transfers they already include (parts summed to 142%). Own taxes and own
  non-tax revenue are now those totals less the transfers; the four parts add to 100.
  The title (42% from the Centre) was right and is unchanged.

Charts:
- deposits: two retired union territories (no data) broke the state sorts, so states after
  them sat out of order and showed as zero. Left out now. Bank-group end labels sat on the axis.
- external: REER/NEER axis stopped at 120 while the nominal index runs to 142. Rupee gap in May
  2024 now explained. FPI bar labels said "k cr".
- credit: a year-ago circle sat on a row name (axis now reaches below zero).
- banks: the deposits/advances panels were in the wrong order for the subtitle; small-group
  labels ran onto the axis; retail NPA peaks are labelled as peaks.
- rates: CRR/SLR plate started at 1949 against an axis tick at 1940 that floated off the chart.
- payments: cheque-centre lines are named on the chart, not by colour.
- markets: fund-house bars said "th cr"; industry plate subtitle said dots for bars.

Precision (the site rule, hand-written copy only; review-a owns the prose):
- payments counts in readable units ("2,366 crore" not "2,365.84 crore"), lakh crore to one
  decimal; housing, rates (CPI, real rates, benchmark shares), public-finance (GDP ratios,
  lakh crore), markets, trade lookup table (whole US$ million). qc checks moved with them.

Reader copy:
- Source notes on nine guides said "the owner's local mirror", "the Data Bank" or "baked by this
  site's credit guide". Now "India Atlas's archived copy of ..." or plain names.
- "Standard deviation" explained; "0 of the 77 banks" reads "None"; trade phone-heading title
  names the heading it is behind; banned phrase "in today's" removed from public-finance.

## Found, not mine to fix

Data (sent to the coordinator; confirmed and fixed at class level on lb/fix-oil):
- `trade-dbie-oil-volumes`: 1988-89 to 1997-98 were copies of 1998-99 to 2007-08 (DBIE 148).
- `payments-monthly-2004`: Aug 2006 to Jul 2007 were copies of Jul 2010 to Jun 2011 (DBIE 612).
- `payments-monthly-2004`: debit_cards and cards "all usage" lines are PoS only until 2011-03;
  ATM use is counted from 2011-04 (20x step). The page does not draw across it (it sums the
  PoS lines); the bundle needs a seam or split. Sent to the coordinator.
- To re-read after lb/fix-oil lands: trade #cb-crude and payments "Fifteen years before UPI".

Prose (review-a regenerates all of it, including my slugs): two-decimal rates and counts
throughout (credit, external, rates, payments, markets, housing); "the sheet" leaked into rates
and debt; housing's current reading contradicts itself on the BIS city cut and quotes a Delhi
figure (96.55) that is not the bundle's latest (96.22).

Shared components (not edited by me):
- `EveryCutTable.astro`: on debt at 390px the table is 417px wide and the page scrolls sideways
  (a long latest value). `.ec-wrap{overflow-x:auto}` would contain it.
- `GuideData.astro` at 390px uses only half the column width (rows wrap into a narrow strip).
- A minus sign before $ or ₹ can end a line in the reading notes. A blanket `white-space:nowrap`
  on `.now b` fixed that but widened the notes past 390px, so I took it out; it needs a no-break
  joiner in the shared number formatters instead.

## Checks

npm test 55/55, prose:dry clean, asof 464 paragraphs verified; final build and `npm run gates`
result below.
