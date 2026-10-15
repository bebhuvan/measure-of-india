---
name: atlas-comprehensive-expansion
description: Temporary launch-expansion skill for India Atlas. Inventory official economic statistics, deepen existing guides and build new guides with every published sub-index and cut accounted for. Use for this repository's coverage expansion, not generic dashboards.
---

# Comprehensive expansion, temporary launch instruction

Owner instruction, 10 October 2026: **when in doubt, more data points, more
granularity, more cuts, more explanations and more charts.** Comprehensiveness
is a selling point. A headline and a few convenient sub-series do not finish
a statistical family.

This skill applies to the current expansion in India Atlas. Keep it in the
repository; do not install it globally or remove it automatically at launch.
The owner may retire it when the expansion is finished.

## Account for the whole family

- Read AGENTS.md and the contracts it names. Run `skills/analyze-series.md`
  before changing guide prose, charts or structure; follow `skills/add-source.md`
  and `skills/write-dossier.md` for implementation.
- Enumerate the source's own complete listing before choosing a headline.
  Cover every sub-index, component, sub-statistic, published frequency and
  historical instrument, including quiet or inconvenient components.
- Audit every published dimension: states, districts, rural/urban, gender,
  age, social group, income/expenditure class, industry, occupation, bank
  group, ownership, trading partner and product where the source serves it.
  Discover actual cross-tabs; never invent a Cartesian cube from separate lists.
- Keep four stages distinct: available at source, archived, canonicalized,
  and accessible in a guide. Count charts and explanations separately.
  A download, a green ledger or a state-profile tile is not a finished guide.
- A source-level exclusion from state profiles does not exclude it from the
  Atlas. National-only surveys need a national destination.
- Keep the long history as separate rulers at methodology seams. Keep primary
  agency data, international harmonized estimates and model projections distinct.
- Record every omission with a statistical or source reason and evidence.
  "Too many", "not needed for the headline", and "can add later" are not reasons.
  An unfinished cut stays scheduled and unfinished, never relabelled complete.

## Make the depth usable

- Follow the existing detailed guides and editorial design. Explain the broad
  measure, its lived relevance, components, detailed cuts and misreadings.
- Give each substantive dimension a chart or coordinated set of charts and
  a plain-language explanation. Add charts when they answer another question;
  do not fill a page with repetitions of the headline.
- All fine cuts must be discoverable through EveryCut and downloads. Large
  cubes belong in the validated deep archive with meaningful baked roll-ups.
  Archive completeness and uploaded availability must be checked separately.
- A searchable tail supplements the analytical plates; it does not substitute
  for explaining a major family of statistics. Neither chart counts nor guide
  counts alone prove completeness.
- Do not double-count a copied series as new coverage. International sources
  should add history, geography, definitions or measures the domestic guide lacks.
- Explain gaps, denominators, estimate status, survey universes and units.
  All dated numerical prose still traces through facts sheets and freshness gates.

## Work in complete, reviewable families

Rank by new reader questions answered, verified source readiness and incremental
engineering effort. Prefer already validated local data first. Use sensible
technical defaults and cheap deterministic inspections; do not weaken quality
settings for extraction or writing to save model costs.

Finish one family through adapter, source catalogue, ledger, identities, census,
guide, charts, explanation, facts/prose checks and visual inspection before
calling it complete. Keep the expansion plan and status current. The owner has
authorized expansion into new economic families; routine source and chart choices
do not need repeated approval. Publication follows the human release process.

## Evidence at handoff

Report source items, archived rows, baked series, guide exposure and analytical
plates separately, with the before/after change. Name what remains blocked or
scheduled. Run build, `npm run gates`, `node scripts/coverage.mjs --strict`,
appropriate tests and `npm run prose:dry` when data/prose changes. Inspect the
actual new guide at desktop and phone widths and trace source cells by hand.
Do not claim a new guide exists when only ingestion or planning is finished.
