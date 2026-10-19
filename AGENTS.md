# AGENTS.md — Measure of India operating manual

This file is the entry point for ANY LLM coding agent working in this repo
(Claude Code, opencode, Cursor, Codex, Kimi, GLM, DeepSeek harnesses, humans).
Tool-specific memory files (CLAUDE.md, .cursorrules, …) should contain one
line: "Read AGENTS.md and follow it."

## What this site is

Public repository: https://github.com/bebhuvan/measure-of-india (MIT code; text and charts CC BY 4.0).
Outside contributors start at `CONTRIBUTING.md`; readers at `/contribute/`. GitHub Actions stay off on
the repository until its secrets are set (deploys are by hand from lb/chartkit for now).

A static reference work on Indian economic statistics: 36 guides and 36
state profiles at the 2026-10-15 cleanup (the registry is the count), build-time-rendered charts,
mechanically verified prose. Live inventory: `npm run coverage:expansion`. No
framework runtime, no database, no client-side fetching of data. Everything
is a file, every file has a gate, every gate exits non-zero on failure.

## The pipeline (memorize this shape)

```
data/sources.yml ─► scripts/fetch.mjs      ① ADAPT    adapters in scripts/lib/products/
                   ─► data/raw/*.json       archival dumps (audit trail, git-tracked)
                   ─► data/series/*.json    ② CANON    canonical bundles
scripts/validate.mjs                       ③ VALIDATE cadence/ranges/identities
npx astro build                            ④ RENDER   pages + charts from baked JSON
pipeline/facts.mjs ─► generate.mjs         ⑤ NARRATE  LLM prose from facts sheets only
pipeline/verify.mjs + lint.mjs + contract.mjs  ⑥ GATE  numbers traced, tells banned
pipeline/asof.mjs + scripts/qc.mjs + lint-charts.mjs  ⑥ GATE  rendered numbers + as-of + prose freshness
scripts/perf-budget/search/browser.mjs   ⑥ GATE  bytes per page, search quality, phone main thread
.github/workflows/update.yml ─► release PR ⑦ PUBLISH  human merges; deploy.yml ships it to Workers static assets (wrangler.jsonc)
```

Hard rules — breaking any of these is a bug regardless of what else works:

1. **Never splice across instrument seams.** Different base years / methodologies
   are different rulers; they live in separate bundles, never one series.
2. **Missing data is `null`, never 0, never gaps in the array.** Interior nulls
   must be declared in the `gaps` of the very series that misses them
   (CONTRACT-series rule 2; bundle-level `meta.gaps` is retired). A series with
   no value at all is not baked (rule 2e), and every value sits inside the
   envelope of its unit (rule 2f, `scripts/lib/unit-envelope.mjs`).
3. **Every number in prose must come from the facts sheet.** verify.mjs traces
   this mechanically; there are no exceptions, ever.
4. **Nothing deploys without passing `npm run gates` AND a human merging the
   release PR.** The bot never pushes to main.
5. **Vintage means data vintage, not fetch date.** Don't bump `meta.vintage`
   unless the underlying data changed.

## Commands

| Command | What it does |
|---|---|
| `npm run data` | fetch all products + validate |
| `npm run gates` | validate + as-of freshness + qc + chart lint (the pre-merge minimum) |
| `npm test` | unit tests: period calendars, registry integrity, atomic writes |
| `npm run facts` | recompute facts sheets for all slugs |
| `npm run prose` | facts + regenerate all dated prose (needs .env LLM keys) |
| `npm run prose:dry` | prompts only, no API calls |
| `npx astro build` | build from committed data (no fetch) |
| `node scripts/source-quality.mjs` | rewrite the households/energy/farm source-quality registers after a rebake (validate only checks them) |
| `npm run qc` | post-build gate (numbers + chart geometry lint); run AFTER a build |
| `npm run lint:charts` | chart geometry lint alone (collisions, overlaps, bleeds, clips) |
| `npm run perf` | performance gates on a build: bytes per page, labelled search queries, throttled phone (part of `gates`) |
| `npm run perf:static` | the same without the browser: font freshness, `perf-budget`, `perf-search` (seconds) |
| `npm run fonts` | re-cut the web fonts from `fonts/source/` after editing `fonts/primary.txt` |
| `npm run seo` | search, feeds and app gate on a build: titles, canonicals, JSON-LD, sitemap, anchors, feeds, llms.txt, manifest, sw.js (part of `gates`; `--record` adds new anchors) |
| `npm run releases` | append each guide's new print to `data/releases.json` (the update workflow runs it) |

## Where things live

- `docs/GOAL.md` — the mission, stated plainly; the current, operative edge
- `docs/VISION.md` — the founding brief; the north star. Tactics never override these two.
- `docs/ARCHITECTURE.md` — the system shape + the multi-source expansion model
- `docs/DESIGN.md` — the design system: tokens, typography, dossier anatomy,
  chart engineering, rejected directions. Normative; elevate, never redesign.
- `docs/HISTORY.md` — lineage: what was tried, rejected, retired, and why
- `docs/PLAN-launch.md` — the launch build: scope, coverage ledger, sources, order, definition of done;
  progress in `docs/STATUS-launch.md`
- `data/sources.yml` — registry: families, cadence, release-day rules, base years, ranges
- Naming: readers see **guides** (`/guides/<slug>/`; old `/dossiers/` URLs redirect).
  Code keeps the internal name: `src/dossiers/`, `DOSSIERS`, the `.dossiers` class.
- `src/dossiers/headline.js` — each guide's headline figure and small-chart source;
  the home page, guides index and RSS all quote from it.
- `src/dossiers/periods.js` — the months, spans, counts and release dates a page names
  ("August 2026", "eight prints", "Jan to Aug 2026"), read from the bundles at build time.
  Never type a period into page copy; the claims around it still need re-reading each
  release (`pipeline/asof.mjs`).
- `scripts/migrations/` — one-off, idempotent design migrations (2026-10 palette, chart v3).
- `perf/budgets.json` — performance ceilings. A page's recorded ceiling only moves down
  (`--record`); raising one needs an entry in its `raised` list saying why.
  `perf/search-queries.json` holds the labelled search queries (a `known` mark is a recorded
  miss). The performance log, with before/after numbers, is `docs/status/performance-scale.md`.
- Search is index v2: `src/dossiers/search-pack.js` lays out the files and
  `src/dossiers/search-core.js` reads them. `layout()` is the one result order.
- Every-cut rows have one template, `src/dossiers/everycut-html.js`. A page renders its first 100
  rows and streams the rest from its gzip pack (`/ec/…`).
- Builds can go to a RAM disk: `ATLAS_OUT_DIR=/dev/shm/x npx astro build`, then run the gates
  with `QC_DIST=/dev/shm/x`. A build fits Node's default heap (peak about 3.3 GB of 4.1 GB,
  2026-10-19: parsed bundles sit in a bounded cache, `loadBundle` in everycut.js); CI gives it 6 GB.
  A module-level cache that holds every bundle for the whole build is what overran it before.
- `src/seo/` — search, structured data, sitemap lastmod, feeds, llms.txt; `src/pwa/sw.js` the
  service worker. Plan and rules: `docs/PLAN-seo-pwa.md`; shape: `docs/ARCHITECTURE.md`.
  `data/releases.json` is the release log the feeds read: appended by script, never by hand.
- `src/dossiers/registry.js` — THE dossier registry: every dossier's metadata,
  current bundle, calendar, policy band, spark spec. Homepage, register, RSS,
  404, OG cards, qc and lint-charts all derive from it. Adding a dossier
  starts here.
- `scripts/lib/net.mjs` — THE network client (deadline, size cap, retry, throttle)
- `scripts/lib/tabular.mjs` — THE parsing kit (CSV, Indian numerals, messy dates)
- `scripts/lib/products/*.mjs` — one adapter per source product
- `src/charts/plumbing.js` — shared chart helpers; normative, don't restyle.
  Read its header before writing chart code: Plot ignores function-valued
  dx/dy/textAnchor (split one text mark per side instead), and labels must
  never be struck by rules/connectors (`stripLabelSide`, dumbbells labelled
  outside the dots).
- `pipeline/` — prose machinery: corpus (the spec), voice, slots, gates
- `site/` — design-phase reference implementation (plain HTML visual spec)
- `docs/reference/` — source reverse-engineering notes (eSankhyiki API, TradeStat)
- `skills/` — task playbooks for agents (see skills/README.md)
- Time Use Survey source decision, checks and remaining scope: `docs/status/time-use-expansion.md`.
- Current coverage expansion: read `skills/atlas-comprehensive-expansion/SKILL.md`
  and `docs/PLAN-coverage-expansion.md`. The owner's rule is: when in doubt,
  more data points, granularity, cuts, explanations and charts. Account for every
  published sub-statistic; stored data alone is not a completed guide.

## Contracts you must not violate

- `docs/CONTRACT-series.md` — the canonical bundle shape
- `docs/CONTRACT-render.md` — chart/page rules and budgets
- `docs/CONTRACT-dossier-structure.md` — the normative dossier flow
- `docs/RUNBOOK-sources.md` — how to add a data source (follow it exactly)
- `docs/RUNBOOK-workers-cutover.md` — hosting on Cloudflare Workers static assets: first deploy, checks, rollback
- `docs/RELEASE-CHECKLIST.md` — what a human reviews before merging a release

## When you finish any task here

Run `npm run gates` (after a build if you touched anything render-side).
If you touched data or prose, run `npm run prose:dry` too. Do not commit
unless asked. Never edit `data/raw/` by hand — it is the audit trail. Raw dumps
over about 25 MB live in the Hugging Face deep archive instead, indexed by sha256 from
`data/raw/` (docs/PLAN-launch.md §2b).
