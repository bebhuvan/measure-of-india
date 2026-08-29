# PLAN — launch readiness & the comprehensiveness framework

*Derived from a full backend audit (data layer, adapters, validator, prose
pipeline, gates, CI). Each item names the file that changes. Phases are
ordered by dependency: the coverage framework (P1) is what makes dossiers
comprehensive by construction; the operational fixes (P2) make the machine
trustworthy; the authoring framework (P3) is what lets an agent add series
N+1 without you re-explaining anything.*

**PROGRESS (2026-08-29):** P2.1–P2.4 done and gated (CI workflows +
`ci.yml` PR gate; freshness floors in `sources.yml`/`validate.mjs` incl.
`latestPeriod`↔axis consistency and vintage sanity; per-product fetch
isolation + `mospi.mjs` fatal-retry fix; `net.mjs` byte-accurate cap +
redirect following). P1.1 done: `scripts/census.mjs` (`npm run census`),
byte-stable, verified on all 16 dossiers. P3.1 done:
`docs/CONTRACT-dossier-structure.md`. P3.2 done: `skills/analyze-series.md`
(wired into `skills/add-source.md` as its mandatory step 0).
**P1.2–P1.6 done:** P1.2 — registry `proseInputs` per prose dossier;
`pipeline/lib/census-core.mjs` shares the census's per-series/cross-bundle
logic with `facts.mjs`, whose `cross` is now generic for every dossier
(rank, extremes by level and by delta, spread, contradictions, counts
above/below the headline) plus per-bundle `proseInputs` summaries (top /
bottom / spread / tail counts-and-median for 358-item cuts). P1.3 —
`generate.mjs` prompts carry all-series SIGNALS (top-3 runs, base effects,
band streaks) and a COVERAGE enumeration (every series with status, every
deep cut summarized); the dry run now prints the prompt's tail. P1.4 —
`pipeline/lib/series-kws.mjs` is the one keyword map (verify + contract +
generate); `contract.mjs` enforces `minSeriesMentioned`, `mustName:
[extremes]`, `mustAcknowledge: [contradictions]`; slots.yml declares floors
on all 7 what-the-print-says slots; **qc re-runs contract.mjs on every
manifest slot post-build**, so the floors are release gates, and the P1
exit test (a print-paragraph ignoring the hottest division) fails as
required. P1.5 — the negative guard in verify.mjs rejects record/extreme
claims the cross facts contradict (multi-series sentences judged
conservatively). P1.6 — `pipeline/asof.mjs` + `pipeline/asof-manifest.json`
govern all 111 hand-written "As of" paragraphs: a block bound to a bundle
whose print advances fails the gates until re-read and `--refresh`ed; wired
into `npm run gates`. **P2.5–P2.10 done:** P2.5 — disclosure moved to per
series (`series.gaps`/`gapsNote`, first-class `series.estimated` with
validate checks); `writeSeries` migrates the legacy bundle-level shape by
construction; all 19 affected bundles rebaked in place (no refetch);
cpi.mjs emits per-series estimated (headline/core). P2.6 —
`src/dossiers/display.js` derives `dateStamp`/`vintageLabel` from bundle
meta (registry keeps derivation styles; explicit text only where no bundle
fact exists); qc verifies every rendered page stamp and homepage vintage
label against the derivation. P2.7 — `src/charts/format.js` is the one
formatter module; qc renders every expected string through it and it is
re-exported from plumbing.js for clients (legacy inline client formatting
remains as debt — new code must use `fmt.*`). P2.8 — the mock story:
DECIDED, dropped (`scripts/lib/mock.mjs` deleted, `data:mock` removed,
validate's mock exemptions gone; rationale in docs/HISTORY.md). P2.9 — the
NFHS checks are un-nested from the mnre-sources callback (an early return
there no longer silences them). P2.10 — frequency exemptions live in
sources.yml (`frequency_exempt: true` for plfs/gender/nfhs). **P3.3 done:**
`skills/write-dossier.md` (skeleton, plumbing rules, registry stamp
derivation, slots + coverage floors, as-of governance, qc obligations);
`add-source.md` points at it. REMAINING: the release-checklist floor-bump
habit (documented; practiced each release); optionally migrate client
inline formatting to `fmt.*` and re-run `npm run prose` when the LLM
account has balance (the four floor-failing slots — cpi/wpi/jobs
print-slots were hand-revised through the full gate chain in the
meantime).

---

## Diagnosis — the root cause of "agents miss data points"

Accuracy per claim is mechanically gated (verify.mjs traces every number,
claim checks are arithmetic, freshness fails the build). **Coverage per
release is gated nowhere.** The LLM that writes a dossier's current reading
literally cannot see ~98% of the baked data:

1. `pipeline/facts.mjs:36-61` reads exactly ONE bundle (the `currentBundle`)
   and only its top-level series. CPI's 43 groups, 358 items, 36 states and
   21 legacy sub-indices live in other bundles — invisible to the writer.
2. `pipeline/generate.mjs:107-108` computes curated SIGNALS (runs, base
   effects, band streaks) for ONE series — `requiredFigures[0]`.
3. `pipeline/contract.mjs` enforces sentence *ceilings* and 2–5 required
   figures — nothing enforces a floor. 10 of 13 divisions can go unmentioned
   and every gate passes.
4. There is no analysis step: no skill forces the agent to read the whole
   basket, rank the cuts, and decide show/don't-show before writing.

So the fix is not "prompt the LLM harder." It is to make **coverage a
mechanical fact** the same way accuracy already is.

Everything else the operator flagged — charting annotation, data cleanliness,
fetching — audits as follows: the chart gates are strong but `qc.mjs:28-270`
hand-duplicates each client's number formatting (false failures, linear
maintenance); data cleanliness is unusually disciplined (base-year rule
enforced in code, raw↔baked recomputation checks); fetching works but has
operational fragility (one adapter throw aborts the whole run, mock mode
covers 8 of 16 products and rots). Those are P2.

---

## P1 — The Coverage Contract (the comprehensiveness guardrail)

### P1.1 The Series Census — `scripts/census.mjs` (new)

The single tool that ends "the agent never read the data." For any bundle
(or dossier), emit a deterministic inventory:

- every series: label, unit, span, latest, y/y, min/max + when, run,
  base-effect flag, nulls/gaps, share of non-null cells;
- cross-series facts: ranking, top/bottom movers, spread, count above/below
  the headline, median-vs-headline divergence, any series whose story
  contradicts the headline;
- the cut census: which bundles exist for this product (groups, items,
  states, sectors, gender…), row counts, and which cuts are deliberately
  skipped — read directly from `data/sources.yml` annotations.

Write it to `pipeline/out/census-<slug>.json`. This is the artifact the
agent MUST produce and read before writing any prose. It is deterministic,
so it is also gateable.

### P1.2 Facts sheet sees the whole dossier — `pipeline/facts.mjs`

- Add a registry-declared `proseInputs` list per dossier: the sibling bundles
  the writer must see (for CPI: `cpi-2024-groups`, `cpi-2024-states`,
  `cpi-subgroups`, `wpi-items`-style deep cuts as summarized field facts —
  rankings and extremes, not 358 raw rows).
- Generalize `facts.cross`: today only CPI has `divisionsAboveHeadline`,
  hardcoded (`facts.mjs:147`). Make the cross facts generic for every
  dossier: rank, extremes, spread, contradictions — computed from P1.1's
  logic. Zero prompt changes needed; the whitelist grows automatically.

### P1.3 COVERAGE block in every prompt — `pipeline/generate.mjs`

Replace the single-series SIGNALS with:

- signals for ALL series (top-3 runs, base effects, band streaks across the
  sheet), and
- a COVERAGE enumeration: every series with a one-line status
  ("not yet mentioned", "hottest mover", "only decliner", "contradicts
  headline").

### P1.4 Coverage floors, mechanically enforced — `pipeline/contract.mjs` + `slots.yml`

Mirror `requiredFigures` with coverage requirements per slot:

- `minSeriesMentioned` (e.g. ≥ 4 of 13 divisions for a CPI reading);
- `mustName: extremes` — the top and bottom movers must appear;
- `mustAcknowledge: contradictions` — if a sub-series contradicts the
  headline story, the prose must say so or the gate fails.

Verification reuses the `SERIES_KWS` keyword maps in `pipeline/verify.mjs:81-89`
(promote them to a shared module so both verify and contract use one map).

### P1.5 Negative guard — `pipeline/verify.mjs`

Once cross facts exist, reject prose that calls the headline an extreme or a
record while any sheet series contradicts it. Cheap, deterministic.

### P1.6 Close the ungoverned channel — the hand-written "As of" paragraphs

Every `.explain .now` paragraph in the `.astro` pages is dated prose with
static numbers, outside verify/lint/freshness — precisely the paragraphs
that narrate the granular cuts. Migrate them into the slot system (generated,
gated, freshness-tracked) or, minimally, give them their own lint + manifest
entry so a stale one fails qc.

**Exit test for P1:** deliberately write a "what the print says" paragraph
that ignores the hottest division → `npm run gates` fails.

---

## P2 — Operational hardening (launch-blocking fixes)

Backend bugs and fragilities found in audit, in priority order:

1. **`npm test` in CI** — neither workflow runs it
   (`.github/workflows/update.yml`, `deploy.yml`). Add a PR workflow running
   `npm test` + `npm run gates`; add `npm test` to release + deploy. Highest
   severity, cheapest fix.
2. **Staleness gate** — `scripts/validate.mjs` never compares
   `meta.vintage`/`latestPeriod` to the release calendar; a frozen site
   passes. Add a per-dossier expected-release check (registry already has
   the cadence).
3. **Per-product error isolation** — `scripts/fetch.mjs:200-208`: one
   adapter throw aborts the rest. Catch per product, collect failures,
   exit non-zero with a summary. Also fix `mospi.mjs:64-86` retrying
   fatal errors (404 retried 6× with exponential backoff).
4. **`net.mjs` size cap counts chars not bytes** (`net.mjs:50`) and no
   redirect handling — both one-line fixes.
5. **Disclosure-shape repairs**: CPI's interpolated housing months live in
   nonstandard `meta.estimated` (`cpi.mjs:67-84`) — either adopt a
   first-class `estimated` contract in validate, or use nulls + gaps.
   `wpi-items.json` declares 121-of-124 dates as bundle-level gaps — move
   gap disclosure to per-series so it means something.
6. **Derive the registry's display strings** — `dateStamp`, `vintageLabel`,
   `register.unit` are hand-typed strings embedding data facts
   (`src/dossiers/registry.js:29-30` admits this); no gate notices when they
   go stale. Derive from bundle `meta` at build; delete the hand-maintained
   fields.
7. **De-duplicate qc formatters** — `scripts/qc.mjs:28-270` re-implements
   each client's formatting (~270 lines, grows per dossier, false-fails on
   any formatter change). Extract shared formatters into a module both the
   client and qc import.
8. **Decide the mock story** — `--mock` covers 8 of 16 products with
   hand-typed metadata that has already diverged. Either generate mocks
   from the same adapters (inject a fetch shim) or drop the branch.
9. **Untangle the NFHS-inside-MNRE nesting** in `validate.mjs:1058-1115` —
   an early return in the MNRE block silently disables all NFHS checks.
10. **Frequency-check exemptions belong in `sources.yml`, not code**
    (`validate.mjs:64`).

---

## P3 — The authoring framework (series N+1 without you in the loop)

### P3.1 Codify the dossier structure — `docs/CONTRACT-dossier-structure.md` (new)

Your proposed flow is correct and the CPI page already embodies it.
Make it normative so structure is a checklist, not taste:

```
1  The headline        — the broad number, what it is and is NOT
2  Lived reality       — the rupee/earnings/household translation
3  How to read this    — evergreen: what the measure measures, the ruler
4  The current reading — generated, gated, coverage-floored prose
5  The anatomy         — composition / sectors / use-based cuts, small multiples
6  The granular cuts   — states, gender, items, fractiles; each with its read
7  Misreadings         — quote/correction pairs
8  Provenance          — every number's path back to source
```

Each section declares its data inputs, its prose source (generated slot vs
evergreen), and its gate. The contract is family-neutral, so a World Bank
dossier follows the same descent.

### P3.2 New skill: `skills/analyze-series.md`

The EDA protocol that runs BEFORE any prose or chart work:

1. Run the census (`scripts/census.mjs <slug>`); read it fully.
2. Enumerate every bundle and cut for the product; for each, decide
   show / summarize / skip-with-reason — bias toward showing. A skip needs
   a written reason in the census, which becomes auditable.
3. Compute the cross facts; identify contradictions with the headline.
4. Only then write: prose must be consistent with the census's coverage
   decisions, and the P1.4 floors enforce it.

### P3.3 New skill: `skills/write-dossier.md`

The missing playbook for the two largest hand-written artifacts per dossier
(page + client module): the section skeleton from P3.1, the plumbing rules
(`src/charts/plumbing.js` header, label-side, no curves), the registry
fields, slots.yml + corpus authoring, and the qc PAGES obligation. Update
`skills/add-source.md` to point at the census step and the structure
contract.

### P3.4 Make the census the intake for new families

When pointing the agent at a World Bank / ILO / UNCTAD / OWID series:
1. family wrapper already exists (`worldbank.mjs`; OWID's CSV path via
   `net.mjs.getText` is built but unused — first adapter will light it);
2. agent runs the census on the raw dump → decides bundles and cuts with
   the comprehensiveness bias → registers the dossier with `proseInputs`
   declaring everything the writer must see → the gates carry the rest.

The framework is source-neutral by design; nothing in P1 or P3 assumes
MoSPI.

---

## What we keep (do not restructure the core)

The pipeline shape is right and unusually disciplined — mechanical base-year
rule, computed-not-trusted aggregates, raw↔baked cell-level recomputation
checks, real vintage archiving, atomic writes, registry-derived gating (a new
dossier physically cannot ship un-gated: `qc.mjs:298-307`). Do not rebuild.
The restructuring is additive: a census layer, coverage gates, two skills,
one structure contract, and ~10 targeted fixes.

## Suggested sequence

1. P2.1–P2.4 (a day of small fixes; makes CI honest).
2. P1.1–P1.2 (census + whole-dossier facts) — the foundation.
3. P1.3–P1.6 (coverage gates) — then re-run prose for the 7 prose dossiers.
4. P3.1–P3.3 (contracts + skills) — then pilot: point the agent at one new
   World Bank series end-to-end and measure the interventions you need.
5. P2.5–P2.10 and the qc formatter de-dup as maintenance.
