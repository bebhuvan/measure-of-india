# Brief: work in India, the ILO's estimates (`ilo`, port 4407)

A new guide, separate from `jobs` (PLFS). The ILO publishes harmonised, modelled estimates
for India (ILOEST) and harmonised survey series that run longer and further than any one
Indian survey, and line India up with other countries on the same definitions. The owner's
reason: they are clean, and they add density to the employment story. They are also a
different instrument: ILO models are not PLFS, and the guide must say how and why the two
differ, never splice them, and never present a model as a measurement.

Reader questions: How many Indians work, and how has that changed since 1991? Why is the
share of women at work so low, and is it rising? How many young people are neither working
nor studying (NEET)? How many workers are informal, own-account or unpaid family workers?
How many working people are still poor (working poverty)? What share of the economy's income
goes to labour? How does India compare with China, Bangladesh, Indonesia, Vietnam?

Source: ILOSTAT. Find and document the API (`rplumber.ilo.org` data and dictionary
endpoints, or the SDMX API at `sdmx.ilo.org`): write `docs/reference/ilostat.md`, add a
transport, archive raw. Enumerate every ILOSTAT indicator with India data into the
catalogue (modelled `*_EST` and survey-based), at every breakdown (sex, age band,
urban/rural, economic activity, occupation, status, education). Bake broadly; draw the
findings.

Seams: ILO model vintages revise the whole history every year (keep the vintage); modelled
vs survey-based series are separate rulers; ISIC and ISCO revisions.

Peer countries: a short, fixed, stated list, drawn in grey with India in the accent colour.
