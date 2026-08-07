# India Atlas — design hand-off

Paste everything below into a new chat.

---

## What I'm building

**India Atlas** — a public interpretation layer for Indian public data. Not another
dashboard or chart catalogue. The core artifact is a **dossier**: one page covering a whole
*family* of related data points, not one indicator. The Prices dossier holds CPI and its
sub-indices, WPI, the GDP deflator, the repo rate, real wages. A National Accounts dossier
would hold every cut of GVA/GDP. A single CPI release alone has ~300 item-level series, six
groups and dozens of sub-groups, each of which may deserve its own chart.

Audience is the interested non-specialist — a citizen, student, teacher, journalist. The
prose must be simple without being condescending or losing nuance. The goal is not only to
explain a number but to teach **how to read it, how not to read it, and the common mistakes**.
Provenance, methodology breaks and "we do not know" are first-class content, never hidden.

Full brief is in `Idea (Copy).md` in the project root.

## The design brief, in my words

Beautiful, gorgeous, minimalist. Clean, white space, white backgrounds with contrasting dark
backgrounds. Soft but lively colours — bright but soft. Gorgeous typography. Opinionated and
elegant. **No gradients, no popups, no distracting rubbish.** All focus on the charts, the
data and the explanation. I hate clichéd design patterns, especially the ones that are
pervasive in AI-generated work — the first instinct is usually the generic one, so resist it.

Charts must have **presence, purpose and personality** while staying minimal. Not thin wispy
lines. Not decorated boxes either.

## Where things stand

Working directory: `Claude/mocks/`. Everything is static HTML + SVG, no runtime, no
JavaScript. Fonts come from Google Fonts. Open `index.html` for a contact sheet, or serve
the folder: `python3 -m http.server 8799 --bind 127.0.0.1`.

| File | What it is |
|---|---|
| **`06-matrix.html`** | **The current direction. Start here.** |
| `07-plates.html` | A later elaboration of 06 that I rejected — kept only for reference |
| `01-schedule.html` | Early exploration: survey-schedule vernacular |
| `02-plate.html` | Early exploration: cartographic atlas plate |
| `03-shirorekha.html` | Early exploration: dark indigo, Devanagari hanging rules |
| `04-baseline.html` | Early exploration: one type size, charts on the text baseline grid |

**`06-matrix.html` is the design core I want to keep.** Its premise: pick chart *forms* that
suit the data rather than styling the same noisy line chart. Its hero is a 12×12 matrix — one
cell per month since 2015, coloured on a diverging scale whose midpoint is the RBI's 4%
target and whose two end colours are readings outside the statutory 2–6% band. Every cell
carries its own value, legible, so it reads as a picture and an exact table at once. Type is
Schibsted Grotesk + Petrona on a warm near-white (`#FBFAF7`).

### How to rebuild it

Charts are generated, not hand-written. From `mocks/`:

```
cd _src && python3 gen2.py && python3 gen_v1.py   # data + fragments
cd .. && python3 build6.py                        # inject into the template
```

- `_src/gen2.py` — builds the CPI series: headline, rural/urban, six groups, contributions.
  Everything reconciles: group contributions sum to the headline to within 0.01pp.
- `_src/gen_v1.py` — emits the HTML fragments for the current page.
- `_src/06-matrix.v1.tmpl.html` — the page shell, with `<!--FRAGMENT-->` markers.
- `_src/oklch.py`, `_src/cvd.py` — OKLCH colour construction, CVD simulation and contrast
  checks. **Use these before choosing any palette. Do not eyeball colour.**

Figures are illustrative. The weights, coverage, base year, the January 2015 break and the
April–May 2020 collection gap are real; the monthly series is a plausible stand-in.

## The open problem

The page looks good but its chart vocabulary is not yet fit for dossier scale. I need charts
that are **fit for purpose when there are dozens of them per page**, that have real presence
and personality, and that still feel minimal and beautiful.

Concretely, what a Prices dossier needs and doesn't yet have:

1. A **small-multiple grid** for the many sub-indices in one release — one panel per series,
   scaling to 15, 40, 300 panels without becoming noise or needing a new colour per series.
2. A **multi-series line** for several entities on one axis (CPI vs WPI vs deflator).
3. **Composition over time** — weights or contributions as they change.
4. A **levels-vs-growth** pairing, which is most of what National Accounts needs.
5. Whatever else the data actually demands — the point is to choose the form from the
   question, not to reach for a line by default.

Open questions I have not settled:

- **Should each chart be a "plate"** with its own figure number, title, one-line brief,
  download-image, download-data and source metadata? I think yes — it scales and it puts
  provenance next to the mark. I have not found a housing for it I like.
- **Charts are currently HTML labels positioned over SVG geometry.** That gives crisp
  responsive text but means a chart is not one downloadable file. Pure SVG would be portable
  and downloadable but harder to make responsive. This should be decided before building
  dozens of them.

## What has already been tried and rejected — please don't repeat these

This matters more than anything above. Each of these was built and thrown away:

1. **Grey slabs with hard frames.** Charts inside tinted boxes with black neat-lines and
   hairlines between every row. The containers read louder than the data. → Charts should sit
   on paper.
2. **Floating white cards on a beige page, with rounded corners and a drop shadow.** This is
   the default look of every SaaS dashboard. It replaced an identity with a convention. →
   Rejected outright.
3. **Thin wispy lines.** A 2px near-black line on a pale ground with light grey axis labels
   has no presence.
4. **Heavy black outline around flat pastel fills.** Reads as clip-art, and it turns the
   month-to-month noise of a y/y series into nervous spikes.
5. **Dark muddy "series" colours** — navy, mustard, brick, forest green (OKLCH lightness
   ~0.5). Ugly. Bright-but-soft means going *up* in lightness while holding chroma.
6. **Cramming 138 monthly points into a wide short strip** and then trying to style the
   result. The proportion was the problem, not the styling.
7. **Adding more visual devices to fix a chart.** Rails, tails, gutters, ribbons, leader
   lines, legends and tags all at once. Every new device has to earn its place.

## Working preferences

- Show me renders. Screenshot what you build and look at it before telling me it's done.
- Verify claims against the data rather than asserting them.
- Be direct about trade-offs. If something I ask for is a bad idea, say so once and then
  build what I asked for.
- Don't oscillate. If a direction is wrong, diagnose *why* before rebuilding — the previous
  session lost a lot of time swinging between over-decorating and over-stripping.
