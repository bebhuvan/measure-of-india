# Brief: merchandise trade (`trade`, port 4402)

A new guide: what India buys and sells, with whom, month by month, down to the tariff line.
The service accounts belong to `services`; the balance of payments to `external`.

Reader questions: What does India actually export (refined petroleum, phones, medicines,
rice, gems) and import (crude, gold, electronics, coal, edible oil), and how has the mix
changed? Who are the partners, and where does India run its biggest deficits (China) and
surpluses (US)? How much of the trade deficit is oil and gold? Why does a month's "record
exports" headline mislead (base effects, oil prices, gold)? What does a phone or a litre of
edible oil in your house have to do with these numbers?

Sources:
- **TradeStat** (Ministry of Commerce, DGCI&S customs data): read `docs/reference/tradestat.md`
  first; it has the probe, the field names and the traps. Build `scripts/lib/tradestat.mjs`
  (new transport `tradestat` in `sources.yml`: fresh token and cookie per POST, polite
  throttle, table parser through `tabular.mjs`) and the adapter. Cover: MEIDB monthly and
  EIDB annual; exports and imports; HS 2, 4, 6 and 8 digit; US$ million, ₹ crore and
  quantity; country-wise, region-wise, commodity x country; principal commodity groups
  (FTPA). Map the country/region/FTPA form fields from the live pages before coding them.
  History: Jan 2018 / 2018-19 onward.
- **DBIE via the Data Bank** for the long headline: parsed `rbi_dbie_foreign_trade_monthly`
  and `rbi_dbie_foreign_trade_growth` (exports, imports, balance, oil, non-oil), plus the
  annual Handbook trade tables in the webi mirror. Shown as its own ruler, never joined to
  TradeStat's series.
- DGCI&S principal-commodity to HS mapping workbooks (`www.dgciskol.gov.in`,
  `QE_PC_HS_Mapping_<year>.xlsx`) if TradeStat's own grouping falls short.
- The current `rbi-trade*` and `rbi-commodities-*` bundles (MoSPI's RBI mirror, ending
  2024-25) are the external guide's; read them as a cross-check only.

Value checks before baking (see the reference doc): chapter sums against the printed
total; the 2023-24 column of the 2024-25 call against the 2023-24 call (the probe saw fish,
HS 03, at 12,248 against roughly 7,400 published: find out why before charting anything);
five chapters against the DGCI&S quick-estimates press release. Store the ministry's R/F
revision flags per value.

Seams: HS 2017 to HS 2022 (April 2023) changes 6 and 8 digit codes: treat 8-digit series
across it as separate rulers; 2 and 4 digit run through. ₹ values move with the rupee: show
both currencies where the story differs.

Size: 8-digit monthly is about 11,000 lines a month. Bake it (downloads, every-cut table),
draw the 2 and 4 digit levels and named lines.
