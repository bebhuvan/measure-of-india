# Wave 2: deepening the existing guides

Wave 1 built eleven new families. Wave 2 goes back to the guides that existed before the
launch build and closes their known gaps. When the framework session first wrote ledgers
for those guides (2026-10-09), it found 146,853 catalogue items the guides did not cover;
each sits in its ledger as one final `pending` rule with a `scheduled:` label naming the
wave-2 work that owns it. Your job: **decide every pending item in your families' ledgers**
and deepen the guide to match. When you finish, your ledgers have no `pending` rule and
`node scripts/coverage.mjs --strict` reports nothing pending for your families.

Everything in `docs/briefs/README.md` applies (read it again: it has grown). In particular:

- You now own the existing guide's files (page, client, adapter, corpus) for your family.
  Change them as the work needs; keep the guide's structure (`CONTRACT-dossier-structure.md`)
  and design v2.
- **Deciding an item** means one of: bake it (`baked`, in a bundle, in every-cut and the
  downloads); draw it (`shown`, on a plate whose title states the finding); `excluded` with
  a reason about the data; `blocked` with the error and date; or, for a finer grain than a
  chart bundle can carry, `excluded` + `archive: true` + `rolls_up_to` (the deep archive,
  `docs/PLAN-launch.md` §2b; stage the files in `data/archive/staging/<family>/` as long-format
  csv.gz, as trade did, and don't upload).
- Comprehensive means **every indicator at every granularity the source publishes is
  reachable**. Charted where it carries a finding, baked where it doesn't, archived where
  it's too big. Never excluded for being numerous.
- **Prose:** regenerate your guide's dated prose after the deepening (proseInputs may grow),
  verify it with the strict verifier (every figure, not only percents), and read it by hand
  against the data. Tracing proves a figure exists in the sheet, not that the sentence
  attaches it to the right period: that is your job.
- **"As of" notes** (`pipeline/asof.mjs`): every claim a hand-written note makes must still be
  true after the deepening. Re-read them all.
- **MoSPI is shared** by four wave-2 sessions at once and throttles hard. Use
  `scripts/lib/mospi.mjs` only (cache, throttle, backoff); never parallelise calls; on 429
  or 5xx back off longer and keep going. Long downloads: make them resumable and run them
  in the background while you build other parts.
- **launch-build will move under you** (the framework session is changing raw dumps to
  gzipped files and adding the archive builder). When I tell you it moved, `git merge
  launch-build`; conflicts in adapters will be small (the raw read/write helper calls).

When done: build, gates, npm test, prose:dry, verify all your prose, `coverage --strict`
clean for your families, page looked at 1440 and 390, status file written, message
`economic-atlas-new-kimi-38` "<slug>: done".
