# Brief: BIS data on India (`housing` and `debt`, port 4410)

The Bank for International Settlements publishes harmonised Indian series that RBI either
doesn't publish in this form or publishes without the international comparison. The site is
organised by topic, not by source, so BIS does not get a "BIS guide". You build the BIS
adapter and bundles, and two guides where BIS is the backbone. Other guides (credit,
rates, external) will pull your bundles in when the coordinator merges them.

Source: the Data Bank's `bis_series` and `bis_daily` (read-only; see its
`docs/BIS_SOURCES.md` for shape and quirks): WS_CBPOL (policy rate), WS_CREDIT_GAP,
WS_DSR (debt service ratios), WS_TC (total credit by borrowing sector and lender), WS_SPP
and WS_DPP (residential property prices, selected and detailed), WS_CPP (commercial),
WS_EER (effective exchange rates), WS_GLI (global liquidity: foreign-currency credit to
India), WS_XRU, WS_LONG_CPI. Enumerate every India series in every flow into the
catalogue.

Guides:
- **Housing and property prices** (`housing`): BIS residential property prices (nominal
  and real), alongside RBI's house price index (DBIE webi report 688, quarterly, by city)
  as its own ruler. If NHB RESIDEX is reachable publicly, add it as a third ruler and
  document it. Reader questions: are homes getting more or less affordable? Which cities
  rose most? Why do real and nominal prices tell different stories?
- **Debt** (`debt`): total credit to households, non-financial companies and government as a
  share of GDP (WS_TC), the credit-to-GDP gap, debt service ratios, foreign-currency
  credit (GLI). Reader questions: Is India over-borrowed? Who owes most? How does India
  compare with China, the US and peers? What is the credit gap and why do central banks
  watch it?

Bundle prefixes `bis-` (shared BIS bundles others may read), `housing-`, `debt-`. EER and
policy rate: bake them as `bis-*` for the external and rates guides to use as cross-checks;
RBI stays the source of record for both.

Seams: BIS breaks in series (methodology notes per series), RBI HPI base changes
(2010-11 then 2022-23 if applicable).
