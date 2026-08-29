# Skill — analyze a data series (the pre-writing census)

Execute this file top to bottom. Prerequisites: read AGENTS.md. This skill is
the MANDATORY first step of any task that touches a dossier's prose, charts,
or structure — writing before the census is how data points get silently
missed, and missing them is the one failure this repo treats as a bug.

The bias of every judgement below is toward comprehensiveness: a cut you
leave out must be left out because you read it, weighed it, and wrote down
why — never because you didn't look.

## Step 1 — Run the census

```
node scripts/census.mjs <dossier>       # every bundle of the dossier
node scripts/census.mjs --bundle <slug> # one bundle in isolation
```

The output lands in `pipeline/out/census-<dossier>.json` and prints a
summary: bundle inventory, per-series spans/latest/deltas/min/max/runs/gaps,
cross-bundle rankings, headline contradictions. Read the WHOLE JSON, not
just the summary — for a dossier like CPI that is ~660 series across 14
bundles, including the 358-item ledger. You may read it in chunks; you may
not skip bundles.

## Step 2 — Account for every series (the coverage ledger)

For every bundle, sort its series into one of four buckets and keep notes:

1. **Lead** — series that carry the current story (headline, hottest and
   coolest movers, series in a notable run, series that contradict the
   headline's direction).
2. **Show** — series the dossier's structure contract assigns a section to
   (composition cuts, states, gender, fractiles, sectors) even when quiet.
   Quiet ≠ absent: the anatomy sections exist precisely so the reader sees
   the whole machine, not just the moving parts.
3. **Summarize** — too granular to plot each (the 358-item tail) but
   aggregable: count how many rise/fall, name the median and the extremes,
   compare the tail against the headline.
4. **Skip** — everything left. Each skip needs a one-line written reason
   ("source serves states only from 2021", "duplicate ruler of series X on
   the retired base"). An unstated skip is a defect.

If you cannot fit a series into a bucket, you have not read enough of the
data yet — go back to the bundle before deciding.

## Step 3 — Read the institutional context

- `data/sources.yml` entry for the dossier: cadence, release rules, base
  years, revision policy, the BASE-YEAR RULE, and the per-series comments
  (they encode past audit findings — imputation, source defects, seams).
- `pipeline/corpus/<slug>.yml` if it exists: the dossier's voice, known
  misreadings, and what the instrument does not measure.
- `meta.note` on every bundle, and per-series `gaps` / `gapsNote` /
  `estimated` on every series you touch: disclosed defects are editorial
  facts, not noise.

## Step 4 — Decide the story structure (broad → granular)

Propose the dossier flow in this order and check it against what the census
actually showed:

1. The broad data points — what the headline is and is NOT.
2. Context — evergreen explanation plus the current reading, anchored in
   lived reality (rupees, wages, household budgets).
3. The granular cuts — every bucket-1 and bucket-2 series from Step 2, each
   with its interpretation.
4. Misreadings — the traps this specific print will trigger (base effects,
   sample limits, revision policy).

A proposed structure that names fewer series than your Step-2 buckets 1+2 is
wrong by construction — revise it, don't argue with it.

## Step 5 — Say what you do not know

Where the census shows nulls, short spans, design breaks, or quarantined
series, the output must carry the limitation forward, not paper over it.
"We do not know" is a permitted editorial outcome (VISION.md principle 6).

## Definition of done

- `pipeline/out/census-<dossier>.json` exists and is fresh (regenerate it;
  it is deterministic, so re-running is free).
- Your report contains the Step-2 coverage ledger in full: every bundle,
  every bucket with counts, and every skip reason.
- No prose, chart or structure change has been made yet — those follow the
  other skills (add-source.md, write-dossier.md) and the contracts in docs/.
