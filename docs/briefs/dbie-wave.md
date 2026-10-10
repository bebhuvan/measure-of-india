# The DBIE wave (launch eve, 2026-10-10)

Five sessions widen the site with RBI families it does not yet cover. RBI's data is regular
and clean next to MoSPI's, and none of this touches MoSPI (an audit refresh is running
there: never call MoSPI).

Sources, in this order of precedence:
1. **The local Data Bank** (read-only; `scripts/lib/databank.mjs`): `dbieReport` for the
   1,243 validated DBIE report exports, `dbieProvider` for one data provider, `databankQuery`
   for its parsed datasets (`rbi_dbie_cas_money`, `rbi_dbie_cas_observations`, payments,
   auctions...). Its inventory: `~/Documents/Data/Data bank/data/derived/rbi_dbie_webi_inventory.csv`.
2. **The RBI Innovation Hub's DBIE service** (`scripts/lib/rbihub.mjs`,
   `docs/reference/rbihub.md`): only for reports the Data Bank lacks (the prompt-gated ones)
   and the 252 SDMX datasets. Cross-check a sample against the Data Bank wherever both have
   a report.
3. Never India Data Hub values (paid). You may list IDH series that match your bundles for
   the coordinator's cross-check manifest.

The DBIE value traps (`docs/briefs/README.md`, "Data sources") apply in full: one display
unit, the latest final version per date, one hand-checked value per bundle against an RBI
publication (Bulletin, Handbook, press release).

Each session builds a new guide end to end, to the full bar in `docs/briefs/README.md`
(adapter, catalogue and ledger with nothing pending, bundles, validate identities, guide
with every-cut, prose verified and read, looked at 1440 and 390). Families already on the
site that you will touch read-only and link to: `credit`, `deposits`, `rates`, `external`,
`trade`, `debt`, `states` (and the state profiles: if your family has a state cut, tell the
coordinator which bundle and series, so `atlas-profiles` can add it).
