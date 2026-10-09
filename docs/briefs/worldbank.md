# Brief: the World Bank's India data (`worldbank`, port 4409)

The World Bank's WDI holds well over a thousand indicators with India data, many with
history to 1960, cleanly harmonised. The owner wants to use that density to fill the site.
Two jobs:

1. **Inventory and bake** the whole WDI India catalogue (the Data Bank's `worldbank_indicators`
   read-only, or the existing `worldbank` transport): a generated catalogue of every
   indicator with India data, and a ledger position on every one. Indicators that belong to
   a topic another guide owns (manufacturing exists; climate, ILO, BIS sessions run now) can
   be `baked` into topic bundles here and named for the topic, or `excluded` with "covered
   by the <x> guide from its primary source". Excluding for that reason must name the
   guide.
2. **Two guides** where the World Bank is the best source India has:
   - **Poverty and inequality** (`poverty`): the World Bank's Poverty and Inequality Platform
     (PIP API: headcount at the international lines in 2021 PPP, poverty gap, Gini,
     consumption shares by decile, India's survey years, the rural/urban split and the
     HCES 2022-23 vintage). Read the `consumption` guide (HCES) and link to it; never
     splice survey rounds with different recall periods (URP, MRP, MMRP).
   - **Population** (`population`): population, age structure, dependency ratio, urbanisation,
     fertility, life expectancy, migration, from WDI / UN WPP. Projections drawn as
     projections. The `nfhs` and `gender` guides cover some health and demography: link.

Use slugs `worldbank-*`, `poverty-*`, `population-*` for bundles. Port 4409 for both guides.

Reader questions for poverty: How many Indians are poor, by which line, and why do the
numbers people quote differ so much? What did India's 2011-12 to 2022-23 gap in surveys do
to what we know? For population: how old is India, when does the working-age share peak,
how fast are cities growing?
