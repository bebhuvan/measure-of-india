# DESIGN v4: the sheet, the cover and the grid (2026-10-11, agreed with the owner)

v4 is the owner-approved direction after the v3 pass. It folds into `docs/DESIGN.md` §0 when
it is built; until then this file is normative for v4 work and wins over DESIGN.md where they
differ. Mocks, generated from the real bundles: `design-mocks/v6/` (`node design-mocks/v6/gen.mjs`),
with the grid and type system in `design-mocks/v5/v5.css`. Add `?grid` to any mock URL to
see the columns and the 8 px rhythm.

Why: the owner judged v3 well made but bare ("no character"), and the guide pages "lacking
rhythm and harmony" and looking unfinished. Rounds 1 and 2 of this pass only refined v3 and
were rejected as incremental. v4 adds one signature (the sheet), one meaningful use of
colour (the cover) and one strict grid under everything.

## 1. The grid and the rhythm

- 1184 px of content, **12 columns of 76.67 px with 24 px gutters**. The ledger margin is
  columns 1 to 3 (278 px); the main field is columns 4 to 12, starting 302 px from the axis.
  This replaces v3's 220 + 56 split.
- **Every element starts on a column edge.** Rows inside a block (history rows, facts, the
  guide index, the current reading) use CSS `subgrid`, so their parts land on the page's
  columns without local widths.
- **Charts share one left edge with the text.** y-axis labels and category names hang in the
  gutter, right-aligned to the main line; the plot area runs columns 4 to 11; end labels sit
  in column 12. Title, subtitle, plot, source and prose all start at 302 px. (Changes
  `plumbing.js` margins and the chart lint's geometry in the same commit.)
- **4 px baseline.** Every line-height is a multiple of 4, every vertical gap a multiple of 8:
  8, 16, 24, 32, 40, 48, 64, 96, 128. Sections 128 apart (64 on a phone).
- Type scale (desktop): body serif 18/28; lede 22/32; h2 (findings) 30/36; guide h1 64/64;
  readout figures light serif 44/48 and 96/88; sans 16/24 (subtitles), 15/24 (nav), 14/20,
  13/20 (labels, sources; the floor), chart text 12. Three tiers of small text: ink 500 for
  what you navigate by, ink-soft for what describes, muted 13 px for attribution.
- Below 860 px the margin folds and everything stacks in reading order.

## 2. Colour: one meaning per colour, used sparingly

- **Data colours are unchanged**: ultramarine for the series a chart is about, marigold for
  a comparison, greys for context. No family colour ever appears on a chart mark.
- **The ultramarine dot means "the latest reading"** everywhere: chart end dots, the dot on
  the sheet, the "next print" line in the masthead, the dated note.
- **Six families**, each with a field (a cover's ground), a deep tone (type and lines on that
  field, 7.3 to 9.6:1, AAA) and a bar tone (a 3 px rule):

  | Family | Sections | Field | Deep | Bar |
  |---|---|---|---|---|
  | Prices | Prices | #F8E4E6 | #7A2433 | #D9808F |
  | Output and enterprise | Output, Enterprises | #FCE9D4 | #7A3A00 | #E39A4C |
  | Money and markets | Money | #DFEFE8 | #0D4E3D | #6FB39A |
  | India and the world | External | #DFEAF3 | #1A4360 | #7FA6C6 |
  | People and work | Labour, Work, Consumption, Households, Social, Health, Education | #EDE4F2 | #4A2862 | #A88BC2 |
  | Land, food and energy | Energy, Environment; farms | #E6EFDB | #34501B | #93B36E |

- **The budget: one coloured field per page, at most, and only for what is new.**
  - The landing page's cover is always tinted: it carries the newest print, in its family's
    field, and changes colour when the next release lands.
  - A guide's cover is tinted only while its latest release is fresh (seven days from the
    bundle's `releaseDate`; computed at build time). Otherwise the cover is white, and the
    family shows as a 3 px bar-tone rule under the masthead and the family name in italic in
    the margin.
  - Nowhere else: no tinted tiles, cards, swatches in lists or bars on rows. Families appear
    as words. (A 33-tile coloured "shelf" was mocked and rejected as too loud.)
- On a tinted cover the chart is drawn in the family's deep tone (ultramarine on these fields
  clashes); the latest dot stays ultramarine. Inside the guide every chart is in data colours.
- This amends rejected direction §7.13 (colour per topic): still rejected for marks, charts
  and decoration; allowed as a ground, one per page, for what is new.

## 3. The landing page

In order, on the grid:

1. **Masthead**: a dateline strip (the date; "Next print: ... about 12 October" with the
   ultramarine dot, from `sources.yml` release calendars, always "about"), then the
   nameplate, nav and search.
2. **The cover**: the newest print. Margin: "The latest print", family, source and release
   date. Main: the figure in light serif at 168 px, one plain sentence, the month's other
   prints listed at the right (columns 10 to 12), the chart across columns 4 to 11, a one-line
   source with "Read the guide".
3. **The sheet** (the signature): every monthly and quarterly headline since 2016 on one
   shared time axis, one row each, each on its own scale (said in the subtitle), grouped by
   family; the last twelve months in ultramarine, the latest reading as the dot; name and
   period in the margin, the figure in column 12. Read across for a series, down for a
   moment.
4. **Every guide**: a typographic index with no colour. The family name in italic in the
   margin; guides in three columns: title, figure (light serif), what it is and its period.
5. **States and union territories**: the tile cartogram (pale ultramarine tints, since it is a
   chart), with the five fastest and five slowest listed beside it.
6. Footer.

## 4. Guides

- **The cover**: crumb; family name, instrument and frequency in the margin; h1 and lede in
  the main field; the key figure in the margin level with the headline chart; the chart
  across the sheet; a facts strip (base, latest print and release date, next release) on the
  grid. White by default, tinted when fresh (§2).
- **Sections**: the numeral and a short section name in the margin; the finding as the one
  serif heading in the main field. Never two serif headings stacked.
- **The current reading**: one column. "What the print says" and "What it does not say" are
  consecutive rows, each labelled in the margin; the counterpoint in ink-soft. The generator
  writes paragraphs (pipeline change; `prose:dry` and `pipeline/lint.mjs` must pass).
- **The chart card**: the readout sticky in the margin while its chart scrolls (time plates;
  categorical plates give the margin to their names); finding; a one-line subtitle; key;
  plot; a foot row with the source on the left (a long method folds behind "Method") and the
  actions on the right on one line: "Download PNG SVG CSV | Copy link Embed".
- **Notes**: "How to read this" and the dated "As of ..." side by side on the grid. The dated
  note is marked by the ultramarine dot and a 2 px ultramarine rule, never a grey box.

## 5. Rollout (staged, each stage building with the gates green)

1. Grid, type scale and rhythm tokens in `atlas.css`; the masthead.
2. The chart edge in `plumbing.js` and the lint geometry; the foot row and actions.
3. Guide cover, sections, current reading, notes.
4. Landing: cover, sheet, index, states.
5. Family tokens and the freshness rule; OG cards follow the cover.
6. DESIGN.md §0 rewritten from this file; this file then retired into it.
