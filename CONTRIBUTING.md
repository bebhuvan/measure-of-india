# Contributing to Measure of India

Thank you for helping. There are four ways in, from a two-minute report to a new data source.

## 1. Report a number that differs from its source

This is the most useful thing you can do. Open an issue with the
[wrong number](https://github.com/bebhuvan/measure-of-india/issues/new?template=wrong-number.yml)
template and give:

- the page and the chart or sentence (every chart has a "Copy link" button);
- the figure we show, and the figure in the source;
- the source document, table and page, with a link.

We check it against the release and reply on the issue. Where a data table and the printed report
disagree, we publish the printed figure and say so on the page.

## 2. Suggest a dataset

Open an issue with the
[new dataset](https://github.com/bebhuvan/measure-of-india/issues/new?template=new-dataset.yml)
template: what it measures, who publishes it, where it lives, how often it is released, and from
when. Official sources only: ministries, the statistical system, the RBI, regulators, and for
comparisons international bodies such as the World Bank, the ILO and the BIS.

## 3. Fix or improve the site

Small fixes (a typo, a broken link, a chart label that collides on a phone) are welcome as pull
requests. For anything larger, open an issue first so we can agree on the shape.

1. Fork the repository and make a branch.
2. Read [AGENTS.md](AGENTS.md), the operating manual. It applies to people as much as to coding agents.
3. Make the change, then build and run the gates:

   ```sh
   npm ci && pip install -r requirements.txt
   npx astro build
   npm run gates
   npm test
   ```

   The build takes about 12 minutes and 5 GB of memory. `npm run gates` must pass; a pull request
   that fails a gate will not be merged.
4. Open the pull request, saying what changed and how you checked it. Screenshots at 1280 and 390
   pixels wide help for anything a reader sees.

## 4. Add a data source

Follow [docs/RUNBOOK-sources.md](docs/RUNBOOK-sources.md) exactly: an adapter in
`scripts/lib/products/`, an entry in `data/sources.yml`, canonical bundles in `data/series/`, and
validation that passes.

## The rules

These are the site's hard rules. A change that breaks one is a bug, whatever else it does.

- **Numbers come from the source, never from us.** Every number in the prose must come from the
  facts sheet, and `pipeline/verify.mjs` traces each one. Never type a figure or a period into page copy.
- **Missing data is `null`**, never zero and never a gap in the array.
- **Never join two rulers.** Different base years or methodologies are separate series, drawn side
  by side and never spliced.
- **Never edit `data/raw/` by hand.** It is the audit trail of what each agency published.
- **Vintage means the data's vintage**, not the date it was fetched.
- **Design within [docs/DESIGN.md](docs/DESIGN.md)**: improve it, never redesign it. Every chart is
  labelled and nothing overlaps, at desktop and phone widths.
- **Write plainly**, for an Indian reader who is not an economist: short sentences, Indian number
  words (lakh, crore), no jargon left unexplained.

## Licences

By contributing you agree that your code is released under the [MIT licence](LICENSE) and your text
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Contact

Write to [bhuvan@bebhuvan.com](mailto:bhuvan@bebhuvan.com) for anything that does not fit an issue.
