# Brief: family health and women and men, fuller (`health-gender`, port 4425; guides `nfhs` and `gender`)

Read `wave2.md` first. Families: `nfhs` (11,152 items, 10,796 pending) and `gender` (4,828
items, 4,742 pending). Inventory items 10 and 14.

- NFHS: all 21 tables are in raw; the guide bakes a subset. Bake and decide every table and
  every cut: tables 2, 6, 7, 11, 17, 18 and the rest of 5 and 10; rural and urban for every
  indicator; every state for every indicator; NFHS-4 states beside NFHS-5 (two survey
  rounds, two rulers: never a trend line through two points dressed as a series). New plates
  where a finding lives: blood sugar and hypertension, cancer screening, women's
  empowerment, gender-based violence, tobacco and alcohol.
- Gender (MoSPI's Women and Men in India compendium): 154 indicators, 1951 to 2026; the
  guide holds 17. Decide all of them; bake broadly (45 run to 2025: bring those current),
  sector cuts, earlier years of state tables. Twelve codes in the GitHub definitions are no
  longer served: `blocked` with the date.
- Overlaps to respect: `jobs` (PLFS by gender) and `ilo` already carry women's work; `population`
  carries fertility and life expectancy from UN WPP. Link, don't rebuild; where MoSPI's
  compendium reprints another agency's figure, say whose it is.

Reader questions: how healthy are Indian families, state by state, village and town? What
has changed between NFHS-4 and NFHS-5? Where do women stand on work, schooling, money,
safety and voice, and how fast is it changing?
