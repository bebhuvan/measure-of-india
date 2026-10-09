# worldbank family: status

Session: atlas-worldbank, branch `lb/worldbank`, port 4409. Guides: `poverty`, `population`.

## Done

- **WDI, the whole catalogue** (`scripts/lib/products/wdi-india.mjs`, product `wdi-india`).
  1,498 indicators listed, 1,395 with India data, baked into 22 topic bundles
  (`population-wdi*`, `poverty-wdi`, `worldbank-<topic>`). Raw: `data/raw/worldbank-wdi-india.json`.
  Catalogue: `data/coverage/worldbank.catalogue.json` (103 indicators with no India value are
  named in it, not items).
- **PIP** (`scripts/lib/products/pip.mjs`, product `pip`). Release 2026-09-22, 2021 PPP. Nine
  surveys 1977-78 to 2023-24, one bundle per comparable spell (`poverty-pip-<year>`), plus
  the lineup (`poverty-pip-lineup`), lines $3.00, $4.20, $8.30 and a ladder of 15 more.
- **UN WPP 2024** (`scripts/lib/products/wpp.mjs`, product `wpp`, new family `unpd`).
  Estimates 1950-2023, medium projection 2024-2100, 17 other variants, age by sex.
- **validate.mjs** block: unit-class ranges for every WDI series; age shares sum to 100;
  urban + rural = 100; male + female = total; WDI population equals WPP in all 66 years;
  births - deaths = natural change; age groups sum to the total; PI ordering; PIP ladder
  monotonic, deciles sum to 100, rupee mean = PPP mean x PPP x CPI, PIP equals WDI's rounded
  copies. PIP spells registered in `seams:`.

## Next

Coverage ledgers, the two guides, registry/headline/periods/qc/asof/slots/OG, prose, look.

## Decisions (and why)

- **WDI via the per-country bulk zip, not 1,500 API calls.** api.worldbank.org sits behind a
  firewall that blocks bursts, `source=` and `;`-joined indicator lists, then blocks the IP
  on every path (PIP too) for minutes. Calls also took ~20 s each on 2026-10-09 (other
  sessions share the IP). The bulk file (`/v2/en/country/IND?downloadformat=csv`, 600 KB)
  holds every WDI indicator; the adapter checks it against the indicator list.
- **The Data Bank's `worldbank_indicators` was not used**: it holds 17 India indicators.
- **WDI bundles all carry `meta.dossier: worldbank`**, including `population-wdi*` and
  `poverty-wdi`. WDI's poverty series join PIP spells that PIP marks as not comparable, and
  its population series run WPP estimates into projections; both are disclosed in the
  bundle notes and the guides draw from the PIP spell and WPP bundles instead.
- **One bundle per PIP comparable spell** (1977, 1983, 1987, 1993-2009, 2011, 2022-2023),
  each a base in `seams:`; the lineup is its own base (model estimates, nowcasts after 2023
  in separate `*_nowcast` series).
- **Projections from UN WPP directly** (the WB's own projection source 40 is blocked by the
  firewall, and WPP is the primary source).

## Source quirks

- PIP's current release serves India at national level only: no rural or urban rows, and
  WDI has no rural/urban poverty series for India either.
- WPP 2024 OtherVariants file: in the five probabilistic-interval variants, LE15/LE65/LE80
  and the Q5/Q0040/Q0060/Q1550/Q1560 columns are garbled (life expectancy at 15 of about
  1.5 years; mortality 1,000 per 1,000), for India and China alike. Not baked; listed in the
  catalogue and excluded in the ledger.
- The WPP files also carry a 1 January 2101 row (closing stock only); not baked.

## For the coordinator

- `scripts/lib/net.mjs`: appended `getBuffer` (binary downloads), self-contained, nothing
  above it changed. `scripts/lib/worldbank.mjs` (the worldbank transport): pacing 1500 ms,
  firewall-block wait, `pip()`, `wbCountryZip()`, envelope `lastupdated` on results.
- The `manufacturing` guide's bundles (`wdi-manufacturing*`) have no `dossiers:` entry in
  `data/sources.yml`, so `npm run data` never refreshes them. Not changed here (another
  guide's adapter); the same indicators are baked fresh in `worldbank-national-accounts`
  and `worldbank-trade`.
