# RELEASE-CHECKLIST — what a human reviews before merging

The release PR arrives with every mechanical gate already green (fetch →
validate → as-of → build → QC, run by `.github/workflows/update.yml` and
re-checked by `ci.yml` on the PR itself). The machine has verified numbers,
cadence, identities, rendered output, prose freshness and the hand-written
"As of" paragraphs. Your job is the judgement the machine cannot do.
Five things, in order; budget ten minutes.

## 1. The prose diff (read it like an editor)

- Open each changed `pipeline/out/prose-*.md`. It must describe THIS print:
  correct period named, correct headline, no leftover numbers from the
  previous release (the freshness gate catches the period, not every number).
- Read one paragraph aloud in your head. If it sounds like an LLM pleasing a
  teacher — uniform cadence, hedged verdicts, "in a welcome development" —
  reject the PR with `npm run prose` re-run. The lint gate is a floor, not a
  guarantee.
- Evergreen slots (how-to-read, misread, margin-note) must NEVER appear in
  the diff. If they do, something regenerated what only humans write.
- **Coverage floors are now release gates**: qc re-runs the slot contract
  (sentence ceilings, required figures, `minSeriesMentioned`, extremes,
  contradictions) on every emitted slot. If a floor caught a real omission,
  the regenerating run already failed until the prose covered the sheet —
  read what it now covers, not just what it says.

## 1b. The hand-written "As of" paragraphs

Every `.now` paragraph is governed by `pipeline/asof.mjs`, and the gate runs
in CI (hard in `ci.yml`/`deploy.yml`; `update.yml` flags without blocking so
this review can happen on the PR). If a bundle's print advanced this release,
the gate has flagged every `.now` paragraph bound to it
(`stale "As of" paragraph: <slug>#<figure>`). For each flagged block:
re-read it against the new print, edit its stamp and any claim that no
longer holds, then attest with `node pipeline/asof.mjs --refresh
<slug>#<figure-id>` (or `--refresh-all` for one reviewed dossier). The
refresh is your signature that a human re-read it — do not batch it blind.

## 2. The series diff (scan it like an auditor)

- `data/series/*.json` changes should match the release calendar: a CPI-day
  PR that also rewrites `asi-*` bundles needs a one-line explanation in the
  PR (usually: a source revised history — confirm `meta.note` discloses it).
- Any NEW bundle file: one instrument, one bundle; base year in `meta.base`.
- Any `meta.vintage` bump without a data change is a bug (fetch-date
  stamping). Reject.
- **Staleness floors**: every dossier carries a `stale_after` regression
  floor in `data/sources.yml` (a bundle on its own cadence can override with
  a row-level `staleAfter` in `scripts/validate.mjs`). If a live bundle
  moved forward this release, bump its floor to the new coverage. The floor
  is the editorial claim "this source should never again be seen covering
  less than this" — a release that moves the data without moving the floor
  is leaving the gate asleep. Retired rulers keep their frozen floor; do
  not touch those.

## 3. The raw dump spot-check (one minute)

- Pick one changed series. Open the matching `data/raw/*.json` vintage and
  confirm the number the page will show is the number the source served.
  You are checking the audit trail exists and is load-bearing, not
  re-auditing the source.

## 4. The rendered preview (one plate)

- CI built it; if the PR has a preview URL, open the dossier that changed
  and look at the title block and lead plate. Title correct, axis dates
  current, no `–` placeholders, no NaN. The QC jsdom pass covers the rest.

## 5. The blast radius

- Did anything OTHER than the expected dossier change in `dist` scope
  (shared bundles, plumbing, layouts)? If yes, that change needs its own
  explanation in the PR before merge.

## Merge

- Merge the PR. `deploy.yml` builds from the merged commit (no refetch —
  what was reviewed is what ships), re-runs QC and the as-of gate, deploys.
- If you reject: close the PR, fix (usually `npm run prose` locally, or a
  fetch bug), let the next cron re-open a fresh one. Never push to the
  release branch by hand unless you re-ran `npm run gates` yourself.
