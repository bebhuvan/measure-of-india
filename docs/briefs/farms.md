# Brief: farms (`farms`, port 4433)

Read `dbie-wave.md` first. A new guide: what India grows, where, how much per hectare, and
what the state pays for it. Inventory item R9. RBI reproduces the agriculture ministry's
tables; MoSPI does not serve them.

Reader questions: How much rice, wheat, pulses, oilseeds, sugarcane, cotton does India grow,
and how has yield changed since 1951? Which states grow what? What is the MSP, how has it
risen against costs and inflation, and how much do the government's agencies actually
procure? How big are the food stocks against the buffer norms? How has the monsoon shaped
output (link `climate`)?

Sources (DBIE via the Data Bank): output, area and yield 459 to 465, state crop output 623 to
625, 886, 887 (MSP, procurement, PDS); area under major commercial crops 190 (since 1951) via
the RBI Innovation Hub service (the Data Bank's copy failed); fertiliser and food stocks if
held. Agricultural credit lives in `credit`; rural wages in `cpi`. Link both.

Seams: crop years (July-June), state reorganisations (the state key in
`src/dossiers/states-key.js`), the ministry's final against advance estimates (separate
rulers).
