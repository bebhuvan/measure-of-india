# Brief: public finance (`public-finance`, port 4431)

Read `dbie-wave.md` first. A new guide: what the government earns, spends, borrows and owes,
centre and states. Inventory item R4.

Reader questions: How big is the fiscal deficit, and how is it financed? Where does the
centre's money come from (income tax, GST, corporate tax, borrowing) and go (interest,
defence, subsidies, transfers to states, capital spending)? How much of every rupee goes to
interest? How indebted are the centre and each state, and which states are stretched? What
is a budget estimate against a revised estimate against an actual, and how far apart are
they?

Sources (DBIE via the Data Bank): central finances 349, 355, 655, 656, 713, 1399 (receipts,
expenditure, deficits; the monthly central deficit); states 451 to 454, 677, 692, 709;
combined 339 to 347, 673, 721; CAS `FICG_GDP` (from 1971) and `FISG_GDP` (from 1974) in
`rbi_dbie_cas_money`; market borrowing 559, 1213; T-bills outstanding 2; ownership of
government securities 1369, 1371; SDL auctions (parsed `rbi_sdl_auctions`). The `rates`
guide owns yields and auctions: read its bundles, don't rebuild.

Seams: budget estimate, revised estimate and actual are three different numbers for one
year (never one series; show the path). GST from July 2017 replaced several taxes. Changes
in GDP base move every ratio to GDP: say which GDP each ratio uses.
