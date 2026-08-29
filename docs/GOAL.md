# GOAL — the mission, stated plainly

*The operator's articulation of the goal (2026-08). `VISION.md` is the founding
brief; this file is the current, operative statement. When tactics disagree
with either, both win over tactics — this file is the sharper edge.*

## The Mission

Build a living, editorial intelligence atlas of the Indian economy that
rescues public data from fragmented government portals, complex PDFs, and
bureaucratic silos — translating abstract macroeconomic indicators into clear,
honest, unabstracted insights for every citizen.

## The problem it solves

India produces a massive volume of economic and socioeconomic data — MoSPI and
RBI DBIE, ministry press notes, labour surveys. Yet this wealth of information
remains virtually inaccessible to the public: buried in archaic websites,
trapped in raw tables, or sensationalized in soundbite headlines.

Existing open-data platforms focus on plumbing: aggregating spreadsheets and
plotting generic, uncontextualized charts. They show the *what* and fail to
explain what it means, what it does **not** mean, and why it matters to daily
life.

## The core artifact: the Living Dossier

Dossiers replace isolated charts and sprawling dashboards. A reader encounters
one cohesive page containing:

1. **Lived-reality translation** — what a percentage shift means for real
   household expenses, job stability, purchasing power.
2. **The signal-vs-noise guardrail** — teaching the reader how to interpret
   the print: base effects, sample limitations, common misreadings.
3. **The sub-basket anatomy** — coordinated small multiples isolating internal
   drivers (transient vegetable supply shocks vs broader manufactured goods).
4. **An evergreen economic field guide** — textbook-quality primers embedded
   alongside the data.

## Dossier narrative structure (normative flow)

Broad first, granular last. Every dossier follows the same descent:

1. **The broad data points** — what the headline number is and what it is NOT.
2. **Context** — what is happening, evergreen explanation plus current
   reading, lived-reality anchoring.
3. **The granular cuts** — the detailed sub-series (sectors, states, gender,
   items, fractiles) and the lived realities they reveal, with interpretation.
4. **The misreadings** — how this number is commonly misread, and the honest
   limits of the instrument.

The bias at every step is **toward comprehensiveness**: every agent producing
or revising a dossier must read *all* the data series, sub-series, cuts, and
transformations before deciding what to show — and must be able to account for
anything it chose not to show.

## Key pillars & operating philosophy

- **Accessible prose, zero condescension** — written for the curious,
  non-academic Indian; no opaque jargon ("uptick", "transitory", "exogenous
  shocks").
- **Adaptive, minimalist visual grammar** — Observable Plot / D3 charts as
  editorial illustrations: axes, labels, and highlights adapt to illuminate
  the exact inflection the narrative discusses.
- **Aesthetic discipline** — high contrast, clean typography, generous white
  space, understated accents. No AI templates, gradients, or widget clutter.
- **Automated, deterministic pipeline** — scheduled fetches of official
  releases; arithmetic computed in code, never by the LLM; a context-aware
  LLM pipeline drafting fresh commentary under mechanical gates.

## The expansion path

Start where the data is: MoSPI (CPI, WPI, IIP, NAS, PLFS, HCES, ASI, ASUSE…).
Then extend to World Bank (WDI/Data360), ILO, UNCTAD, Our World in Data, and
the wider UN series — building the best economic atlas of India possible,
with short, long, and very-long-horizon dossiers. Every new source enters
through the same contracts, the same gates, and the same comprehensiveness
discipline; the dossier remains the product.

## What "launch ready" means

- The full pipeline — fetch, validate, render, narrate, gate — runs green
  without manual intervention.
- Each dossier is comprehensive by construction: the agent that builds it
  has mechanically seen every series and cut, and the gates fail on
  omission, not only on error.
- Adding data series N+1 — from any family — requires no bespoke agent
  hand-holding: the framework (registry, census, facts, coverage gates,
  playbooks) carries the completeness.
