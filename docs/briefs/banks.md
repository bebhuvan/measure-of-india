# Brief: banks, one by one (`banks`, port 4434)

Read `dbie-wave.md` first. A new guide that complements `credit` (credit by sector, bank
health by group) and `deposits`: the banks themselves, and the co-operative and non-bank
lenders.

Reader questions: Which are India's biggest banks by deposits and loans, and how have public
and private banks traded places? Which banks are most profitable, best capitalised, most
burdened by bad loans? How many branches, and where (population group)? What are urban
co-operative banks, how many are there, and how healthy? How big have NBFCs become?

Sources: bank-wise variables (report 1221, 42,372 rows, 2002 to 2026) and urban co-operative
bank tables (772, 784 to 789, 795 to 800) via the RBI Innovation Hub service (the Data Bank
could not fetch these prompt-gated reports); bank-wise NPAs, CRAR and ratios 336, 986, 1077,
1078; Trend and Progress tables 1508 to 1547; branch statistics; offices by group 617
(RBIH); NBFC tables 1534 to 1544 and parsed `rbi_nbfc_credit`; financial institutions 382 to
398 (Data Bank).

Seams: bank mergers (SBI associates 2017, the 2019-20 public-sector mergers, HDFC 2023):
show a merged bank's history as reported, and say where a merger makes a jump. Bank-group
definitions changed over time. Name banks as RBI names them.
