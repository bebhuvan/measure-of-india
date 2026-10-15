# RBI Markets deepening, 11 October 2026

Owner authorized coordination of RBI expansion alongside farm and energy.
Read `docs/briefs/expansion-wave-1.md` for the common operating contract,
`docs/reference/rbi-expansion-check.md` and `docs/reference/rbihub.md`.
No subagents, commits, pushes, release merges or deployment. Data Bank and
sibling projects remain read-only. Use the assigned managed worktree only.

## First verify the actual gap

Audit existing Markets, CPI, Banks, Credit, Rates, External, Public finance
and State coverage against DBIE report/provider holdings. Report aliases and
unreferenced IDs are not unused concepts. For example, report 664 wages is
already in CPI. The ordinary report inventory omits newer prompted exports.
Keep a concise ranked list of genuinely unused families/cuts for later waves.
Do not turn this audit into a new provider-branded guide.

## Implement the verified first family

Deepen existing Markets' listed-company analysis with the newest directly
held official DBIE data. Existing `markets-hub.mjs` and `markets-listed-*`
bundles use RBIhub history, checked through October–December 2025 and FY2024–25.
Local Data Bank has twenty corporate CAS elements (`rbi_dbie_cas_money`,
domain_group corporate, 78,926 published rows at its documented backfill)
and ten reviewed prompted reports (`rbi_dbie_webi_prompted_rows`, 117,324
published source-native rows, through Q1 FY2026–27 and FY2025–26).
Recount and verify publication/raw lineage yourself.

Cover all actually published overall, sector, industry, sales-size and
paid-up-capital cuts, annual and quarterly, levels/growth/ratios/company counts.
Preserve the full comparable history. Reconcile overlap between direct CAS,
direct report tables and RBIhub; the latter is a structured mirror, not an
independent source. Prefer directly held official cells for new periods and
revisions with explicit provenance; preserve instrument seams and do not
silently splice incompatible estimates. Sampling totals change each period;
published growth uses common companies. Company counts are not employment.

Read the Data Bank source notes and contracts. Known defects include annual
IT-class/industry zeros, rupee amounts in growth cells, absent not-meaningful
CAS cells and huge sentinel values in report tables. Do not merely run a
generic numeric parser. Keep valid negatives, quarantine source sentinels,
retain raw evidence, test the full failure classes, and expose omissions.
Verify EBIT/interest/EBT and operating-profit/other-income/depreciation identities
within the published definitions/rounding. Never compare study totals as a
same-company time series or growth rates as stock proportions.

Source source-native rows through existing read-only Data Bank clients or
publication-aware query CLI. Do not run Data Bank fetch/parse/update/audit/write
commands or call RBI live from the Atlas adapter. If a required source is
missing/stale, identify the exact gap and continue the useful local scope.

## Ownership and review

Own a uniquely named `markets-rbi` adapter/validation/test/catalogue and raw
namespace, updated/new listed-company bundles, associated Markets corpus/facts
and status `docs/status/markets-rbi-expansion.md`. Edit only the listed-company
portions of existing Markets page/client/coverage and small source registration
blocks. Other Markets families and all other guides stay intact. Coordinator
owns shared docs, plumbing, design integration and final shared regeneration.

Snapshot inherited file hashes before editing. Main has uncommitted Schools,
AIDIS and assessment; do not include these as your patch. Record family files
and shared hunks relative to baseline, exact source counts and visual evidence.
Claude's separate completed `lb/design` work will be integrated by coordinator;
do not merge/rebase it yourself. Use family-local full-name responsive plots
and check 320/390/545 phones and 1440 desktop, all text/mark associations.
Meaningful cuts need explained charts plus complete EveryCut/downloads.

Use build slots. Disk is tight; do not retain an unnecessary large dist or
duplicate immutable inherited data. Do not install dependencies if a symlink
to main's existing dependencies suffices. Preview port 4333. Preserve 4322.
Build/gates, strict coverage, relevant tests, prose dry run, source replay,
hand source comparisons and actual full guide QA are completion requirements.
Do not refresh freshness attestations without reading the affected claims.

Send milestones and handoff to coordinator chat
`01a1289e-da11-7e30-9de6-03d154fffcf4` on local; owner authorized these messages.
Save `/tmp/atlas-markets-rbi-baseline.json` and a final handoff JSON listing
changes, baseline hashes, logs, ready state and remaining source gaps.
