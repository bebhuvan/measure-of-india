# prices: status

Session: atlas-prices, branch `lb/prices`, port 4421. Brief: `docs/briefs/prices.md` (wave 2).

## State (2026-10-10): done

All green on the final commit: build, `npm run gates` (validate, coverage, asof 362 notes,
qc, chart lint), `npm test` (40), `prose:dry`, and `coverage --strict` clean for cpi, cpialrl,
cpiiw, wages-rural and wpi (nothing pending). launch-build merged at 1bf0f5e; raw gzipped;
rebaking all five families offline from raw and cache changes nothing. Looked at every new
plate at 1440 and 390; a share image (CPI-IW four bases, PNG 3888 x 2550) downloaded and read.

Prose regenerated for cpi and wpi; all 109 figures trace (verify), lint clean, and every
sentence read by hand against the facts sheets. The hand read caught what the verifier
cannot: "manufactured, the smallest of the five" (it was the smallest change, not the lowest
rate), "thirteen divisions", "health alone is easing" (paan eased too), "food, the largest
division" (no weights on this base), "154.4, up 7.3%" (index points, not per cent). Each was
fixed at its cause: slot briefs that say how the sheet ranks movers and counts, and the CPI-IW
level moved to its own bundle (`cpiiw-2016-index`) so no level sits among rates.

## Done

- **CPI-IW** (`scripts/lib/products/cpiiw.mjs`, Data Bank DBIE 699 and 1168): four bases as
  separate bundles (`cpiiw-1960`, `-1982`, `-2001`, `-2016`), centres on three bases (88 on
  2016). Hand check: All India, Aug 2026, base 2016 = 154.4, y/y 4.96%: the Labour Bureau
  release of 30 Sep 2026 says the same.
- **Rural wages** (`scripts/lib/products/wagesrural.mjs`, DBIE 664): men's daily wages by
  occupation, All India and states, two occupation schemes (18 to Oct 2013, 25 from Nov 2013),
  never joined. Hand check: 2024-25 averages for Kerala 868.7, Karnataka 454.3, Assam 384.8,
  Bihar 362.8, Gujarat 280.8 match RBI Handbook of States table 113 exactly.
- Ledgers `cpiiw.yml`, `wages-rural.yml` clean; `cpi.yml`, `cpialrl.yml`, `wpi.yml` rewritten
  with no pending rule (checked against the bundles once baked).
- Guide plates added. CPI: §03 village and town by division; §08 the other four 2012 groups;
  §09 the 2012 items by level against 2012=100; §11 state x division table; §12 CPI-AL/RL by
  state on the new base; new §13 (CPI-IW on four bases, its groups, 88 centres, farm wage
  against CPI-AL, farm wage by state); two new misreadings (dearness allowance, wage rises).
  WPI: §02 thirty years on four rulers; new §11 wholesale food against retail food.
- `docs/reference/dbie-labour-bureau.md`: what the three DBIE reports hold and their defects.

## Coverage (all five families, nothing pending)

| Family | Items | Shown | Baked | Excluded |
|---|---|---|---|---|
| cpi | 83,690 | 1,349 | 11,040 | 71,301 (69,000 of them state x class, sub-class, item: deep archive) |
| cpialrl | 980 | 64 | 701 | 215 |
| cpiiw | 279 | 98 | 169 | 12 |
| wages-rural | 921 | 21 | 900 | 0 |
| wpi | 3,344 | 877 | 2,456 | 11 |

Every shown or baked item was checked against the data actually served (a script over the
raw grids). Items the listing offers but the source never served are excluded by exact id,
with the reason: Chandigarh has no rural index; small states publish 2012-base groups but no
sub-groups; dry states have no liquor; the 1986-87 CPI-AL covered 20 states.

## Data audit after the mospiAll fix (coordinator, 2026-10-10)

No "pages slipped" warnings anywhere in this family's cache. Verbatim repeats in the source
(CPI 2012 All India, the WPI old bases) are dropped by mospiAll. The four fetchers that paged
by hand: WPI 2022-23 and CPI-AL/RL now go through mospiAll; the CPI 2024 headline, grid and
state-General fetches (which cannot) are checked value for value against the audited state x
sector slices on every run, and they agree.

## Next (for the coordinator)

- Deep archive: `data/archive/staging/cpi/` holds state x sector x class, sub-class and item
  for base 2024 (1.2 million rows, 9.6 MB csv.gz), ledger rule `archive: true`, rolls up to
  the `cpi-2024-states-groups*` bundles. Not uploaded.
- IDH series to pair: none found for CPI-IW, rural wages or the old WPI bases in the Data Bank's
  `india_data_hub_series` mirror (it holds no macro prices series yet; see framework's request).

## Decisions

- CPI-IW: DBIE has no linking factors between bases, so four rulers side by side, no link.
- CPI-AL/RL: no linking factor found in the API or a readable release (searched 2026-10-10);
  the seam stays side by side.
- CPI 2012 base, 2012 to 2015: baked as `cpi-2012-early` and `-early-states` (2012 and 2013 on
  the NSO back series, an agency bridge in `seams:`). The main 2012-base bundles keep their
  2016 start because the learn pages and ten plates chart them with fixed spans.
- Retired bases are not re-fetched (`retired: true` for CPI 2012 and WPI 2011-12 in
  `sources.yml`): both are final, their raw dumps are the audit trail, and a re-ingest costs
  about 10,000 MoSPI calls. WPI 2011-12 sub-sub-groups are baked from its raw dump.
- Base 2024 state x class, sub-class and item: deep archive (staging csv.gz), not bundles;
  state x division and state x group are baked.
- Rural wages stay out of the dated prose: the series ends in April 2025, sixteen months
  behind the CPI print, and the writer would set the two side by side.

## Source quirks (handled as classes, never one by one)

- WPI 1993-94 and 2004-05: 9999.9 means "not available" (941 and 536 cells): null.
- WPI 1993-94 serves the Fuel major group and its three groups as four rows with blank labels;
  a few nodes come twice with different values (1993-94 pesticides; 2004-05 wood products,
  drugs, petrochemical intermediates). Unattributable: set aside, named in meta.note and ledger.
- WPI 2004-05 serves the fuel tree one level up (group in the sub-group field): shifted back.
- Keying slips (a value far from two neighbours that agree with each other) are set aside,
  never corrected: WPI 1993-94 high-speed diesel Nov 1994 (5108.8 among 108.8); CPI-IW Ranchi
  Aug 2012 (141 among 249 to 272) and one centre in Mar 2020; rural wages Assam Nov 1998 and
  Bihar Jun 2001 (about a tenth of their neighbours). Genuine spikes (cauliflower in the Oct
  1998 vegetable crisis) are kept: their neighbours disagree.
- CPI-IW 1982 base: Food for 1984-85 to 1988-89 repeats one figure through each fiscal year
  (annual values, not monthly): dropped.
- DBIE 699 labels 28 rows "CPI-1986-87" (a CPI-AL base, not CPI-IW): dropped, ledger says why.
- DBIE 1168's All India row for Sep 2023 repeats August (139.2; 699 and the release: 137.5).
- DBIE 664: Orissa and Odisha both appear (one state); from Apr 2023 months are dated the 23rd.
- MoSPI CPI base 2012: a year's stream holds repeated rows (All India 2020: 336 rows, 331
  distinct). The mospiAll audit shows they are verbatim repeats in the source, not slipped
  pages; any month short of its full node count is still re-read alone with `month_code`.
- MoSPI CPI base 2024: one slice per state x sector x month holds every node once (checked on
  every slice).

## For other owners

- `src/dossiers/everycut.js`: the nas block of bundle cuts (`gdp-annual-levels`: "Indicator" ...)
  sits inside `UNITS` as well as in `CUT_BY_BUNDLE` (the "end trade" marker appears in both
  maps; my own block made the same slip and is now in CUT_BY_BUNDLE only). Harmless, but the
  copy in UNITS should go.

- The learn pages (`src/learn/*.client.js`) chart `cpi.json` with fixed 2016 spans; anyone
  changing that bundle's window must re-draw them.
