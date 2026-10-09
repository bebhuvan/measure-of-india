# Brief: prices, deeper (`prices`, port 4421; guides `cpi` and `wpi`)

Read `wave2.md` first. Families: `cpi` (83,690 items, 80,003 pending), `cpialrl` (916 pending),
`wpi` (1,350 pending). Run `node scripts/coverage.mjs --list` for the exact globs.

The pending work (from `docs/INVENTORY-data-paths.md` item 8 and the framework's list):
- CPI base 2024: classes and sub-classes (92 and 162, raw only today); rural and urban below
  the General index; **state x division, group, class, item** (~73,000 items: the big one;
  bake at state x division and group, archive state x item if it is too large for bundles);
  the 2024-base back series for rural and urban.
- CPI base 2012: the groups other than general, food and fuel (housing, pan, clothing,
  misc); rural and urban sub-groups; state groups and sub-groups; the 299 items (from 2014);
  the 2011-15 years before the guide's 2016 window.
- CPI-AL/RL: RL groups, RL states, 1986-87 groups, state x group, the states missing from the
  1986-87 bundle; check Labour Bureau's linking factor between bases (inventory open
  question) and show it only as the agency's link if it exists.
- WPI: sub-sub-groups; the 2004-05 and 1993-94 bases (the API serves both; the inventory
  noted a Data Bank probe got 0 rows: re-probe with our fetcher). Separate rulers, seamMarks.
- **New for this wave: CPI for industrial workers (CPI-IW, Labour Bureau)** from the Data
  Bank's DBIE mirror (reports 699, 1168): its own bundles and plates in the CPI guide, its
  2016 base and earlier bases as separate rulers. Rural daily wages (DBIE 664) belong with
  it: what prices mean for a wage earner.

Reader questions to answer with the new depth: what does inflation look like in my state,
for my kind of household (rural, urban, worker)? Which items drive it (all 358 base-2024
items reachable, the movers drawn)? How do wholesale prices feed retail?
