# Brief: external account, rebuilt on DBIE (`external`, port 4401)

The External account guide exists but runs on MoSPI's copy of RBI tables, which stopped in
mid-2025 (BoP to Q1 FY26, reserves to June 2025). Rebuild it on the Data Bank's DBIE mirror
and make it the complete account of India's dealings with the world in money terms. The
merchandise trade detail belongs to the `trade` session; services by category to `services`;
you own the balance of payments as a whole, including the services and income lines as BoP
components.

Reader questions: Is India living within its means with the world? How many months of
imports do the reserves cover, and why did they move this week? Who is putting money into
India and taking it out (FDI vs FPI, equity vs debt), and how fickle is that money? How
much does India owe abroad, to whom, in what currency, how soon? Why does the rupee's value
against a basket matter more than against the dollar? What do Indians send abroad (LRS:
education, travel, gifts) and what do migrants send home?

Sources (Data Bank, read-only):
- BoP: DBIE webi reports 141, 143, 56 to 59 (to Q1 FY27, with every revision vintage: keep
  the vintages; one plate on how BoP revises).
- Reserves: parsed `rbi_dbie_forex_reserves` and reports 1, 574 (weekly to Sep 2026:
  foreign currency assets, gold, SDR, IMF reserve position).
- International investment position: 145, 982. External debt: 660 (quarterly; by
  borrower, instrument, maturity, currency).
- REER and NEER: 584 (40-currency and 6-currency, trade and export weights).
- FDI: 34, 997, parsed `rbi_dbie_foreign_investment_inflows`; FPI: 136, 1354 (portfolio flows,
  equity and debt). ECBs: 55. LRS remittances: 793. Rupee invoicing: 1550, 1551.
- Exchange rates (reference rate) and forward premia, intervention, FX turnover: the guide
  has these from the MoSPI mirror (`rbi-exchange-rates`, `rbi-forward-premia`,
  `rbi-intervention`, `rbi-fx-turnover`, `rbi-nri`): move each to its DBIE source where one
  exists, otherwise keep and mark it as ending where it ends.
- Catalogue: enumerate every report above (and any other external-sector report in the
  Data Bank's DBIE report catalogue `rbi_dbie_report_catalog` / the inventory CSV
  `data/derived/rbi_dbie_webi_inventory.csv`) at every line item it carries.

Bundles: prefix `external-` for the new ones. The old `rbi-*` bundles are this guide's;
retire each one the DBIE bundle replaces (delete the bundle, keep its `data/raw/` dump, note
it in the status file).

Seams: BoP presentation changed to BPM6 (2010s): never splice BPM5 and BPM6 lines. REER
base years. Reserves valuation: say plainly that reserves move with the dollar's value of
other currencies and gold, not only with intervention.

Cross-checks to list for the coordinator: IDH "FX Market" and "External Sector" series.
