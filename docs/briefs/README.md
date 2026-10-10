# Briefs: how a family session works

The launch build (`docs/PLAN-launch.md`) runs as several Claude Code sessions at once, one
per family, each in its own git worktree. A coordinator session (`economic-atlas-new-kimi-38`)
owns the `launch-build` branch, merges finished families, and builds shared framework. This
file is the contract every family session follows; your family's brief is next to it.

The owner (Bhuvanesh) follows along from a phone. Keep your status file readable there.

## Read first, in this order

1. `AGENTS.md` (the five hard rules; obey them literally).
2. `docs/GOAL.md`, `docs/VISION.md`: what a guide is for. The owner's bar for this build:
   comprehensiveness is why people will come. Explain *every* indicator the family has, at
   *every* granularity the source publishes, and connect it to how an Indian lives.
3. `docs/PLAN-launch.md` (sections 2, 3, 6 especially) and `docs/CONTRACT-coverage.md`.
4. `docs/CONTRACT-series.md`, `docs/CONTRACT-dossier-structure.md`, `docs/CONTRACT-render.md`,
   `docs/DESIGN.md`, `docs/RUNBOOK-sources.md`.
5. `skills/add-source.md`, `skills/analyze-series.md`, `skills/write-dossier.md`.
6. The template guide: `src/pages/guides/cpi.astro` with `src/dossiers/cpi.client.js`. The
   newest guide, `deposits`, shows a Data Bank adapter (`scripts/lib/products/bsr2.mjs`).
7. Your family brief.

## Where you work

- Your worktree is `~/Documents/Bhuvan projects/atlas-worktrees/<slug>` on branch
  `lb/<slug>`, cut from `launch-build`. Work only there. Never touch the main work tree
  (`Economic atlas new Kimi`), another worktree, or another branch.
- `node_modules` is a symlink to the main tree's; do not run `npm install` (if you truly
  need a new dependency, ask the coordinator instead).
- Preview on your own port: `npx astro preview --port <your port>` (port in your brief).
- Playwright for looking at pages: `playwright-core` with
  `executablePath: '/usr/bin/google-chrome'`. Install it in a scratch directory outside
  the repo, never into the repo's `package.json`.

## Disk (one machine, many sessions)

The machine's disk filled once (2026-10-10, 00:10) with several sessions building at once.
Delete your `dist/` after each check (about 700 MB per build; rebuildable), keep
`data/raw/http-cache` trimmed to what you still need, hard-link or stream large files rather
than copying them, and stage anything archive-sized in `data/archive/staging/<family>/`. If
a write fails with ENOSPC, message the coordinator; never delete anything outside your
worktree.

**At most two builds at a time on the machine.** Every build-and-check runs in one of two
shared slots (`scripts/build-slot.sh`, also at `/tmp/atlas-build-slot.sh` for branches that
have not merged it yet), so memory and disk hold two builds' worth however many sessions
run, and dist is deleted inside the slot:

```
/tmp/atlas-build-slot.sh sh -c 'npx astro build && npm run gates; s=$?; rm -rf dist; exit $s'
```

(This replaced a single `flock /tmp/atlas-build.lock` on 2026-10-10: one slot queued four
sessions for over an hour, since a full gates run takes 15 to 20 minutes.) `npm test`,
`validate`, `coverage` and `prose:dry` need no build and run outside the slots. Looking at
pages (Playwright at 1440 and 390) needs `dist`: build, look and delete inside one slot.
Never leave a `dist/` behind.

## Files you own, files you share

- **Own** (create freely): everything named for your slug: `data/series/<slug>-*.json`,
  `data/raw/<slug>-*`, `data/coverage/<slug>*.{yml,json}`, `scripts/lib/products/<adapter>.mjs`,
  `src/pages/guides/<slug>.astro`, `src/dossiers/<slug>.client.js`, `pipeline/corpus/<slug>.yml`,
  `public/og/<slug>.png`, `docs/reference/<source>.md`, `docs/status/<slug>.md`.
- **Read, never modify**: other families' bundles and adapters. You may chart another
  guide's bundle if your guide needs it (say so in your status file). If someone else's
  bundle needs a change, write it in your status file and message the coordinator.
- **Shared, append only**: `data/sources.yml`, `src/dossiers/registry.js`,
  `src/dossiers/headline.js`, `src/dossiers/periods.js`, `scripts/validate.mjs`,
  `scripts/qc.mjs`, `scripts/og.mjs`, `pipeline/asof-manifest.json`, `pipeline/slots.yml`.
  Add your entries as one contiguous block, marked with a comment naming your slug where
  the format allows. Do not reorder, reformat or "tidy" anything else in these files: the
  coordinator merges ten branches and every unrelated edit is a conflict.
- **Don't edit**: `docs/STATUS-launch.md`, `docs/HISTORY.md`, `docs/PLAN-launch.md`,
  `AGENTS.md`, shared chart code in `src/charts/` (if plumbing needs a change, ask), other
  families' `public/og/*.png` (generate only your own card).
- Generated shared outputs (`pipeline/out/prose-manifest.json`, census files) will conflict
  at merge; that is expected and the coordinator regenerates them.

## Data sources

- **The Data Bank** (`~/Documents/Data/Data bank`) is **read-only** for you. Never run its
  fetch, parse, update or backup commands, never write there. Read it through
  `scripts/lib/databank.mjs`: `dbieReport(root, reportId)` for the raw DBIE webi mirror, and
  `databankQuery(root, dataset, sql)` for parsed datasets (it shells
  `uv run databank query sql <dataset> "<sql>" --json`; dedupe, since a view can hold the
  same observation once per parse run). If data you need is missing or stale there, record
  it as `blocked` with the date and tell the coordinator; do not fetch RBI live.
- **DBIE values**: most reports repeat each value once per display unit (ACTUALS, LAKHS,
  CRORES): filter to one unit. Many carry Provisional / Partially Revised / Revised rows:
  keep the latest final version per date and say which. Check one value per bundle by hand
  against the RBI's own publication (Bulletin, Handbook, press release) and record the
  check in the adapter header.
- **MoSPI** is shared by several sessions and throttles hard: use `scripts/lib/mospi.mjs`
  (cache, throttle, backoff), one request at a time; on 429 or 5xx back off, don't hammer.
- **India Data Hub** is a paid service: never put its values in this repo. The coordinator
  runs the IDH cross-check; in your status file, list the IDH series ids that match your
  bundles if you find them (the Data Bank's `india_data_hub_series`, read-only).
- New external sources (ILO, OWID, World Bank, CCKP, TradeStat) get a transport in
  `data/sources.yml`, polite fetching through `scripts/lib/net.mjs`, an archived raw dump,
  and a `docs/reference/<source>.md` with what you learned about the API.

## The bar (from PLAN §6; all of it, not most of it)

1. Adapter, registered, archived to `data/raw/` (never hand-edited), plus a **catalogue
   generator** for the coverage ledger.
2. Bundles per `CONTRACT-series.md`; family identities and ranges in `validate.mjs`; one
   hand-checked value per bundle.
3. Coverage ledger complete (`npm run coverage` clean for your family).
4. The guide: broad, context, granular cuts, misreadings; lived-reality translation
   throughout; "How to read this" and "As of" notes; registry, headline, periods, OG card,
   qc PAGES, asof manifest, prose slots.
5. `npx astro build`, `npm run gates`, `npm test`, `npm run prose:dry` all green. Generate
   prose with `npm run prose` (keys in `.env`, a DeepSeek model) for your slug only, and
   read every generated file by hand against the data: the verifier cannot catch a
   sentence that contradicts its own paragraph.
6. Look at it at 1440px and 390px; read every chart; download one share image.
7. The every-cut table on your guide (`<EveryCut slug="<slug>" />` before `<GuideData>`;
   how-to: "Note for family sessions" in `docs/status/framework.md`), every series with a unit
   it can show (`npm test` checks), two-ruler charts drawn with `seamMarks` from
   `src/charts/plumbing.js`, and no `pending` item left in your own ledgers.
8. Write `docs/status/<slug>.md`.

Writing: plain Indian English, short sentences, no em dashes, no AI tells
(`pipeline/banned.txt`), "we do not know" when true. Never estimate, splice or fill from
memory.

## Commits and reporting

- Commit to `lb/<slug>` at each coherent step, with the gates green at that commit where
  you can. Clear messages; end each with the attribution lines your harness gives you.
  **Never push, never rebase.** The coordinator merges your branch into `launch-build`.
  The one merge you do: when the coordinator says `launch-build` has moved, run
  `git merge launch-build` on your branch (resolve conflicts keeping both sides' blocks in
  shared files; never discard someone else's block), then re-run the gates.
- No subagents (they are expensive): do the work in this session.
- `docs/status/<slug>.md` is your log, kept current after every step: what is done, what
  is next, what is blocked, decisions you took and why (the coordinator folds these into
  `docs/HISTORY.md`), every source quirk. Short and plain, readable on a phone.
- When you finish, or when you are blocked on something only the owner can decide, send
  one message to the coordinator session `economic-atlas-new-kimi-38` with SendMessage
  (first line: `<slug>: done` or `<slug>: blocked: <why>`), then stop. Don't wait idle for
  replies mid-task: decide, record the decision in your status file, and keep going.
