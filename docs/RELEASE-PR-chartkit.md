# Release: chart kit, page design v5, launch cleanup and performance

Branch `lb/chartkit` into `main`. It combines three lines of work:

- **Launch cleanup** (`launch-build` at 16dec093): reader text rewritten guide by guide; API zeros checked against the printed reports (UDISE dropout, AIDIS); qc masthead rule.
- **Performance and scale** (`lb/perf` at cc5a70c7): font split, search v2, Every Cut packs, Workers static assets deploy, perf gates.
- **Two source corrections** (owner-approved, 2026-10-17): farm-household API labels fixed against Report 587 (agricultural households own 0.876 ha, not 0.086); UDISE dropout baked from the printed reports where the API disagrees (the API's 2023-24 year was wrong).
- **Chart kit and page design v5**: every guide except investor participation now draws its charts at build time as finished SVG, three drawings per chart (desktop, tablet, phone). The pages use Newsreader and Libre Franklin, with a new masthead, front page and guides index.

## What a reader gets

| Guide | Longest phone task before | After | Total blocking before | After |
|---|---|---|---|---|
| CPI | 8,196 ms | ~300 ms | 9,075 ms | ~500 ms |
| Energy | 549 ms | ~110 ms | 15,622 ms | ~150 ms |
| Households | 550 ms | ~140 ms | 7,214 ms | ~110 ms |

The CPI guide's HTML and JS together fall from a 543 KB ceiling to 136 KB measured (gzip). Every Cut pages no longer load the chart script.

## Checked

On a full build of this branch (816 pages, 15,810 files, 3.4 GB), `npm run gates` passes. It covers:
- validate, the kit specimen lint, coverage and as-of freshness;
- qc;
- chart lint (2,615 drawings, at desktop and at 390 px);
- explore:verify;
- perf: fonts, byte budgets, search and the phone main-thread budgets.

`npm test` passes and `npm run prose:dry` runs clean.

## Budgets changed on purpose (`perf/budgets.json` `raised`)

- **Guide, state and register HTML is up.** Charts now arrive as SVG in the page. JS fell far more, and the JS ceilings were lowered with it.
- **CSS is about 1 KB higher site-wide** (kit.css plus the v5 page layer).
- **Phone ceilings are re-set from the kit's measured runs.** State profiles share one ceiling, and pages well inside the target are held to the target.

## Known and left open

- **Search:** "electricity generation" no longer lands on the energy guide. Its charts were retitled by finding, and the Ember series carry machine labels. It is marked as a known issue in `perf/search-queries.json`. The fix is reader labels for the Ember adapter.
- **Investor participation** still draws with Observable Plot. The old chart code (`src/charts/plumbing.js`, `plot.js` and `static.js`) retires once it is ported.
- **For the owner:**
  - Dropout on state profiles: the printed UDISE+ figures are now baked (Bihar secondary 29.5, 25.6, 6.9); whether profiles show dropout is yours to decide.
  - Decide on a slimmer pensions CSV.

## Before merging (docs/RELEASE-CHECKLIST.md)

Look at the front page, the CPI guide and two state profiles on a phone and a desktop. `deploy.yml` ships to Workers static assets on merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WxDfqBxrrapRpJQtB5auLG
