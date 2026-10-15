# RBI expansion check, 11 October 2026

Question from the owner: how much useful DBIE data is local, whether
`https://dbie.rbihub.in/` is complete/current, and whether the separate Claude
design work conflicts with expansion.

## Local holdings

Read-only inventory:
`/home/bhuvanesh.r/Documents/Data/Data bank/data/derived/rbi_dbie_webi_inventory.csv`.
It contains 1,414 report entries, last attempted on 8 October 2026:
1,243 raw-validated, 132 non-WebI objects, 35 skipped prompts, two raw failures
and two fetch failures. The Data Bank source note describes the two raw failures
as empty reports. These are report/provider counts, not unique concepts or
complete parsed, current observation coverage.

The separate prompted dataset added 10 October holds reviewed listed-company
reports: ten reports, thirty exports, 117,324 source-native rows through
Q1 2026–27 and FY2025–26. The ordinary inventory's skipped-prompt status does
not account for these later holdings. It is not proof that every prompted
report is now held. Data Bank remains read-only from Atlas.

## RBIhub catalogue check

Fetched the public `/api/catalogue` at
`https://data-api.dbie.rbihub.in` in complete 200-entry pages, with exact-count
reconciliation: 1,430 entries; 1,049 loaded (797 unique report IDs and 252
Data Query elements), 279 not exported, 101 archive-file exclusions and one
empty export. The original diagnostic catalogue and comparison were saved under `/tmp`;
those files were lost when the laptop restarted. The dated counts and methodology
remain in this note; they are not a newly replayed 12 October catalogue audit.

Of 758 loaded report IDs with end dates readable in both the mirror and local
official catalogue, 197 mirror dates were earlier and 561 equal. None was
later in this comparison. Examples: reports 141 and 143, quarterly BoP, end
March 2026 versus June 2026; 291 and 999, sectoral credit, end June versus
July; exchange rate 575 ends 28 September versus 7 October.

Method: exact report-ID join, taking the latest loaded mirror end date where
an ID has several entries. This compares metadata, not actual source cells.
Dates need instrument interpretation: future announced annual periods,
survey windows and catalogue anomalies are not ordinary observation lags.
The check is not a live refresh of the official RBI catalogue. The source
inventory is dated 8 October; the mirror was queried 11 October. RBIhub is a
useful structured discovery/corroboration route and already supplies Atlas's
forecaster/listed-company history; it is not a complete current DBIE substitute.

## Meaningful expansion, after overlap audit

The assessment marks 394 reports without explicit catalogue references,
including 299 raw-validated reports. These are discovery candidates, not
299 unused statistical families. Rural wages report 664 is already explained
in CPI and exposed in its full state/occupation EveryCut. BSR-2 and agricultural
report aliases likewise require semantic comparison before claiming gaps.

A verified freshness opportunity is Markets' listed-company family: its
RBIhub lineage/checks currently end October–December 2025, while newer local
prompted exports and twenty corporate CAS elements are held. Reconcile all
sector, industry, sales-size and paid-up-capital cuts, same-company growth,
changing company samples, annual/quarterly universes and report sentinels.
Extend existing coverage rather than introduce a provider-branded duplicate.
Survey metadata or prompt listings alone do not establish usable consumer
confidence/inflation-expectation observations.

## Design integration

Claude's completed `lb/design` work is at `0b97b60`, a descendant of parent
HEAD `3fa544a`. It remains separate from the main dirty expansion checkout.
It changes visual system, home page, chart exports/actions/OG rendering and
introduces a Plot wrapper for phone categorical charts. It does not change
canonical data or editorial pipeline files.

Prepared a three-way file review against the parent without modifying it.
Thirty code/system files need review, excluding screenshots and generated
cards. Parent DESIGN, package scripts and OG changes merge cleanly; CSS has
one overlapping region. Preserve Schools' compact SVG treatment and new
registry/QC/OG blocks. The wrapper currently truncates long category names
and relocates colliding value labels; those behaviours need full-name and
mark-association review before relying on it. Worker family-local phone QA
continues independently. No branch merge, commit or deployment performed.

## Later review and integration checkpoint

The reviewed30design files were integrated by three-way comparison, preserving
parent registrations and compact chart CSS; no Git branch merge was performed.
Complete category names and phone time/continuous layouts now live in the shared
Plot wrapper. Actual combined QA found annotation/citation problems, whose
reviewed fixes are applied in source and await the next production build.

Official RBI Markets source changes are now integrated, with32additional
explained plates and26publication-aware listed-company bundles. Ten source
and adapter-ownership regressions pass in main. Source discrepancies remain
explicit; full combined production verification is pending. No commit, push
or deployment occurred. Earlier statements that design work remains separate
describe the initial audit checkpoint, not the current working tree.

## 12 October recovery

The expansion and design work resumed after the laptop restart. Main now contains the reviewed AIDIS, Farm households, Energy and official RBI listed-company changes. Canonical source-revision dates are explicitly unknown where publishers do not expose them; acquisition timestamps are separate. The corrected source-client desktop/phone chart preflights pass, with dense annotations retaining readable horizontal scrolling. A fresh production build, required gates and final browser checks are in progress. No commit, push or deployment has occurred.

## 13 October completed integration verification

The reviewed design and AIDIS/Farm/Energy/RBI expansion are integrated and verified in main's local production artifact: 2, 047 pages, fresh required gates, and 280 real Chrome page/viewport checks passed. The source-backed RBI Markets additions retain all recorded ambiguous/noncomparable observations as explicit exceptions. All four family HTML payload/provenance contents match prior verified artifacts after entry-script URL normalization. No commit, push or deployment. The RBIhub catalogue counts above remain the dated 11 October metadata audit, not a new 13 October freshness audit; neither catalogue counts nor this completed expansion establish complete current DBIE holdings.
