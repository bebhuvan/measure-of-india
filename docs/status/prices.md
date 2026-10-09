# prices: status

Session: atlas-prices, branch `lb/prices`, port 4421. Brief: `docs/briefs/prices.md` (wave 2).

## State (2026-10-10, 00:35 IST)

Disk freed by the coordinator; the base-2024 state grid download resumed (state x sector x
month, ~2,300 slices, one request at a time). The full bake (CPI-AL/RL, WPI, CPI) is queued
behind it. Plates, ledgers, validate rows, registry and every-cut wiring are written and
committed; they go green once the bundles exist.

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

## Next

Bake, check every ledger line against a real series, validate, build, qc, chart lint, look at
1440 and 390, as-of manifest, prose (generate, verify, read by hand), status, message.

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

## Source quirks

- DBIE 699 labels 28 rows "CPI-1986-87" (a CPI-AL base, not CPI-IW): dropped, ledger says why.
- DBIE 1168's All India row for Sep 2023 repeats August (139.2; 699 and the release: 137.5).
- DBIE 664: Orissa and Odisha both appear (one state); from Apr 2023 months are dated the 23rd.
- MoSPI CPI base 2012: pagination drops and repeats rows at page boundaries (All India 2020:
  336 rows, 331 distinct). Months with a defect are re-read alone with `month_code`.
- MoSPI CPI base 2024: one slice per state x sector x month holds every node once (checked on
  every slice).

## For other owners

- The learn pages (`src/learn/*.client.js`) chart `cpi.json` with fixed 2016 spans; anyone
  changing that bundle's window must re-draw them.
