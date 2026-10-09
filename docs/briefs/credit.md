# Brief: money, credit and banks (`credit`, port 4403)

A new guide on who borrows from India's banks and why it matters, plus the money supply and
the health of the banks. The `deposits` guide (BSR-2, where Indians keep their money) stays
as it is; link to it and build on it, do not duplicate it. Interest rates belong to `rates`;
BIS's credit-to-GDP gap and debt service ratios to `bis` (link to them).

Reader questions: Who gets bank credit: farmers, MSMEs, big industry, home buyers,
credit-card users, NBFCs? Which of these is growing fastest, and is personal-loan growth a
warning? Why does food credit spike? What is M3, and does money growth still predict
inflation? Are banks healthy now (NPAs, capital), and what did the bad-loan cycle of
2015-2020 look like? Which states get credit in proportion to their deposits?

Sources (Data Bank, read-only):
- Sectoral deployment of bank credit: parsed `rbi_sectoral_credit` (agriculture, industry by
  size and by 2-digit industry, services sub-sectors, personal loans by type, NBFCs),
  webi 539, 540 (2007 on), food credit 1130 (1993 on). Parsed `rbi_credit_history`,
  `rbi_bank_position`, `rbi_nbfc_credit`, `rbi_credit_growth_summary`.
- Scheduled bank deposits and credit, fortnightly: webi 689 (1997 on), 998, 901.
- Money and reserve money: parsed `rbi_dbie_cas_money` (CAS tables `MSC_F`, `BMC_M`, `RMC_W`),
  webi 22, 23, 26, 97, 554, 826: M0, M1, M3 and their components and sources.
- Credit by place: BSR-1 annual and quarterly tables (credit by state, district, population
  group, occupation), credit-deposit ratios; spatial statements 1413 to 1489 (the
  centre-wise tables 1420, 1469, 1487 are not parsed; mark them `blocked` if you can't read
  them from the raw mirror).
- Banking health: NPAs by bank group 254, 330; bank-wise 336, 986; NPA movement 1114
  (unit column unreliable: check); CRAR 329, 1077; bank ratios 332, 1078; frauds 1508;
  Trend and Progress tables 1508 to 1547.

Seams: the sectoral-credit data changed basis when HDFC merged into HDFC Bank (July 2023):
RBI publishes growth "excluding the merger" for a year; show both and say why. Credit by
industry follows NIC; bank-group definitions changed over time.

Cross-checks to list: IDH "Banking" (88 series), "Monetary".
