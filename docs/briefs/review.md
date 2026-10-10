# Brief: the launch read-through (`review-a`, `review-b`, `review-c`)

The data build is finished: 30 guides, 36 state profiles, about 1,150 pages, every gate green,
`coverage --strict` clean, every prose figure traced. Gates prove numbers exist and charts
don't collide; they cannot prove a page reads well, says what is true, or helps a reader.
That is this pass. Read `docs/briefs/README.md` (the session contract) and
`docs/RELEASE-CHECKLIST.md` first, then `docs/GOAL.md` for what a guide is for.

## What to do, for each page you own

Build once in a slot, keep the build only while you look, then delete `./dist`. Look at every
page at **1440px and 390px** (Playwright with `/usr/bin/google-chrome`), and read it top to
bottom the way a curious Indian reader would.

Check, and fix in place where the fix is copy, a label, a title, a layout or a chart detail:
1. **Truth.** Every plate title, "How to read this" and "As of" note says something the chart
   on screen actually shows, for the latest data. A title that states a finding must be
   computed from the data, not typed. Any claim that has gone stale is rewritten from the data.
2. **The reader.** Plain Indian English, no jargon left unexplained, no AI tells
   (`pipeline/banned.txt`), no em dashes. Every section connects the number to how people live.
3. **Precision.** Headline growth, rates and shares at the precision the agency publishes (one
   decimal for GDP growth, CPI and PLFS rates), unless the extra decimal is the point. Counts
   in readable units ("about 2,366 crore payments", not "2,365.84 crore"). review-a writes
   this rule once into the prose pipeline (`pipeline/voice.md` and the slot briefs, or
   `pipeline/facts.mjs` rounding where that is cleaner) and regenerates the prose that breaks
   it; review-b and review-c fix their pages' hand-written copy to match.
4. **Charts.** Every axis and series labelled, nothing overlapping at either width, units
   shown, sources under every plate, derived series dashed, estimates marked, seams drawn.
   Download one share image per guide and look at it.
5. **Misreadings.** Every guide has its misreadings section, and each one is a real mistake
   people make with this number.
6. **Links and downloads.** Every in-page link, every-cut row link and download works; the
   "Finer detail" archive links point at the planned Hugging Face paths (they 404 until the
   upload; note them, don't remove them).
7. **Phone.** Nothing wider than the screen except the deliberate sideways plot zones; text
   readable; tables usable.

Data-level problems (a wrong value, a mislabelled unit, a broken series) are not yours to
rebake: write them down with the bundle, series, date and what you saw, and message the
coordinator. Prose you regenerate must pass `verify`, `lint` and `contract`, and be read by
hand.

## Who reads what

- **review-a** (port 4441): cpi, wpi, iip, factories, manufacturing, gdp, services, states,
  jobs, ilo; plus the site-wide precision rule (item 3).
- **review-b** (port 4442): external, trade, credit, deposits, rates, debt, housing, payments,
  banks, public-finance, markets.
- **review-c** (port 4443): consumption, aishe, gender, nfhs, mnre, poverty, population,
  climate, farms; all 36 state profiles (read five in full, scan the rest at 390); and the
  site furniture: home, guides index, search (try twenty real queries), learn pages, about
  and method, 404, RSS, OG cards, the `/dossiers/` redirects, sitemap.

## Finishing

Commit fixes on your branch in small, named commits. Write `docs/status/<slug>.md` with
every page read, what you fixed, and what you found but could not fix. Run the gates (in a
slot), `npm test`, `prose:dry` and verify, delete `./dist`, then message the coordinator
`<slug>: done`. Keep within your pages; site furniture is review-c's alone.
