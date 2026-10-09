# prices: status

Session: atlas-prices, branch `lb/prices`, port 4421. Brief: `docs/briefs/prices.md` (wave 2).

## State (2026-10-10, 00:15 IST)

**Blocked: the machine's disk is full** (466 GB, 7.5 MB free). Not caused by this session
(its MoSPI cache is 90 MB). The base-2024 state grid download stopped at state 7 of 37 and
was killed so it would not keep calling MoSPI while every cache write failed. Coordinator told.
Resumes from the cache once space is freed. Nothing committed yet.

## Done (uncommitted)

- **CPI-IW** (`scripts/lib/products/cpiiw.mjs`, Data Bank DBIE 699 and 1168): four bases as
  separate bundles (`cpiiw-1960`, `-1982`, `-2001`, `-2016`), centres on three bases (88 on
  2016). Hand check: All India, Aug 2026, base 2016 = 154.4, y/y 4.96%: the Labour Bureau
  release of 30 Sep 2026 says the same.
- **Rural wages** (`scripts/lib/products/wagesrural.mjs`, DBIE 664): All India and states, two
  occupation schemes (18 to Oct 2013, 25 from Nov 2013), never joined.
- Ledgers `cpiiw.yml` and `wages-rural.yml`: clean, nothing pending.
- Code written, not yet run (needs MoSPI): CPI 2012 deep (states x groups and sub-groups,
  rural/urban detail, 299 items, back series), CPI 2024 deep (state x division and group
  baked; state x class, sub-class, item to the deep archive), CPI-AL/RL deep (RL states,
  state x group, RL groups), WPI 2004-05 and 1993-94 bases and sub-sub-groups.

## Next

Re-run the grid download, bake everything, ledgers, validate rows, then the guide plates,
prose, gates.

## Decisions

- CPI-IW: DBIE has no linking factors between bases, so four rulers side by side, no link.
- CPI-AL/RL: no linking factor found in the API or a readable release (searched 2026-10-10);
  the seam stays side by side.
- CPI 2012 base: window opens Jan 2014 (was Jan 2016); 2012 and 2013 come from the NSO back
  series in their own bundles.

## Source quirks

- DBIE 699 labels 28 rows "CPI-1986-87" (a CPI-AL base, not CPI-IW): dropped, ledger says why.
- DBIE 1168's All India row for Sep 2023 repeats August (139.2; 699 and the release: 137.5).
- DBIE 664: Orissa and Odisha both appear (one state); from Apr 2023 months are dated the 23rd.
- MoSPI CPI base 2012: pagination drops and repeats rows at page boundaries (All India 2020:
  336 rows, 331 distinct). Months with a defect are re-read alone with `month_code`.
