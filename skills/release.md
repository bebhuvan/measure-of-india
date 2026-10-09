# Skill — cut a release

Execute this file top to bottom. Prerequisites: read AGENTS.md. The human
review portion is `docs/RELEASE-CHECKLIST.md`.

This skill covers MANUAL releases (operator-requested, usually because a
source dropped outside the cron calendar, or prose was fixed by hand).
Scheduled releases run the same gates in `.github/workflows/update.yml`.

## Steps

1. **Pre-flight.** Working tree clean? If not, stop and ask the operator.
2. **Fetch + validate.**
   ```
   node scripts/fetch.mjs && node scripts/validate.mjs
   ```
   On failure: report the failing check and the raw dump it contradicts. Do
   not hand-edit anything to make validate pass.
3. **Facts + prose.**
   ```
   npm run prose
   ```
   (If no LLM keys: `npm run prose:dry`, tell the operator dated prose will
   be stale, and STOP — the QC freshness gate will correctly fail a build
   whose data moved without prose. Data and prose move together or not at
   all.)
4. **Build + gates.**
   ```
   npx astro build && npm run gates
   ```
   (`gates` = validate + as-of + qc + chart lint. An as-of failure means a
   hand-written paragraph still describes the previous print — follow
   `docs/RELEASE-CHECKLIST.md` §1b: re-read, edit, `--refresh`, re-run.)
5. **Branch + PR.**
   ```
   git checkout -b release/$(date -u +%Y-%m-%d)
   git add data/series data/raw pipeline/out src dist
   git commit -m "data: new vintage $(date -u +%Y-%m-%d)"
   git push origin release/$(date -u +%Y-%m-%d)
   gh pr create --fill --body "Gates: validate, as-of, build, qc all green locally. Reviewer: docs/RELEASE-CHECKLIST.md."
   ```
   Adapt the tool (`gh`) to whatever PR mechanism the operator uses if gh is
   unavailable. NEVER push to main.
6. **Report.** PR URL + a three-line summary: what data changed, which
   dossiers affected, prose slots regenerated. Do not merge unless the
   operator explicitly says to.

## Definition of done

PR open, gates green in CI, human reviewer handed the checklist link.
