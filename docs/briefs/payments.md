# Brief: payments (`payments`, port 4432)

Read `dbie-wave.md` first. A new guide: how Indians pay. Inventory item R8.

Reader questions: How fast has UPI grown, and has it replaced cash, cards or both? How big is
the average UPI payment (and what does that say about who uses it)? How much moves through
RTGS and NEFT? Are ATMs and cheques dying? What is the e-rupee, and does anyone use it?
Where is India against other countries (only if an official source gives it)?

Sources (DBIE via the Data Bank): payment system indicators 61, 612 (monthly volumes and
values: RTGS, NEFT, IMPS, UPI, cards by type, PPIs, ATMs and PoS terminals, cheques/CTS,
AePS, BBPS, NACH); e-rupee 1404; cheques 678; parsed `rbi_dbie_payment_system_indicators`.
NPCI publishes UPI by app and by bank: only if a public, non-paywalled NPCI file exists and
its licence allows republication; note it in your status file otherwise. Never IDH.

Seams: definitions of "digital payments" changed; card counts switched between issued and
active; the RBI's payment-system tables were re-organised (watch report versions).
Volumes and values are separate series; never divide across mismatched coverage.
