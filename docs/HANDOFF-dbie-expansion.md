# Handoff: populate India Atlas from RBI DBIE

Written 2026-10-09 for a fresh Claude Code session. You have full permissions. Work
autonomously, carefully and in order. The owner reads results, not process: keep
`docs/STATUS-dbie-expansion.md` current (what is done, what is next, what is blocked)
after every step.

## The goal

India Atlas (this repo) is a static reference site of plain-language **guides** to India's
official economic statistics. It has 13 guides today, mostly MoSPI data. The Data Bank
(`~/Documents/Data/Data bank`) can now mirror almost everything on the RBI's DBIE: 1,243
of 1,414 statistical reports (about 76 million rows) through the SAP "webi" route, the 252
Data Query (CAS) tables, and RBI publications (policy rates, MPC, lending and deposit
rates, auctions). Your job:

1. **Download**: bring the Data Bank's RBI holdings up to date, using its own CLI and rules.
2. **Map**: decide which families of RBI data become new guides, and which deepen
   existing ones.
3. **Populate**: build them into India Atlas, one family at a time, each one finished,
   verified and gated before the next starts.

## Read before you touch anything

India Atlas (this repo):
- `AGENTS.md`: the operating manual and the five hard rules. Obey them literally.
- `docs/GOAL.md`, `docs/VISION.md`: what a guide is for.
- `docs/ARCHITECTURE.md`, `docs/RUNBOOK-sources.md`: how a source enters the pipeline.
- `docs/CONTRACT-series.md`, `docs/CONTRACT-dossier-structure.md`, `docs/CONTRACT-render.md`.
- `docs/DESIGN.md` (v2, October 2026): tokens, type, chart rules, guide anatomy.
- `src/pages/guides/cpi.astro` + `src/dossiers/cpi.client.js`: the template guide.

Data Bank:
- `AGENTS.md`, `README.md` (its design rules: raw data is immutable, contracts first,
  quarantine failures, never fill data with guesses).
- `docs/RBI_DBIE_WEBI_RUNBOOK.md`, `docs/RBI_DBIE_SOURCES.md`, `docs/RBI_PUBLICATIONS_SOURCES.md`,
  `docs/PRE_INGESTION_HARDENING_PLAN.md`, `docs/CURRENT_STATUS.md`, `docs/WORK_QUEUE.md`.

## Phase A: downloads (in the Data Bank)

- Refresh what is due with the Data Bank's own commands, for example
  `uv run databank raw fetch-rbi-dbie-webi --all`, then the inventory, audit and
  `parse run` steps in the runbook. Be polite to RBI: one report at a time, as the
  client already enforces. A full pass can take hours; it resumes safely if interrupted.
- Bring the RBI publications datasets up to date per `RBI_PUBLICATIONS_SOURCES.md`.
- Respect the pre-ingestion gates. Do not start broad historical backfills the hardening
  plan has not cleared. Never commit data, logs, caches or secrets to the Data Bank's git;
  never print tokens or credentials.
- Record what you ran and what changed in the Data Bank's `docs/CURRENT_STATUS.md`, in its
  existing style.

## Phase B: the coverage map (write `docs/PLAN-dbie-coverage.md` here)

Group the RBI holdings into families and, for each, say: the reports or tables it draws
on, frequency and history, what a reader learns from it, and whether it becomes a new
guide or extends an existing one. A likely shape, to test against the data:

- **Money and banking**: reserve money, money supply (M3), bank deposits and credit,
  credit by sector and by state (BSR), credit-deposit ratios.
- **Interest rates and monetary policy**: repo and policy corridor, MPC decisions and
  votes, lending and deposit rates (WALR, WADTDR, MCLR), money-market and G-sec yields.
- **Public finance**: central and state government finances, deficits, debt, market
  borrowing and auctions.
- **External sector, deeper**: extends the existing External account guide (BoP detail,
  FDI and FPI, external debt, REER and NEER, ECBs).
- **Banking sector health**: NPAs, capital adequacy, bank group comparisons.
- **Financial markets and payments**: CP and CD issuance, digital payments volumes.
- **Household finance**: household savings and debt, where RBI publishes them.

Rules for the map: MoSPI stays the source of record for CPI, WPI, IIP and GDP; RBI copies
of those are cross-checks, never a second guide. Prefer families with long, clean, regular
series. Rank by how much an ordinary Indian reader gains. Put the ranked list at the top.

## Phase C: populate, one family at a time

For each family, in ranked order, finish all of this before starting the next:

1. **Adapter** `scripts/lib/products/<name>.mjs`, registered in `data/sources.yml`, reading
   the Data Bank's parsed (or warehouse) outputs through a deterministic, re-runnable
   export. Archive what you read in `data/raw/` (the audit trail; never edit it by hand).
2. **Bundles** in `data/series/` exactly per `CONTRACT-series.md`: one instrument per
   bundle, never splice across bases or methods, missing values are `null` and declared
   in the series' `gaps`, `meta.vintage` is the data vintage, `meta.coverage` describes
   the file in plain words, `meta.source` names the agency. Extend `scripts/validate.mjs`
   with the family's identities and ranges.
3. **Guide** (or extension of an existing guide): registry entry in
   `src/dossiers/registry.js` (including `title`, the reader's name for the topic), a
   `HEADLINE` and `SPARK` entry in `src/dossiers/headline.js`, a page
   `src/pages/guides/<slug>.astro` following the template's anatomy (title block, the
   current reading with what the print says and does not say, plates whose titles state
   the finding, "How to read this" and dated "As of" notes, misreadings,
   `<GuideData slug=... />`, sources), chart code `src/dossiers/<slug>.client.js` using
   `src/charts/plumbing.js` and the v3 chart rules, a `qc.mjs` PAGES entry, `asof`
   manifest entries, an OG card in `scripts/og.mjs`, and prose slots wired through the
   pipeline (`pipeline/corpus`, `pipeline/slots.yml`).
4. **Gates**: `npx astro build`, `npm run gates`, `npm test`, `npm run prose:dry` all pass.
   If `.env` has LLM keys, generate the family's prose with `npm run prose` and make sure
   `pipeline/verify.mjs` and `pipeline/lint.mjs` pass on it.
5. **Look at it**: render the new guide at 1440px and 390px (Playwright with
   `/usr/bin/google-chrome` works), read every chart, download one share image, fix what
   is wrong.
6. **Record**: update `docs/STATUS-dbie-expansion.md`, `docs/HISTORY.md`, and the docs the
   change touches.

## The bar

- Every number in prose traces to the facts sheet. Nothing is estimated unless the chart
  says so. Gaps stay visible.
- Design v2 only: one ultramarine accent for the series a chart is about, marigold only for
  a comparison, grey for the rest; text never wears a series colour; sentence case; no
  tracked capitals; no em dashes or middle-dot strings in anything a reader sees.
- Writing: plain Indian English, short sentences, no AI tells (`pipeline/banned.txt`),
  "we do not know" when true.
- Generalise fixes; never hardcode around one report's quirk without a comment saying why.

## Working rules

- Work on a local git branch `dbie-expansion` in this repo. Never push. Do not commit
  unless the owner's instructions at launch say you may.
- If a source is blocked, broken or ambiguous, write it down in the status file and move to
  the next family. Never fabricate, never fill from memory.
- Stop when the ranked families are done or when you hit something that needs the owner's
  decision; in both cases leave the status file ready to read on a phone: short, plain,
  what is live, what is next.
