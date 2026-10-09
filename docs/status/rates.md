# rates: interest rates and monetary policy

Branch `lb/rates`. Guide `/guides/rates/` (port 4404). Updated 2026-10-09.

## Done

- Adapter `scripts/lib/products/rbirates.mjs` (product `rbirates`, family `databank`):
  42 bundles, all read-only from the Data Bank. Raw rows archived under `data/raw/rates-*`
  (column-packed, ACTUALS only, 15 MB in all).
- Bundles: policy rates since 1935 (events and month-end), every MPC decision (62) and every
  member's vote (61 meetings with minutes); WALR/WADTDR fresh and outstanding by bank group;
  MCLR by group and for 97 banks; WALR by loan purpose and by occupation (BSR-1, incl. credit
  cards); benchmark shares; WSS weekly rates incl. deposit card rates; call money daily since
  2005 and monthly since 1990; money market segments; MIBOR; liquidity operations; LAF
  auctions; OMOs; market repo; CDs; CP; T-bill auctions (91 since 1993, 182, 364, CMB, 14-day);
  T-bill SGL yields; the G-sec yield curve 1-30 years since 1996; central G-sec auctions since
  1995 (per day and per FY); state borrowing cost and amounts by state since 2005-06; market
  borrowing (annual, weekly, by state); structure of interest rates since 1970-71; old WALR
  tables (1992-2014, 2005-2014); real rates on CPI 2024 (linked) and CPI 2012.
- Validation identities in `scripts/validate.mjs` (rates block): corridor order, MPC vs policy
  history, six votes per meeting, WSS repo = policy history (809/809 weeks), benchmark shares
  = 100, MCLR median inside min/max, call rate inside its daily range, turnover-weighted daily
  call = Handbook monthly average (253/256 months; 2007 differs), T-bill total issue identity
  (from 2001), term spread, real rate arithmetic, state totals, net <= gross.
- Hand checks against RBI documents in the Data Bank raw store: Oct 2026 resolution (repo
  5.50, SDF 5.25); Sep 2026 lending release (fresh WALR 8.61, fresh WADTDR 5.67). Recorded in
  the adapter header.
- Coverage: `data/coverage/rates.yml` over a generated catalogue of 3,971 items (73 DBIE
  reports chosen by rule + 7 parsed datasets): 896 shown, 804 baked, 2,271 excluded (mostly the
  same RBI table under another DBIE menu), 0 blocked, 0 pending.
- Guide: 16 plates, every-cut table, two sortable tables (banks, states), registry, headline,
  register rows, OG card, qc PAGES, 19 asof entries, prose slots (DeepSeek), IDH pairs (9).
- Gates: build, `npm run gates`, `npm test`, `npm run prose:dry` green. Looked at 1440 and
  390 px; every chart read; a share PNG downloaded and checked.

## Decisions (for HISTORY)

- Current bundle is `rates-monthly` (month-end levels); the running month shows the level after
  the latest decision. facts.mjs needs aligned series, so bank rates enter prose via proseInputs.
- Real rates use CPI 2024 linked (the NSO's back-cast, drawn pale with the agency seam
  treatment); the CPI 2012 version is baked as its own ruler.
- No `seams:` registry entry: rates have no base years; changed rulers are separate series
  (Bank Rate vs repo, reverse repo vs SDF floor, all-bank vs five-major-bank deposit rates).
- Generated prose: one phrase hand-corrected ("loans to private firms" -> private banks'
  outstanding loans), then re-verified (verify, lint, contract pass). The brief no longer lets
  the writer say we do not know the vote: the resolution itself states it.
- Heavy bundles are sliced at build time into a baked JSON block on the page (no requests).

## For the coordinator

- Shared files touched (one marked block each): `data/sources.yml`, `scripts/fetch.mjs`
  (import + registry key), `scripts/validate.mjs`, `scripts/qc.mjs`, `scripts/og.mjs`,
  `src/dossiers/registry.js` (`no: "15"`, renumber on merge), `headline.js`,
  `register.client.js`, `everycut.js` (units and cuts), `pipeline/slots.yml`,
  `pipeline/lib/series-kws.mjs`, `pipeline/asof-manifest.json`, `data/crosscheck/idh.yml`.
- Data Bank notes: MPC stance classifier misses "change the stance to calibrated tightening"
  (blocks promotion of meeting 63); 2019-20 G-sec press-release notified amounts disagree with
  DBIE on 17 days; SDL backfill now reaches 2019.
- IDH pairs flag only on timing (month-end vs last Friday) and the call average's weighting.
- IDH series ids that match rates bundles (not paired, daily/weekly): CMMMCALLRT11D (call),
  CMMMYLDTBS91W/82W/01W (T-bill primary), CMMMCDMNIR11F/MXIR (CD), CMMMCPMNIR11F/MXIR (CP),
  CMMMMKTRRT11D, CMMMTREPRT11D (market repo, TREPS), CMMMRBOMON11D (net OMO).
- Brief's BIS `WS_CBPOL` cross-check: waits for atlas-bis's `bis-policy-rate`.

## Not done / blocked

- Nothing blocked.
