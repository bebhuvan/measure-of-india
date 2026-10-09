# Brief: services (`services`, port 4406)

A new guide. Services are more than half of India's GDP and most of its growth, yet the
site only shows them as one trial index buried in another guide. Make services visible:
output, trade, enterprises and jobs.

Reader questions: What counts as services (trade, hotels, transport, telecom, finance, real
estate, IT, public administration, health, education)? How big is each and which is
growing? Why does India export software and business services so well, and what is a
global capability centre? Who works in services, formal and informal? How does the new
Index of Services Production work, and why is it a trial?

Sources:
- ISP (MoSPI, base 2024-25, 19 sub-sectors, monthly from Apr 2025, plus the one annual year):
  the bundle `isp` belongs to another guide; you may chart it, and you own any new ISP
  bundles (`services-isp-*`, e.g. the annual series, inventory item 17).
- Services GVA by industry and sub-industry from NAS (`gdp-2022-industries`, `gdp-industries`
  belong to the GDP guide: read them; the 18 sub-industries are inventory item 3's leftovers:
  build `services-gva-*` from MoSPI if they are not baked).
- Services trade: DBIE via the Data Bank, monthly services exports and imports (RBI's
  monthly data on India's international trade in services, report 1501) and the BoP
  services categories (software, business, transport, travel, financial). The `external`
  session owns the BoP as a whole; you own the services-by-category view.
- Informal service enterprises: ASUSE (the `factories` guide owns `asuse-*`; read them).
- Services employment: PLFS cuts by NIC (MoSPI) if not baked; coordinate with the jobs
  bundles (read, don't rebuild).

Seams: ISP is a trial with one base and a short history: say so on every plate. NAS bases
2011-12 and 2022-23 are separate rulers.
