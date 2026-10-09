# AGENTS.md — India Atlas operating manual

This file is the entry point for ANY LLM coding agent working in this repo
(Claude Code, opencode, Cursor, Codex, Kimi, GLM, DeepSeek harnesses, humans).
Tool-specific memory files (CLAUDE.md, .cursorrules, …) should contain one
line: "Read AGENTS.md and follow it."

## What this site is

A static reference work on Indian economic statistics: 13 guides, ~3,800
data series, build-time-rendered charts, mechanically verified prose. No
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
.github/workflows/update.yml ─► release PR ⑦ PUBLISH  human merges; deploy.yml ships it
```

Hard rules — breaking any of these is a bug regardless of what else works:

1. **Never splice across instrument seams.** Different base years / methodologies
   are different rulers; they live in separate bundles, never one series.
2. **Missing data is `null`, never 0, never gaps in the array.** Interior nulls
   must be declared in the `gaps` of the very series that misses them
   (CONTRACT-series rule 2; bundle-level `meta.gaps` is retired).
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
| `npm run qc` | post-build gate (numbers + chart geometry lint); run AFTER a build |
| `npm run lint:charts` | chart geometry lint alone (collisions, overlaps, bleeds, clips) |

## Where things live

- `docs/GOAL.md` — the mission, stated plainly; the current, operative edge
- `docs/VISION.md` — the founding brief; the north star. Tactics never override these two.
- `docs/ARCHITECTURE.md` — the system shape + the multi-source expansion model
- `docs/DESIGN.md` — the design system: tokens, typography, dossier anatomy,
  chart engineering, rejected directions. Normative; elevate, never redesign.
- `docs/HISTORY.md` — lineage: what was tried, rejected, retired, and why
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
- `docs/reference/` — source reverse-engineering notes (eSankhyiki API)
- `skills/` — task playbooks for agents (see skills/README.md)

## Contracts you must not violate

- `docs/CONTRACT-series.md` — the canonical bundle shape
- `docs/CONTRACT-render.md` — chart/page rules and budgets
- `docs/CONTRACT-dossier-structure.md` — the normative dossier flow
- `docs/RUNBOOK-sources.md` — how to add a data source (follow it exactly)
- `docs/RELEASE-CHECKLIST.md` — what a human reviews before merging a release

## When you finish any task here

Run `npm run gates` (after a build if you touched anything render-side).
If you touched data or prose, run `npm run prose:dry` too. Do not commit
unless asked. Never edit `data/raw/` by hand — it is the audit trail.
