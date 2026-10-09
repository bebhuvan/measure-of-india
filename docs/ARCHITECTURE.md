# ARCHITECTURE — how the Atlas is built, and how it grows

The system shape, the directory map, and the multi-source expansion design.
Everything below marked **[live]** is enforced in code today; nothing here
is aspirational — decided-but-uncoded work has no marker and no place in
this document until it exists.

## 1. The pipeline

```
data/sources.yml ─► scripts/fetch.mjs      ① ADAPT    adapters in scripts/lib/products/
                   ─► data/raw/*.json       archival dumps (audit trail, git-tracked)
                   ─► data/series/*.json    ② CANON    canonical bundles
scripts/validate.mjs                       ③ VALIDATE cadence/ranges/identities
npx astro build                            ④ RENDER   pages + charts from baked JSON
pipeline/facts.mjs ─► generate.mjs         ⑤ NARRATE  LLM prose from facts sheets only
pipeline/verify.mjs / lint.mjs / contract.mjs
scripts/qc.mjs + lint-charts.mjs           ⑥ GATE     numbers traced, tells banned
.github/workflows/update.yml ─► release PR ⑦ PUBLISH  human merges; deploy.yml ships it
```

No framework runtime, no database, no client-side data fetching. Everything is
a file, every file has a gate, every gate exits non-zero on failure.

## 2. Directory map

| Path | What it is |
|---|---|
| `data/sources.yml` | source registry: families, cadence, release rules, base years, ranges |
| `data/raw/` | archival dumps + `vintages/` — the audit trail. **Never edit by hand.** |
| `data/series/` | canonical bundles (`docs/CONTRACT-series.md`) |
| `scripts/lib/net.mjs` | THE network client: deadline, size cap, retry, throttle |
| `scripts/lib/<family>.mjs` | one host wrapper per source family (mospi today) |
| `scripts/lib/products/*.mjs` | one adapter per source product |
| `scripts/lib/tabular.mjs` | THE parsing kit: CSV, Indian numerals, messy dates |
| `src/dossiers/registry.js` | **[live]** THE dossier registry — every dossier's metadata |
| `src/dossiers/<slug>.client.js` | one client module per dossier page |
| `src/charts/plumbing.js` | shared chart kit — normative (`docs/DESIGN.md` §5) |
| `src/learn/registry.js` | Learn-section registry — the pattern the dossier registry mirrors |
| `pipeline/` | prose machinery: corpus, voice, slots, facts, gates |
| `test/` | unit tests: period calendars, registry integrity, atomic writes |
| `docs/` | vision, architecture, design, contracts, runbooks |
| `skills/` | task playbooks for agents (see `skills/README.md`) |
| `site/` | design-phase reference implementation (plain HTML, visual spec) |
| `design-mocks/` | design exploration archive (`docs/DESIGN.md` §8) |

## 3. The multi-source model

The first dossier family is Indian official statistics via one host (the
MoSPI eSankhyiki API). Expansion adds two explicit dimensions — **source
family** and **geography** — without changing the contracts.

### Source families **[live]**

`data/sources.yml` gains a top-level `families:` block; every dossier entry
declares `family:`:

```yaml
families:
  mospi:     { transport: mospi,     base: https://api.mospi.gov.in/api/ }
  worldbank: { transport: worldbank, base: https://api.worldbank.org/v2/ }
  # owid lands with its first adapter (needs net.mjs getText — already live)
```

- One thin host wrapper per family in `scripts/lib/<family>.mjs` (the pattern
  `mospi.mjs` sets: family-specific TLS/pagination/cache on top of
  `net.mjs`). Adapters call their family client, never raw `fetch`.
  `worldbank.mjs` handles the WB `[metadata, rows]` envelope. Families in
  service today: `mospi`, `worldbank`.
- `net.mjs` carries `getJson` and `getText` (CSV sources like OWID need the
  text path; parsing stays in `tabular.mjs`).
- The adapter contract is unchanged: `async build(ROOT, dcfg, VINTAGE)` →
  `writeRaw()` then `writeSeries()` (atomic, tmp+rename). Registered in
  `fetch.mjs`'s REGISTRY; `fetch.mjs` validates every dossier's `family`.

### Geography **[live]**

- Every dossier entry in `sources.yml` and every bundle's `meta` carries
  `geo` (ISO3; `IND` for all current series).
- One bundle per indicator per geography. Multi-geography comparisons are
  separate bundles — the one-bundle-one-instrument rule (CONTRACT-series §3)
  extends to geographies: different countries are different rulers.

### Calendars **[live]**

Indian fiscal years (Apr–Mar) are not ambient. Each dossier declares
`calendar: fiscal-apr | calendar` in the registry (all current dossiers are
`fiscal-apr`; World Bank/OWID dossiers will be `calendar`).
`pipeline/lib/periods.mjs` is the one place the semantics live;
`facts.mjs` labels and `verify.mjs` parses through it.

### The dossier registry **[live]**

`src/dossiers/registry.js` is the single source of truth for dossier
metadata: slug, number, title, section, blurb, bundles, current bundle,
spark series, source family, geography, prose slots. Derived from it:
homepage list, register sections, RSS, 404, OG cards, and the page
enumerations of `qc.mjs` / `lint-charts.mjs` — a new dossier cannot ship
un-gated, and adding dossier N touches one file, not fifteen.

### Source-scoped prose semantics **[live]**

Nothing Indian leaks into machinery that serves all families:

- Policy bands (the RBI 2–6% inflation target) are declared per dossier in
  the registry (`bands: {floor, target, ceiling}`), not assumed. Facts,
  prompt signals and verifier predicates use them only where declared.
- The verifier's whitelisted constants (weights, shares, base years) are
  per-dossier `proseConstants` in the registry.
- A dossier without a series-keyword map gets claim-checking **skipped with a
  warning** — never silently verified against an arbitrary series.
- Each new source family hand-writes its `pipeline/corpus/<slug>.yml` before
  prose generation: the corpus is where institutional knowledge (revision
  policy, what the instrument doesn't measure) lives.

## 4. What does not change

- The canonical bundle contract is source-neutral and already holds any
  WDI/OWID series (`docs/CONTRACT-series.md`).
- The vintage machinery: data vintage ≠ fetch date, ever.
- The gates: validate → build → qc → lint-charts, with the as-of freshness
  gate alongside; prose verify/lint/contract;
  human merges the release PR. New families extend the gates, never bypass.
- The design system (`docs/DESIGN.md`) — new dossiers render in the same
  voice and furniture. An international dossier differs in content, not in
  temperament.
