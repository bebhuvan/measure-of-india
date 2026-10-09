# Brief: interest rates and monetary policy (`rates`, port 4404)

A new guide: what the RBI decides, how it decides, and how that reaches a home loan EMI and a
fixed deposit. Money supply and credit belong to `credit`; BIS policy-rate comparisons to
`bis`.

Reader questions: What is the repo rate and why does it matter to my EMI? How has it moved
since 1935, and through the 2008 crisis, the 2013 taper scare, COVID and the 2022 hikes?
Who votes on it and how often do they disagree? Do banks pass cuts on, and how fast
(WALR, WADTDR, MCLR, external-benchmark loans)? What does the yield curve say, and why do
government borrowing and T-bill auctions matter to everyone else's rates? Real rates: is a
fixed deposit beating inflation?

Sources (Data Bank, read-only):
- Parsed `rbi_policy_rates` (395 changes, 1935 to the latest; repo, reverse repo, SDF, MSF,
  bank rate, CRR, SLR), `rbi_mpc_meetings` and `rbi_mpc_votes` (61 meetings, 366 votes since
  Oct 2016; the meetings dataset shows promotion blocked in the Data Bank: check its notes),
  `rbi_lending_deposit_rates` (WALR, WADTDR, MCLR by bank group and bank, 2012 on).
- Parsed `rbi_gsec_auctions`, `rbi_tbill_auctions`, `rbi_sdl_auctions` (from Apr 2023, SDL
  from Aug 2026). Webi: key rates 151, 531; MPC votes 1491; call money 198, 690 (daily since
  2005); MIBOR 993; G-sec yields 1368, 809; T-bill auctions 307 to 311; borrowings 559, 1213.
- Real rates need CPI: read the CPI guide's bundles (do not refetch CPI).

Seams: the policy corridor changed (reverse repo to SDF as the floor, April 2022); the
operating target changed over decades (bank rate, then LAF repo, 2011 onward weighted call
rate); the inflation-targeting framework from 2016. Lending benchmarks changed (BPLR, base
rate, MCLR, external benchmark): separate rulers.

Cross-checks to list: IDH "Interest Rates" (59 series); BIS `WS_CBPOL` for the policy rate.
