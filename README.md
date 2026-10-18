# Measure of India

India's economy, in numbers: a reference work on Indian official statistics at
**[measure.thisindianlife.today](https://measure.thisindianlife.today/)**.

India publishes a great deal of data and hides most of it on portals that are hard to use. This site
fetches it from the agencies that publish it (MoSPI, the RBI, the Registrar General, the ministries,
and for comparisons the World Bank, the ILO and the BIS), checks it, and builds it into plain pages:
36 guides, a profile of every state and union territory, notes on the ideas, and 2,643 datasets to
download.

- Every figure comes from the agency that published it, and every chart names its source.
- Every number in the prose is traced back to the data by a script before it can be published.
- No trackers, no cookies, no accounts. Visits are counted with Cloudflare's cookieless analytics.

## Follow new figures

- [All feeds](https://measure.thisindianlife.today/feeds/), explained
- [Every new release](https://measure.thisindianlife.today/feeds/releases.xml) (RSS), also as
  [JSON Feed](https://measure.thisindianlife.today/feeds/releases.json)
- One feed per guide, for example
  [consumer prices](https://measure.thisindianlife.today/guides/cpi/feed.xml)

## Contribute

Found a number that differs from its source, or know a dataset that belongs here? Read
[CONTRIBUTING.md](CONTRIBUTING.md). The short version: open an issue, or a pull request that passes
the gates.

## How it works

```
data/sources.yml      the registry of sources, cadences and release days
scripts/fetch.mjs     fetch each source            → data/raw/     (archival dumps, the audit trail)
                      canonicalise                 → data/series/  (one bundle per instrument)
scripts/validate.mjs  cadence, ranges, identities
npx astro build       pages and charts from the bundles (static, no client-side data fetching)
pipeline/             prose written only from facts sheets, then verified number by number
npm run gates         every check that must pass before anything is published
```

The full operating manual is [AGENTS.md](AGENTS.md); the design is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DESIGN.md](docs/DESIGN.md).

## Run it

Node 22 and Python 3.12.

```sh
npm ci
pip install -r requirements.txt
npx astro build            # build from the committed data, no fetching (about 12 minutes, 5 GB RAM)
npm run gates              # the checks a change must pass
npm test                   # unit tests
```

## Licences

- Code: [MIT](LICENSE).
- Text and charts: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Data: each source's data keeps its own terms; every dataset page names its publisher.

A [This Indian Life](https://thisindianlife.today/) project, by [Bhuvan](https://measure.thisindianlife.today/about/).
