# Skill — add a data source

Execute this file top to bottom. Prerequisites: read AGENTS.md. The binding
contracts are `docs/RUNBOOK-sources.md` (full detail; this file is the
compressed execution order) and `docs/CONTRACT-series.md` (bundle shape).

## Inputs you must obtain first (ask the operator if missing)

1. Source URL(s) and access notes (API key? login? legacy TLS?).
2. Target dossier and what question the data answers there.
3. Cadence + release day, base years / methodology seams.

Do not proceed on assumptions about any of the three.

## Step 0 — the census (mandatory)

Run `node scripts/census.mjs <target-dossier>` (or `--bundle <slug>` for an
existing bundle) and follow `skills/analyze-series.md`: read the whole
inventory and produce the coverage ledger before registering or adapting
anything. The ledger decides which cuts the adapter must extract and which
sections the dossier needs — bias toward comprehensiveness, skips need
written reasons.

## Steps

1. **Registry.** Add the entry to `data/sources.yml`: `family`, `geo`,
   cadence, release-day rule, base years, plausibility ranges. A new family
   needs its `scripts/lib/<family>.mjs` wrapper first. A new DOSSIER also
   needs its entry in `src/dossiers/registry.js` (calendar, bands,
   proseConstants) — every surface derives from it.
2. **Adapter.** Create `scripts/lib/products/<name>.mjs` exporting
   `build<Name>(ROOT, dcfg, VINTAGE)`:
   - network via the family client (on `scripts/lib/net.mjs`) only;
   - tabular parsing via `scripts/lib/tabular.mjs` only;
   - rows addressed by content (labels/codes), never position;
   - a loud anchor assertion for "source served nothing";
   - `writeRaw()` the archival dump before `writeSeries()` the bundles;
   - nulls for missing, separate bundles per base year, vintage = data
     vintage, `meta.geo` from `dcfg.geo`.
3. **Wire into fetch.** Register the product in `scripts/fetch.mjs` under the
   right dossier.
4. **Validate.** Add source-specific checks to `scripts/validate.mjs`
   (cadence, ranges from sources.yml, identities, seams). A source without
   an identity check is not done.
5. **Render.** Import bundles in the dossier's `.client.js`; charts via
   `src/charts/plumbing.js`. Follow `docs/CONTRACT-render.md`.
6. **Verify rendered numbers.** Add checks for the title-block numbers to the
   dossier's `PAGES` entry in `scripts/qc.mjs` — qc refuses to run a registry
   dossier that has none.
7. **Prose (only if the dossier has dated slots).** Extend
   `pipeline/slots.yml` — `requiredFigures` plus the coverage floors
   (`minSeriesMentioned`, `mustName: [extremes]`,
   `mustAcknowledge: [contradictions]`); declare the sibling bundles the
   writer must see as the registry's `proseInputs`; confirm
   `pipeline/facts.mjs` exposes them. The render-side playbook is
   `skills/write-dossier.md`.
8. **Prove it, in order:**
   ```
   node scripts/fetch.mjs only <name> && node scripts/validate.mjs
   npx astro build && node scripts/qc.mjs
   npm run gates      # validate + asof + qc + chart lint
   npm run prose:dry   # if slots changed
   ```
9. **Report.** List files added/changed, the anchor you asserted, the
   identity checks you added, and gate output tail. Do not commit unless
   asked.

## Definition of done

All gates green + one spot-check where you traced a rendered number back to
a `data/raw/` dump cell by hand, stated in your report.
