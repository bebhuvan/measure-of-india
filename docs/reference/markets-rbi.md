# Listed-company source and reconciliation method

The adapter reads publication-aware local Data Bank query results, never the live
RBI service. Replay uses eleven source-native compressed archives: one CAS archive
and ten prompted report archives. Twenty CAS elements and reports 1067–1074,
1117 and 1118 cover annual and quarterly overall, sector, industry, sales-size and
paid-up-capital cuts. CAS contributes the longer history; prompted reports extend
it to FY2025–26 and Apr–Jun 2026. Every canonical observation carries its source
artifact, reference period and original dimension or provider/row identifiers.

The 234,648 prompted query rows contain duplicated parse-run lineage. The dataset
key is report, answer hash, provider and row number; newest published retrieval
wins. Ties with different content fail. This leaves 117,324 source rows. Display
units repeat the same observation: retain the first source unit, not their sum.
Auxiliary prompt/date tables are counted separately from economic cells. All 110
referenced artifacts were checked against the source SHA256 before archiving.

A fiscal quarter is stored at its reference-period start; annual periods start
in April. Growth is the RBI's published common-company change, never a quotient
of successive study totals. Amounts, margins and company counts describe changing
reporting samples. Counts do not measure employment. Parent industry groups and
their children are both retained and labelled; they must not be summed together.

Missing source text and exact ±999999999 report sentinels remain null. Valid
negatives, numeric zero and extreme rates survive. CAS whole cut-period amount
vectors filled with zero are quarantined, including single-measure industry
sales tables; prompted amounts supply the meaningful replacement. Mislabelled
other-expenditure rupee amounts in CAS growth cells are also quarantined.
The source-quality download lists every omitted cell and its reason.

The mirror has ten annual Agriculture and Related Activities: Others net-margin
keys with two rows each. CAS equals the SUM of their non-additive ratios. These
are source aggregation defects, not economic revisions. The previous Atlas used
the last mirror row. Preserve that inherited selection with explicit ambiguity
in per-date lineage, series labels and notes until historical official reports
resolve it. Prompted reports resolve the newest two affected periods; eight
older inherited values remain ambiguous and are not verified historical estimates.
The original two reviewed differences are recorded as superseded explanations.
No unresolved CAS/report conflict is accepted. There are 11,377 meaningful shared
comparisons after zero-vector quarantine; tolerance stays at published growth
rounding or one-millionth relative for full-precision values.

Listed growth and ratios may have near-zero or negative denominators, so the old
generic ±15,000% and ±200 times ceilings are invalid. Source-native examples are
25–50 crore sales-size net-profit growth −31,487.960199005% in Jul–Sep 2025 and
Tobacco Products cash coverage 605.08596918086 times in Oct–Dec 2024. The shared
validator applies a broad ±1,000,000 corruption guard only to listed growth and
ratio measures. Source shares retain 0–100.05% bounds; counts and amounts retain
existing unit bounds. Exact sentinel rejection, cell lineage, conflict rejection
and 780 accounting identities supply additional checks, not wider tolerances.

The semantic inventory examines the 1,414 ordinary DBIE reports by title/menu
and source-native corporate keys. Candidate code references are search evidence,
not proof of access. Full mirror-to-CAS comparison covers 82,826 keys; the only
20 differing mirror rows are the ten duplicate-ratio defects explained above.
Audit output: `docs/reference/markets-rbi-semantic-audit.json`.

Annual all-industry sales shares of 100.151355757595% (FY2024–25) and
100.161091243151% (FY2025–26) appear in report 1073. The share rows use 3,922 and 4,302 companies, while the available sales
denominator rows in the same report use 3,902 and 4,278 companies. Population
comparability is not established. Isolate them from comparable-share series with
an explicit noncomparable-population reason and preserve the exact published
values, counts and denominator rows in raw/source-quality evidence. A value above
100 alone does not establish corruption. Nothing is clamped. The two observations
appear in four CAS/report source records.

## Product ownership during refresh

`sources.yml` runs the official listed-company adapter before the hub SPF adapter.
The hub emits listed canonical bundles only when the registry explicitly assigns
`markets-listed.product: markets-hub`. With `markets-rbi` as owner, a later SPF
refresh still archives the mirror for audits and emits SPF, but cannot overwrite
listed canonical data. Offline replay uses the existing mirror archive without
network calls or raw writes. The regression invokes the real hub adapter against
a temporary copy of all 26 official bundles: every listed SHA256 stays identical,
all six seeded stale SPF bundles regenerate, and the raw mirror stays identical.
It then assigns legacy ownership and verifies listed output still works.

## Source revision and archive capture

The held CAS/report data do not establish a publisher revision timestamp.
Canonical vintage is explicitly unknown. archiveCapturedDate records the latest
aggregate source-row capture date; each sourceByDate artifact resolves to exact
retrieval timestamps in the quality manifest. CAS is_revised compares first and
latest local captured values. WebI dataprovider.updated is provider refresh/export
metadata, not evidence of when RBI revised the estimates. Reference periods,
effective dates and mirror loaded_at/scraped_at never substitute for revision.
Existing raw archive vintage headers are retained as historical capture metadata,
not promoted into canonical vintage. Future raw wrappers separate the capture date.
