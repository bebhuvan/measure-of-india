# NFHS on eSankhyiki: what the API serves, and where it is wrong

Learned 2026-10-10 (health-gender session). Adapter: `scripts/lib/products/nfhs.mjs`.

## Calls

- `nfhs/getNfhsIndicatorList`: the 21 tables (the fact sheet's sections).
- `nfhs/getnfhsFilterByIndicatorId?indicator_code=N`: sub-indicators **with codes**, states (All India is
  id 99), sectors, surveys. The records carry only the sub-indicator text, so the filter listing is the
  only way to tie a catalogue id (`nfhs:14:92-children-age-6-59-...`) to a record. Archived as
  `data/raw/nfhs-filters.json`.
- `nfhs/getNfhsRecords?indicator_code=N&page=&limit=100`: rows `(state, sub_indicator, sector, survey,
  value)`. About 29,000 rows in all; page with `mospiAll` (limit is capped at 100 since 2026-10).

## Values

- `"(94.8)"`: the fact sheet's brackets, an estimate on 25 to 49 unweighted cases. A real figure: baked and
  flagged `caution`. (Before 2026-10-10 the adapter parsed it as NaN and dropped about a thousand cells.)
- `"*"` suppressed (fewer than 25 cases), `"NA"`, and `""` (blank): not values.
- Footnote numbers are glued to the labels (`source1 (%)`, `(<11.0 g/dl)22`); typos `wih`, `swith`,
  `survey}`. Cleaned for display only (`cleanLabel`).

## The NFHS-4 column is misfiled in places

Checked against the NFHS-5 national report (DHS FR375, which prints NFHS-4 trends) and the DHS
Program's own tabulation of both surveys (`api.dhsprogram.com`, IA2015DHS and IA2020DHS; needs a
User-Agent header). The NFHS-5 column agrees with DHS throughout (58 pairs). The NFHS-4 column does
not, in these tables:

| Table | What the API gives for NFHS-4 | What it is |
|---|---|---|
| 6 Unmet need | total 5.7 | the spacing figure; total was 12.9 |
| 8 Maternity care | (2026-08-10 dump) MCP card 21.0, mothers' PNC 89.3, OOP 62.4, children's PNC 3,198 (rupees) ... | the column shifted down one row; **corrected by MoSPI in the 2026-10-10 fetch** |
| 14 Anaemia | women 15-19: 22.7 | men 15-49 (the report: 23 per cent) |
| 16 Hypertension | elevated-or-on-medicine 0.7 / 0.9 | NFHS-4's "very high" band |
| 19 Empowerment | bank account 3.3, phone 38.4, hygienic 53.0 ... | shifted from the property row down (bank account was 53) |
| 20 Violence | spousal 45.9, during pregnancy 57.6 | other rows' figures (DHS: pregnancy 3.9) |

The shift is identical in every state. MoSPI corrects tables without notice (table 8 between August and October 2026), so each quarantine records the All India value it was withheld for (`served`) and the bake stops if MoSPI starts serving something else. The misfiled NFHS-4 lines are withheld (`QUARANTINE` in the adapter,
`excluded` in the ledger). Tables 15, 16, 17 and 21 also file NFHS-4 figures under NFHS-5's wording
for a different population (15-49 against 15 and over) or question (cancer examinations against
screening tests); withheld too.

MoSPI's gender compendium reprints several NFHS lines **correctly** (total unmet need 12.9, spousal
violence 30.9): see `gender-t025-nfhs4`, `gender-t143-nfhs4`.

## Geography

Ladakh is part of Jammu & Kashmir in NFHS-4; Dadra & Nagar Haveli and Daman & Diu are two UTs in NFHS-4
and one in NFHS-5. NFHS-4 Punjab iron-folic-acid: total 42.6 against rural 40.0 and urban 40.8, an
inconsistency at source (flagged `inconsistent`; the only one in 7,065 triplets).

## IDH

Checked 2026-10-10: the Data Bank's `india_data_hub_series` (about 900 series) has no health or
demographic category, so there is no IDH counterpart for any NFHS bundle.
