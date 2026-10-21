# UPI and NPCI's networks (guide 38 on this branch, /guides/upi/)

Branch lb/npci, worktree atlas-worktrees/npci, cut from lb/chartkit bfc1ef70 on 2026-10-20. Not
committed, not deployed. lb/next also numbers its environment guide 38; renumber at merge.

## Source decision

- NPCI's own statistics only. payments.report was not read or scraped (owner instruction: not yet
  trusted), and no third-party mirror stands in for any NPCI figure.
- Read from the local Data Bank, which captures the JSON API behind npci.org.in (its connector
  `src/databank/connectors/npci.py`, notes `docs/NPCI_SOURCES.md`). Three datasets, each from its
  latest warehouse publication (`databankWarehouse` in `scripts/lib/databank.mjs`, a new helper over
  `databank warehouse sql`), so no row repeats across parse runs.
- Capture of 11 October 2026: UPI, AePS, NACH, CTS to September 2026; IMPS, NETC, e-RUPI and UPI
  apps to August 2026; BHIM to July 2026; daily tables to 8 October 2026.
- **Refresh is blocked.** Since about 12 October the Data Bank's daily NPCI update gets an F5/Akamai
  bot challenge instead of JSON (its logs in `logs/update/*_npci.log`). On 2026-10-20 the API, the
  HTML pages, headless Chrome and a full Chrome under a virtual display were all refused or served a
  blank page. New months reach the guide only when the Data Bank can capture them again; nothing is
  filled by hand.

## What was built

- Adapter `scripts/lib/products/npci.mjs` (product `npci`, dossier `npci` in sources.yml), 19 bundles,
  `data/raw/npci.json.gz` (every row read, 2.7 MB). Counts and rupees (NPCI's million/crore/lakh
  times a power of ten). Vintage = the Data Bank capture date.
- Rulers kept apart (sources.yml seams): BHIM to March 2020 vs from April 2020; CTS three grids vs
  national grid; apps from December 2020; MCC from December 2016.
- Printed state and district shares that contradict NPCI's own volumes are withheld as gaps (111
  state cells, all of March 2026 printed as fractions plus some April 2026 and April-May 2025; 1,284
  district cells in March and April 2026). Charts compute shares from volumes.
- Validation (`scripts/validate.mjs`, npci block): P2P+P2M = total; the two UPI tables agree (April
  2023 declared); every app's total = customer+B2C+B2B (or + on-us, as NPCI did for some apps to
  early 2024; four declared slips); states + unclassified = UPI (May 2026 declared); printed shares
  = volume / sum; districts = their state; MCC rows = total; segments = total; NACH presented =
  returned + successful on every line (NPCI slips named month by month); total credit = seven
  sub-products; mandates; AePS (three declared months); CTS return rate; daily rows = monthly tables
  (22 named month-measures); NPCI UPI within 2% of the RBI (worst 0.41%).
- Guide: `src/pages/guides/upi.astro`, model `src/dossiers/upi.model.js` (every number and every
  claim-bearing title computed), charts `src/dossiers/upi.charts.js`, 26 plates, deterministic
  current reading (prose: false), 26 governed As-of paragraphs.
- Coverage: `data/coverage/npci.catalogue.json` (5,560 items) and `npci.yml`: 1,331 shown, 4,220
  baked, 3 excluded, 6 blocked (NPCI tables not captured: the tab catalogue, the UPI ecosystem
  archive, RuPay, NFS monthly, Bharat Connect, UPI member-bank performance).
- Kit: `freq: "day"` labels in `tlabel` and the hover (`enhance.js`).
- Search: labelled queries for UPI, UPI apps, PhonePe, FASTag, EMI bounce, UPI by state.

## Findings worth knowing

- NPCI's "Unclassified" (no state) share of UPI rose from 13.1% (April 2023) to 44.2% (September
  2026), so state UPI trends are not comparable over time; the guide shows states one month at a time.
- About a quarter of NACH debits (EMIs, SIPs, bills) are returned unpaid; 45% in June 2020.
- PhonePe and Google Pay: 78.3% of app-table payments in August 2026, 78.6% in December 2020.

## Not done

- The uncaptured NPCI tables above (needs the Data Bank capture to work again).
- Districts as a map (no district geometry in the kit); districts are a ranked plate and every-cut.

## Checks (2026-10-21, on the final build)

- `npm run gates` with `ATLAS_CHROME_CHANNEL=chrome`: validate, kit specimens, coverage, as-of (523
  paragraphs), QC of every figure on /guides/upi/ (the model's numbers, plus the title block recomputed
  from the bundles alone), chart lint at desktop and 390 px (clean), masthead, explorer, SEO, size
  budgets and search (including the new UPI queries) all pass. The browser timing step flagged
  /guides/time-use/ (267 ms against 262 ms) under load; re-run with one worker and five runs it
  measures 147 ms, i.e. contention. /guides/upi/ measures 86 to 93 ms.
- `npm test` 341 of 341; `npm run prose:dry` clean (no LLM slots on this guide).
- Chrome at 1280 and 390 px: no page errors, no sideways scroll.
- Hand traces against NPCI's tables: UPI September 2026 (24,068.38 million, ₹29,37,396.67 crore),
  Maharashtra September 2026 (2,364.509006 million, 9.82%).
- Budget raises recorded in perf/budgets.json `raised` (guides index HTML, states page JS).
- Two further NPCI slips found while charting and named in the bundle notes: the ATM network on
  1 October 2021 (about eleven times its neighbours; not drawn) and NACH mandates February 2023 (a
  digit missing from the rejected count; no rate drawn). The Paytm app's two 2024 spellings are
  joined; Jupiter and Jupiter Money stay apart as NPCI lists them.

## Growth plates (2026-10-21, owner's go)

Two plates after the monthly chart: UPI's growth on the same month a year earlier (number and value,
from April 2019; earlier years grew more than tenfold and would flatten the rest), and small panels of
the same growth for UPI, IMPS, paid FASTag trips and NACH debits from April 2022 (past the lockdown's
base effects and FASTag's compulsory rollout, when its growth reached 1,500%). Month-on-month change is
deliberately not charted: it mostly measures the calendar (February's missing days, festivals, March).
FASTag's paid-trip growth after August 2025 understates use because annual-pass trips are counted apart;
the plate says so.

## Chart downloads as designed cards (2026-10-21, site-wide)

Owner: downloaded images looked bare (no margins, Arial, no brand). Every chart-kit plate on the site
now downloads through `src/kit/card.js`, loaded only on a click: the mark and site name, the guide's
name, the title in Newsreader with the plate's headline figure, the subtitle, the 720 px drawing, the
source and the chart's own address, 44 px margins, the site's faces embedded (PNG at 2x and SVG).
Checked on the UPI guide (line, small multiples, a tall two-panel bar chart) and a learn page (stacked
drawings); the SVG renders in its own faces outside the site. The dynamic import costs about 200 B of
preload helper in the shared chart script; /guides/climate/ and /guides/rates/ sat at their recorded
JS ceilings and are raised 9 to 10 KB (perf/budgets.json `raised`). DESIGN.md §0.3 notes the card.
