# Brief: climate and temperature (`climate`, port 4408)

A new guide: India's changing climate as an economic fact, because heat, rain and emissions
shape crops, work, health and power demand. The `mnre` guide (renewable capacity) exists:
link to it, don't duplicate it.

Reader questions: How much hotter is India than a century ago, and is it warming faster
lately? Which months and which states are warming most? How many more extreme-heat days do
people live through? Is the monsoon changing (total, timing, extremes)? How much does India
emit in total and per person, against China, the US and the world, and how has the energy
mix changed? What do the projections say for a child born today? What does a hotter day
cost: work hours, crops, electricity demand?

Sources (all mirror or derive from Copernicus ERA5, CRU, CMIP6 and the Global Carbon
Project; attribute each properly):
- **Our World in Data**: temperature anomalies (monthly and annual, ERA5), CO2 and GHG
  emissions (total, per capita, by fuel, consumption-based), energy mix, and whatever else
  OWID publishes for India in this space. Use OWID's grapher CSV/JSON or its catalog API;
  document it in `docs/reference/owid.md`. Licence CC BY: credit OWID and the underlying
  producer on every plate.
- **World Bank Climate Change Knowledge Portal (CCKP)**: India and state-level historical
  climatology (ERA5/CRU: temperature, precipitation, hot days, heat index) and CMIP6
  projections by scenario. Document the API in `docs/reference/cckp.md`.
- WDI climate indicators via the Data Bank's `worldbank_indicators` (read-only) or the
  existing `worldbank` transport, if they add something OWID and CCKP don't.

Seams: reanalysis (ERA5) vs station (IMD/CRU) records are different instruments; anomaly
baselines (1951-1980, 1991-2020) must be stated; projections are not data: draw them
differently (dashed, labelled by scenario), never joined to the observed line.
