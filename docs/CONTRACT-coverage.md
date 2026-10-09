# CONTRACT: coverage

*Normative. Why it exists: `docs/PLAN-launch.md` §2. The census proves a guide has seen
everything we baked; this contract proves we baked, or deliberately set aside, everything
the source publishes. `scripts/coverage.mjs` enforces it and `npm run gates` runs it.*

## Two files per family

**1. The catalogue**: `data/coverage/<family>.catalogue.json`, *generated* by the family's
adapter (or a `--catalogue` mode of it) from the source's own listing: MoSPI metadata
calls, the DBIE report catalogue, TradeStat's pickers, the World Bank or ILO indicator
lists. Never typed by hand: a hand-typed catalogue lists what we already know about,
which is the failure this contract exists to stop.

```json
{
  "family": "trade",
  "source": "Ministry of Commerce, TradeStat (EIDB, MEIDB)",
  "generator": "scripts/lib/products/tradestat.mjs --catalogue",
  "generated_at": "2026-10-10",
  "items": [
    { "id": "meidb:export:hs2:03", "label": "Fish and crustaceans (HS 03), monthly exports",
      "dims": { "flow": "export", "level": "hs2", "freq": "monthly" } }
  ]
}
```

An item is one thing the source publishes at one granularity: an indicator crossed with
one cut (state, sector, gender, age, item, industry digit, partner, unit, frequency).
Ids are stable, lowercase, colon-separated from coarse to fine, so a glob can address a
whole branch (`meidb:export:hs8:*`). Where a source has an enormous tail (11,000 HS lines,
358 CPI items x 37 states) list it: the catalogue is a file, not a page.

**2. The ledger**: `data/coverage/<family>.yml`, written by the person or agent building the
guide. An ordered list of rules; the **first** rule whose `match` fits an item decides it.

```yaml
family: trade
guides: [trade]
catalogue: data/coverage/trade.catalogue.json
rules:
  - match: "meidb:export:hs2:*"
    status: shown
    bundle: trade-exports-hs2-monthly
    plate: "§03 What India sells, chapter by chapter"
  - match: "meidb:export:hs8:*"
    status: baked
    bundle: trade-exports-hs8-monthly
  - match: "eidb:*:quantity:*"
    status: excluded
    reason: "Quantities mix units (kg, number, litres) across lines and cannot be summed; values are shown instead."
  - match: ["ftspcc:*"]
    status: blocked
    reason: "Every export-promotion-council view returned HTTP 500 on 2026-10-10."
```

## Statuses

| Status | Means | Required fields |
|---|---|---|
| `shown` | baked and drawn on a plate | `bundle`, `plate` |
| `baked` | in a bundle, the census, the facts sheet and the guide's data downloads; not drawn | `bundle` |
| `excluded` | deliberately left out | `reason`: one sentence a reader would accept |
| `blocked` | the source fails or refuses | `reason` naming the error and the date |

`bundle` may be a list. Optional `series` (a list of series keys) is checked against the
bundle when given.

## What the gate checks

`node scripts/coverage.mjs` (and `npm run gates`):

1. every catalogue item is matched by some rule;
2. every rule matches at least one item (a rule that matches nothing is stale);
3. statuses are one of the four, with their required fields;
4. every named bundle exists in `data/series/`, and every named series exists in it;
5. `excluded` and `blocked` reasons are non-empty sentences;
6. `--strict` (the launch setting): every guide in `src/dossiers/registry.js` is listed in
   some ledger's `guides`.

It prints a per-family tally (items shown / baked / excluded / blocked) so the share of a
source a guide draws is visible on every run.

## Rules for writers

- `excluded` is not a convenience. "Too many to chart" is never a reason: that is what
  `baked` and the guide's every-cut table are for. Acceptable reasons are about the data
  (broken, duplicated, not meaningful to sum, suppressed for sample size).
- A source catalogue that grows (a new indicator, a new state) fails the gate until the
  ledger takes a position on it. That is the point.
- Never make a glob broader to silence the gate without reading what it now swallows.
