# Parked: investor-participation (mutual funds and investor participation)

Parked on 2026-10-15 by the launch cleanup (docs/briefs/launch-cleanup-2026-10-15.md). The guide was
registered but none of its ~42 canonical bundles (`data/series/investor-*.json`) were ever written, so
the tree did not build, `npm test` failed on ENOENT and `scripts/qc.mjs` crashed on import.

## What is here

Files moved out of the live tree, at their original paths:

- `src/pages/guides/investor-participation.astro`, `src/pages/data/[bundle].lineage.json.gz.js`,
  `src/pages/data/investor-source-coverage.json.js` (pages that read the missing bundles)
- `test/investor-client.test.mjs`, `test/investor-source-policy-evidence.test.mjs`,
  `test/fixtures/investor-reviewed-payload.json`
- `registry-entry.json`: the entry removed from `DOSSIERS` in `src/dossiers/registry.js`
- `sources-entry.yml`: the block removed from `dossiers:` in `data/sources.yml`
- `headline-entry.js`: the import, headline record, `HEADLINE` entry and `sparkOf` branch removed
  from `src/dossiers/headline.js`

## What stayed in place, dormant

Everything else keys off registration and does nothing while the guide is unregistered:
`src/dossiers/investor-*.js`, `scripts/lib/products/investor-participation.mjs`,
`scripts/lib/investor-*.mjs`, `scripts/investor-*`, `data/coverage/investor-*`, `data/raw/investor/`.
`scripts/qc.mjs` imports the investor model lazily, only when the registry has the slug;
`scripts/validate.mjs` runs the investor certificate only when `data/sources.yml` lists it.

## To revive

1. Produce the bundles: `node scripts/fetch.mjs investor-participation` must write all 42 canonical
   bundles named in `registry-entry.json` (`bundles`), from the archived AMFI/SEBI originals.
2. Put the three entries back (registry, sources, headline) and add the product back to
   `scripts/fetch.mjs` (`REGISTRY["investor-participation"] = buildInvestorParticipation`).
3. Move the pages and tests back to their paths.
4. `npm test`, `npx astro build`, `npm run gates` green before it ships. Its copy also needs the
   reader-quality pass the other wave-2 guides got (docs/status/launch-cleanup.md).
