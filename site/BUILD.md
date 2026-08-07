# India Atlas — Build Guide

This document is the complete specification for building and extending the India Atlas static site. It is written for an agent (or human) picking up the codebase cold. Follow it exactly; where you must deviate, say so explicitly in a comment or commit message.

---

## 1. What this site is

India Atlas publishes **dossiers**: one long page per statistical concept (CPI, GDP/GVA, WPI, IIP, real estate, health…). Each dossier combines carefully designed charts, evergreen explanation, dated commentary on the latest print, and explicit "how to misread this" guidance. The audience is curious non-specialists — citizens, students, journalists — not economists.

**The dossier is the product. Everything else (homepage, register, method, about) exists to route people into dossiers.**

## 2. Non-negotiable principles

1. **Static-first.** Plain HTML files, no build step, no framework, no bundler. JavaScript only via `<script type="module">` at the bottom of each page, importing Observable Plot from CDN as ESM.
2. **Every observation traceable.** Every chart carries its source and vintage. Derived series (e.g. core inflation) are always labelled as derived — in the legend (dashed line), in the chart footer, and in prose.
3. **Conflicts are shown as separate series, never reconciled.** CPI vs WPI, old vs new base — plot side by side, explain in prose.
4. **The system may say "we do not know."** If a figure isn't published, we say that instead of inventing one.
5. **Data integrity over prettiness.** Plotted points must be the actual observations. This is why **smoothing curves (`catmull-rom`, basis, monotone) are banned** — they overshoot real values. Lines are straight segments between true monthly/quarterly points; visual softness comes from `strokeLinejoin/cap:"round"`, never from curve interpolation.
6. **Single source of truth for numbers.** Every number rendered in HTML (hero stats, register, inline prose figures, plate values) is computed by JS from the same dataset that feeds the charts. Hardcoding a number in prose is a defect.
7. **Prose is simple without being condescending.** Short sentences, plain vocabulary, nuance kept. Dated commentary is clearly separated from evergreen explanation, visually and in tone.

## 3. Stack

- **HTML5 + inline `<style>` per page.** Each page is self-contained. Duplication of header/footer CSS across pages is *intentional* — it keeps pages portable and dependency-free.
- **Observable Plot 0.6** via `https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm`.
- **Fonts** (Google Fonts, same stack on every page):
  - `Archivo` (variable width/weight) — display headlines, section heads, brand.
  - `Newsreader` (variable optical size) — body prose and **all large data numerals** (weight 300, `opsz 72`, `font-variant-numeric:tabular-nums`).
  - `IBM Plex Mono` — axis labels, kickers, metadata, table figures, chart text.
  - Never use a hairline-contrast display face (e.g. Bodoni) for data numerals — thin strokes vanish on non-retina screens.

## 4. File map

```
site/
  BUILD.md                  ← this file
  index.html                ← homepage: hero + latest prints + dossier directory
  register.html             ← cross-dossier series register (all series, sparklines)
  method.html               ← how we work: sourcing, revisions, derived series
  about.html                ← mission, audience, principles
  dossiers/
    cpi.html                ← Dossier 01 · Consumer Price Index (reference implementation)
    gdp.html                ← Dossier 02 · National Accounts (GDP/GVA)
  components/
    index.html              ← living component gallery / styleguide
```

Linking convention: dossier pages link up with `../`. The brand always links home. Nav: `Dossiers · Register · Method · About`.

## 5. Design tokens

Every page declares the same `:root` block (copy verbatim from `dossiers/cpi.html`):

```css
--bg:#FFFFFF;   --ink:#1B1A17;  --ink-soft:#4A463F;
--muted:#8A857A; --faint:#B4AFA2; --rule:#E6E2D6;
--accent:#BE3E26;                       /* vermilion: THE accent, used once per element group */
--grey1:#5B564B;  --grey2:#A8A293;  --grey3:#C6C0B0;  /* series greys, dark→light */
--band:#F8F6F1;                          /* reference-band fill */
```

Rules:
- **One accent.** Vermilion is reserved for the primary series, key numbers, kickers, and interactive hover states. Never introduce a second hue on a page.
- Supporting series use the grey ramp in dark→light order of importance. A **derived** series is always the lightest grey **and dashed**.
- Backgrounds are pure white. No gradients, no shadows, no rounded cards, no color blocks (except the hairline frame treatment on charts and the band fill).
- Rules are 1px `--ink` (strong) or `--rule` (quiet). Double rules only in footer colophons.
- Vertical rhythm: sections `padding:112px 0 0`; plate-to-plate gaps `margin-top:104px`; prose measure `max-width:64ch`.

### Layout skeleton

- `.page` — max-width 880px centered column; all prose lives here.
- `.break` — `width:min(1280px, calc(100vw - 48px))` centered via transform; charts, register table, basket bar, and the titleblock break out to this width. **Plots must be sized to fit *inside* their container's padding** (a 1280 break with 48px frame padding → plot width ≤ 1184). An SVG wider than its content box silently overflows — this was a real bug once.

## 6. Page anatomy (all pages)

Every page has, in order:

1. **`.sitehead`** — brand (10px vermilion square + "India Atlas" in Archivo 720), nav, date stamp. 66px tall, 1px ink bottom border.
2. **`.crumb`** — mono uppercase breadcrumb strip: section path left, status/vintage right.
3. Page body inside `.page`.
4. **`.provenance`** footer — three columns (Source of record / Revisions & uncertainty / This dossier) + `.fine` colophon line (site · vintage · typefaces).

See `components/index.html` for each block in isolation with its class contract.

## 7. Dossier anatomy (required section order)

A dossier page MUST contain these sections, numbered `01`–`07` with `.sec-head` (mono index number, Archivo title, hairline, unit note):

| § | Name | Content rules |
|---|------|----------------|
| — | Titleblock (`.break`) | Kicker `Dossier № NN — Domain · Title`; h1 in Archivo with one italic accent word; italic lede ≤ 2 sentences; `.meta` strip (source, frequency, base, coverage, latest print, release date); `.numbers` row — 4 key figures, Newsreader numerals, delta lines `▲/▼ x.xx pt vs prev · word` |
| 01 | **The current reading** | `.reading-grid`: bordered `.reading-box` (big number, caption, band-position chip) + two prose columns: **What the print says** / **What it does not say**. The second column carries uncertainty and, where honest, "we do not know". Dated (`Recorded <date>` in the unit slot). |
| 02 | **The register of series** | `.break` ledger table: swatch + name + sub, weight (with track bar), latest (Newsreader), vs prev month, year ago, sparkline. Derived series flagged in its sub-line. |
| 03 | **Composition** | For indices with weights: `.basket` segmented bar + labels + italic caveat note. For accounts (GDP): this slot may become a "how the accounts fit together" prose block — the slot is required, its form is flexible. |
| 04 | **Plate 1 — headline chart** | Full `.frame` treatment (see §8). Two-column `.explain` beneath: evergreen **How to read this** / dated **As of <month year>**. Both must hold long text. |
| 05 | **What this measures** | Evergreen prose (`.wm-grid`) with 2–3 margin notes in the rail. Margin notes are the sharpest one-liners on the page. |
| 06 | **Component plates** | One `.frame` plate per component series, each with `.plate-val` (latest value, Newsreader), peak/latest line in plotfoot, downloads, and its own `.explain` pair. Separated by `margin-top:104px`. |
| 07 | **How to misread this** | 5–6 numbered (roman) failure modes. Each: the misreading in quotes as an h3, then the correction with the key phrase bolded. |
| — | Provenance | As §6.4, with dossier-specific source citation. |

Prose conventions: dated commentary names its date; evergreen text never references "this month"; inline figures are `<b id="…">` spans filled by JS.

## 8. Chart engineering standards

All charts are Observable Plot. The reference implementation is `dossiers/cpi.html` — copy its script plumbing wholesale:

### 8.1 Shared plumbing (copy verbatim)

- `serializeSVG / saveBlob / downloadSVG / downloadPNG / downloadCSV / wireTools` — every plate offers **SVG · PNG · CSV** in its `.plotfoot` (below the chart, not above). PNG renders at 2× with white background. CSV filenames: `india-atlas_<domain>_<series>_<range>`.
- `a11y(plot, title, desc)` — sets `role="img"`, an `aria-label` that *describes the chart's content and ending values*, and an SVG `<title>`.
- `addCrosshair(container, plot, seriesList, geo)` — pointer crosshair with per-series dots + mono tooltip. **The `geo` contract**: `{W,H,ml,mr,mt,mb,d0,d1}` must exactly match the plot's width/height/margins/y-domain or the crosshair drifts. If you change a chart's geometry, change its `geo`.
- `wireLegend(blockEl, plot, keys)` — legend chips dim all non-hovered series by matching `stroke/fill` to the series color. Works only because each series color is unique — never reuse a color for two series on one chart.
- `peakOf / peakBetween / dodgeEndLabels` — annotation helpers. End labels are dodged so they never overlap (gap ≈ 3.8% of the y-domain).

### 8.2 Mark recipe (headline plate)

In z-order: hairline grid (`Plot.gridY(ticks,{stroke:"#EAE5D7"})`) → reference band (`Plot.rectY`, fill `--band`) → zero rule (`#CFC9B8`) → target rule (dashed `2,4`, labelled) → event rules (e.g. COVID, dashed `2,3`, lighter) → supporting lines (1.5px, round joins/caps) → derived line (lightest grey, `strokeDasharray:"4 3"`) → headline (2.75px accent) → last-13-period emphasis (4px, round cap) → event dots (accent, white halo stroke) → event labels (13px mono, accent, `dy`/`dx` tuned per chart) → end dot → dodged end labels (14.5px mono, headline label weight 500).

### 8.3 Axis standards

- Y label top-anchored: `"↑ year-on-year, per cent"`, `labelArrow:false`, `tickSize:0`, `tickPadding:11`.
- X ticks: one per year on long plates, every 2 years on components.
- **`tickFormat` must return a string** — `d=>String(d.getUTCFullYear())`. Returning a number lets Plot's default formatter print `2,016`. (Real bug; check for it.)
- Domains must admit the data's true range **including negatives** (food deflation, fuel deflation, the COVID GDP crash). Clamping a domain at zero to look tidy is a data-integrity violation.
- Aspect: headline plates ≈ 2.1:1 (e.g. 1184×560); component plates ≈ 2.5:1 (1184×470).
- Chart text: 13.5px ticks, 13px annotations, 14–14.5px end labels, all Plex Mono, color `#5C574C` via the plot `style`.
- All SVG text gets a white halo (`.plotzone svg text{paint-order:stroke;stroke:#FFF;stroke-width:4px}`) so labels survive crossing lines.

### 8.4 Sparklines

170×38, axes off, y-domain `[min(0, data min), data max]` (never clip deflation), zero rule, 1.25px line, 2px end dot, `aria-hidden="true"`.

## 9. Data standards

- Each page holds its dataset in a deterministic generator at the top of its module script (seeded PRNG `mulberry32`-style + piecewise anchor interpolation + noise). **Seeds are fixed** — same data on every load.
- Invented/mock data must be labelled as such in the provenance footer ("Figures shown are illustrative mock data for design preview").
- Shape anchors to real history (actual event months: Dec 2019 onion spike, Apr 2020 COVID, Apr 2022, Jul 2023), then add small noise. Food noisier than fuel, fuel noisier than core.
- Where an aggregate is a weighted mean of components (headline CPI), **compute it** from the component series — never invent it independently.
- All displayed values derive from `S` (the series object): latest `L`, previous `P`, year-ago `Y`. Pattern: `setTxt/setHTML` into id'd spans. Add a node check (`node -e` compile + id presence scan) after every edit — see §12.

## 10. Adding a new dossier — checklist

1. Duplicate `dossiers/cpi.html` → `dossiers/<slug>.html`.
2. Fix links: brand `../index.html`, nav, crumb path.
3. Replace the data generator: new anchors, frequency (quarterly → adjust `fmtDate`, ticks, year-ago lag: 4 for quarterly, 12 for monthly), and weighted-mean logic if any.
4. Rewrite §01–§07 prose: evergreen first, then dated commentary naming its date; 5–6 misread items specific to the statistic.
5. Choose the reference furniture: tolerance band (policy-target series) or zero/trend rules (growth series). Don't invent bands where none exist in policy.
6. Recompute every `geo` and every y-domain from the new data's actual min/max.
7. Tune annotation `dx/dy` per chart — peak labels must not collide with lines or each other.
8. Update register table rows, basket/composition block, provenance citation, vintage dates, version number.
9. Add the dossier card to `index.html#dossiers` and its series to `register.html`.
10. Run the QC checklist (§12).

## 11. Content voice

- Headline h1s may be poetic; everything else is plain. "The cost of an ordinary shopping basket, measured monthly" — good. "Unlock insights" — banned.
- Numbers in prose: one decimal for rates, two for the print itself ("3.51%" in figures, "3.5%" in a sentence).
- Dated commentary reads like a good newspaper's second paragraph; evergreen reads like a patient textbook. Never blend them in one block.
- "How to misread this" items quote the mistake verbatim, then correct it without scolding.

## 12. Pre-ship QC checklist

- [ ] `node` syntax check of every inline module script (compile with `vm.compileFunction` after stripping the import line).
- [ ] Every id referenced by JS exists in the HTML (script the scan; don't eyeball it).
- [ ] No `catmull-rom`/basis/monotone curves anywhere (`grep`).
- [ ] No number-format comma in year ticks (`grep tickFormat` → must `String(...)`).
- [ ] Every chart: source + vintage in plotfoot; downloads work; aria-label states ending values.
- [ ] Derived series dashed + labelled everywhere it appears (legend, footer, prose).
- [ ] Domains include all negative values; gridlines are hairlines; end labels don't overlap.
- [ ] All displayed numbers match the data (they're JS-driven — verify a few by hand).
- [ ] Colors: one accent; greys in dark→light order; no color reused across two series in one chart.
- [ ] SVG width ≤ container content width (check `.break` − frame padding).
- [ ] Provenance: revisions policy, vintage, version bump, "illustrative mock data" note while data is invented.
- [ ] Mobile pass at 680px: nav collapses, grids stack, sparkline column hides.
