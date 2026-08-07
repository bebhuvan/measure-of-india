# Handoff — India Atlas: build the real site

Paste everything below the rule into the new chat.

---

## Context

You are building the production version of **India Atlas**, a static site that publishes long-form "dossiers" on Indian economic statistics — one page per concept (CPI, GDP…) combining charts, evergreen explanation, dated commentary on the latest print, and "how to misread this" guidance. Audience: curious non-specialists. The design bar is the highest tier of data journalism (FT, NYT Upshot, Reuters Graphics) crossed with a printed monograph.

**The design phase is complete.** A fully elevated, design-locked reference implementation exists as plain HTML at `site/` in the current project. Your job is to re-platform it onto a real stack with real data — not to redesign it. Treat `site/dossiers/cpi.html` as the normative visual specification. When in doubt, match the reference pixel-for-pixel; any deviation must be an improvement argued on its merits.

## What exists (design-phase output, all working)

```
site/
  BUILD.md               ← the original build spec. Still normative for anatomy, voice, QC.
  HANDOFF.md             ← the design-phase brief (history).
  index.html             ← homepage: hero, frontispiece plate, latest-prints strip (JS-driven), dossier directory with sparklines
  register.html          ← cross-dossier series ledger with sparklines
  method.html            ← standing rules, sources, corrections policy
  about.html             ← mission/audience/colophon
  dossiers/
    cpi.html             ← Dossier 01 · v1.7 · THE REFERENCE IMPLEMENTATION
    gdp.html             ← Dossier 02 · v1.5 · proves the template generalizes
  components/index.html  ← living component gallery / styleguide
design-mocks/
  site-backup-2026-08-03/← pre-elevation snapshot (reference only)
  h-monograph.html, mocks/ ← earlier explorations (reference only)
```

### Design system as locked (do not reopen)

- **Fonts:** Archivo (display/heads/brand, ~680–720, tight tracking), Newsreader (body 460, 1.18rem/1.82; large numerals weight 300, `opsz 72`, tabular-nums), IBM Plex Mono (axis labels, kickers, metadata, table figures, chart text).
- **Color:** white bg; ink #1B1A17; one accent vermilion #BE3E26 (primary series, key numbers, kickers, hovers, dominant basket segment); series greys #5B564B/#A8A293/#C6C0B0 (dark→light; derived = lightest + dashed); band fill #F8F6F1; hairlines #E6E2D6. No gradients/shadows/cards.
- **Layout:** 880px prose column; `.break` breakouts min(1280px, 100vw−48px); corner-tick `.frame`s; 112px section rhythm.
- **Charts (Observable Plot 0.6):** linear curves ONLY (smoothing banned — data integrity); round joins/caps; hairline grid #EDE9DA; % only on top y-tick; floor rule at domain bottom; darker zero rule; RBI band + dashed target (CPI) / strong zero + 6% trend (GDP); elbow leader-line peak annotations; end dots on every series + hairline leaders to dodged end labels; last-13-period emphasis stroke; crosshair tooltip; legend hover-isolation with 150ms transitions; SVG/PNG/CSV downloads + Source link in every plotfoot; aria-labels stating ending values.
- **Signature components:** reading band (numeral · caption · band-position scale), basket bar (dominant segment in vermilion), explain pairs (closed top-ink/bottom-hairline panel), margin notes (left hairline + vermilion tick), provenance with double-rule colophon.
- **Data (design phase):** seeded deterministic generators with autocorrelated drift, anchors shaped like real Indian history. **These get replaced by real data in this build.** Every displayed number is JS-driven from the same dataset as the charts — preserve this invariant.

## Locked technical decisions

1. **Chart engine: Observable Plot** (ESM). All annotation/dodge/crosshair/download plumbing is written against it; it outputs plain SVG. Do not migrate to D3, Fluent UI, Chart.js, or anything else.
2. **Interactivity: keep it light.** Crosshair tooltip, legend hover-isolation, downloads — a few KB of inline JS per page. No hydration framework, no SPA.
3. **Framework: Astro**, static output only (`output: "static"`). Used for layout reuse, content collections, and the build-time data pipeline — NOT for client-side JS. Charts keep working exactly as they do now (inline module script + ESM CDN import, or vendored Plot — see §4).
4. **Hosting: Cloudflare Pages.** Free static CDN, instant rollbacks, preview deployments per PR.
5. **Data: baked at build time.** A Node pipeline produces versioned JSON per series; pages consume it the same way they consume the mock generators today. No runtime data fetching in the browser.

## The real work (in dependency order)

### 1. Data pipeline — the heart of the build
- `data/sources.yml` — each series: source agency, release URL, fetch method, frequency, base year, revision policy.
- `scripts/fetch.mjs` — pulls MoSPI/NSO CPI releases and NAS quarterly estimates (start with CSV/PDG endpoints where available; otherwise curated manual entry per release with the press-release URL recorded).
- Output: `data/series/<slug>.json` — `{ meta: {source, vintage, base, frequency, release_date}, points: [{date, value}, ...] }`, one file per series, **committed to git** (git is the audit trail; vintages are never overwritten — revisions create new vintage entries).
- Headline CPI must remain **computed from components via real weights** — never stored independently.
- A `scripts/validate.mjs` step: monotonic dates, plausible ranges, no gaps without explanation, weights sum to 100.
- Keep the mock generators behind a flag (`--mock`) for design development.

### 2. Astro re-platform
- `src/layouts/Dossier.astro` — the dossier anatomy (BUILD.md §7 section order is normative), `Page.astro` for the four support pages.
- Dossier content as MD/MDX content collections: frontmatter for meta strip + numbers-row series keys; sections 01–07 as prose with `<b data-figure="…">` slots filled by the inline script (preserving the JS-driven-numbers invariant).
- Chart plumbing (serializeSVG/downloads/a11y/crosshair/legend/dodge) becomes one shared module (`src/charts/`) instead of per-page copies — this is the ONE allowed refactor of the reference code; behavior must not change.
- Per-page inline `<script type="module">` imports baked JSON (Astro `?url` or `define:vars`) — no network fetch at runtime.

### 3. Performance & hygiene
- Self-host the three fonts (variable woff2, subset to latin), `font-display:swap`, preload the display + text faces. Drop Google Fonts.
- Vendor Observable Plot (pin version) instead of CDN, or keep CDN with SRI — decide once, document.
- OG/Twitter cards: render each dossier's Plate 1 to PNG at build (Plot + jsdom in Node), 1200×630, white bg.
- RSS feed per dossier + one site feed; sitemap.xml; canonical URLs; plausible-free — no trackers (Cloudflare Web Analytics if anything).
- GitHub Actions cron aligned to release calendars (CPI ~12th monthly, GDP quarterly) → run pipeline, commit new vintage JSON, rebuild, deploy.

### 4. LLM prose pipeline — drafted by machine, governed by rules

Dated commentary ("What the print says" / "As of <month>") is regenerated with each release. Evergreen prose is written once, by a human, and changes only by human PR. The pipeline's job is to produce dated prose **indistinguishable from the human corpus** — the test is a reader who cannot tell, not a linter that passes.

**Corpus first.** Extract every prose slot from `site/dossiers/cpi.html` and `gdp.html` into `pipeline/corpus/`, classified by slot type: `current-reading`, `how-to-read` (evergreen), `as-of` (dated), `misread`, `margin-note`, `register-sub`. This corpus IS the voice specification — better than any style guide. `pipeline/voice.md` codifies it: short declaratives; plain vocabulary with nuance kept; one concrete image per abstraction at most ("the basket is still dearer", "the flattery expires with the next bad monsoon"); concede-then-counter; "we do not know" said plainly when true; numbers in prose at one decimal, the print itself at two. Note: the dossier voice is deliberately **plainer than the author's essay voice** — do not blend them.

**Slot-typed generation.** Each generation call receives: (a) the slot contract (type, max sentences, required figure slots, whether a date-stamp is required, whether "this month"-type words are banned), (b) 2–3 corpus exemplars of the same slot type, (c) a **facts sheet** computed by the data pipeline: latest, previous, year-ago, min/max with dates, band position, streaks ("fifth consecutive month below target"), base-effect warnings. The model writes only from the facts sheet.

**Numeric verification — the hard guardrail.** After generation, every number in the prose is extracted and checked against the facts sheet by a script. Any figure not traceable to the sheet = **reject and regenerate**. AI hallucination becomes a build failure, never an editorial incident. Streak/comparison claims ("halved in a year") are verified arithmetically.

**Anti-slop lint (CI-enforced).** `pipeline/banned.txt` blocks AI-tells: "delve", "landscape", "navigate", "unlock", "journey", "in today's fast-paced world", "it's worth noting", "moreover", "furthermore", "in conclusion", "crucial(ly)", "importantly", "underscores", "highlights", "plays a (key|vital) role", "a testament to", "game-changer", "when it comes to", "not just X but Y", "in the world of". Plus structural detectors: uniform sentence length (AI cadence — flag paragraphs with low sentence-length variance), hedge stacking ("may potentially suggest"), and dated words in evergreen slots.

**Critique loop.** Generate → a critic pass scores against `pipeline/rubric.md` (voice match to corpus, banned-phrase scan, factual consistency, one-image-per-abstraction, concede-counter present where a claim is made) → one revision pass → emit. Low temperature; the corpus does the lifting, not creativity.

**Human gate.** Generated prose lands on a branch in the release PR. Dated slots may auto-merge only when verification + lint + critic all pass; evergreen slots never generate — they are human-only. A weekly "Turing-lint" eval: shuffle generated paragraphs with corpus paragraphs and check a judge model cannot reliably separate them; track the score over time.

### 5. Content
- Replace mock data with real series; rewrite dated commentary ("As of…") for the actual latest print; keep the voice rules in BUILD.md §11.
- Keep the mock-data disclosure footers until every number on the page is real; then replace with true citations.
- Add Dossier 03 (WPI) only after CPI and GDP are live with real data end-to-end.

## Hard constraints carried over (violating these is failing)

- Static-first output: plain HTML + inline styles + inline module script. No client framework. No runtime data fetching.
- No curve smoothing; domains admit all real values incl. negatives; every displayed number derives from the baked dataset.
- One accent color; grey ramp dark→light; derived series dashed and labelled everywhere.
- `tickFormat` returns strings. Plots fit inside their frame's content box.
- After every edit: syntax-check module scripts; scan for missing element IDs; verify a few rendered numbers against the source JSON by hand.
- Provenance footer on every page: source of record + exact release + vintage + revision policy.

## Definition of done (v1)

- CPI + GDP dossiers live on a real domain with real, cited data; all four support pages live.
- One-command rebuild: `npm run build` pulls data, validates, builds, and the diff of any vintage JSON is reviewable in git.
- The prose pipeline regenerates dated commentary on a release: facts sheet → generation → numeric verification → lint → critic → PR. Zero unverified numbers have ever shipped.
- A print of any page looks like the monograph it claims to be.
- Lighthouse: 100 performance on a dossier page is plausible — protect it.
