# Brief: state economies (`states`, port 4405)

A new guide: how big each state's economy is, how fast it grows, how rich its people are,
and what it makes. Inventory item 5 (`docs/INVENTORY-data-paths.md`). State-level cuts of
other families (CPI by state, PLFS by state, credit by state) stay in their guides; link
to them, and consider a small "the same state in other guides" index.

Reader questions: Which states are richest per person, and how wide is the gap (Goa or
Delhi against Bihar)? Who is growing fastest, and is the gap closing or widening? What does
each state's economy run on: farms, factories, services? How does my state compare? Why is
state GDP less reliable than national GDP, and why do state per-capita numbers mislead for
states with many migrants?

Sources:
- MoSPI NAS state indicators 23 to 34 (GSDP, NSDP, per-capita NSDP, GSVA by industry,
  current and constant prices, growth), 2011-12 base only, 2011-12 to 2025-26. MoSPI quirks
  (from the inventory): state indicators exist only on the 2011-12 Current series; state
  code 37, documented as All India, returns nothing for GSDP. Use `scripts/lib/mospi.mjs`
  politely: other sessions share the API.
- RBI Handbook of Statistics on Indian States via the Data Bank webi mirror (182 reports, 159
  distinct tables): GSDP and per-capita as a cross-check, plus the state tables that give a
  state's economy its shape (sectoral shares, state finances in brief: debt and deficit to
  GSDP, power, roads, farm output). Enumerate all 159 in the catalogue; take a position on
  each in the ledger.
- Population for per-capita checks: whatever the sources use; never compute our own per
  capita from a different population series.

Seams: one base (2011-12); states revise at different times, and some states' latest year
is missing or advance: show the latest year each state has, never fill.

States change shape (Andhra Pradesh and Telangana in 2014, J&K and Ladakh in 2019): never
join a pre-split series to a post-split one.
