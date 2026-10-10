# Brief: data fixes from the read-through (`datafix`, port 4451)

Read `docs/briefs/README.md` first. The launch read-through (`docs/briefs/review.md`) found
data-level faults the reviewers could not rebake. Fix each at the adapter (never by editing a
bundle), rebake offline from the archived raw (no network unless a fix truly needs it), and
add a check so the fault cannot come back. Generalise: solve the class, not the instance.

1. **Zero standing for "no estimate".** `gender-t087-cy25` stores 0 where the source table
   means no estimate (women's rural casual wage in nine states and UTs). Missing is `null`,
   never 0 (hard rule 2). Find how the source marks "no estimate" (a dash, "-", "NA", a blank,
   or a 0 the table's own note says means none) and map it to null in the gender adapter.
   Then sweep every bundle for the same class: wages, prices, rates or counts that are exactly
   0 where 0 is not a plausible value, and check each against its source. Add a `validate`
   check per family for zeros in series that cannot be zero (a wage, a price index).
2. **MNRE.** `mnre-sources.large_hydro` is 0 before December 2023, when large hydro was not
   counted in this table: it should be null, with a seam or gap note saying when it enters.
   `mnre-solar-categories` hybrid and off-grid start at 0 in January 2020: find out from the
   source whether that is a real zero or not yet reported, and treat it accordingly. Also fix
   the mnre registry `register.unit` text ("Jan 2020 to Jun 2026"; the data runs to Jul 2026):
   derive it from the bundle, don't type it.
3. **A ratio carrying a money unit.** `external-debt-annual` row "E.9 Forex Reserves - Total
   Debt Ratio" is a ratio (per cent) but carries the bundle's money unit, so the every-cut
   table and search show it as "$0.10 bn". Set its unit per series in the adapter, then sweep
   every bundle for series whose label says ratio, per cent, share or index but whose unit is
   money, and fix them the same way. Add a test.
4. **Jargon in titles.** The HCES state bundles put key-format notes in their titles ("Keys
   <state>_<sector> are the Food Total share…"), and every-cut links print them. Move those to
   `meta.note`; titles are what a reader sees. Sweep every bundle's `meta.coverage` and series
   labels for internal key or field names leaking into reader text, and add a qc check.
5. **Search ranking.** For "inflation in Kerala", search ranks CPI-AL/RL rows above Kerala's
   own CPI. When a query names a state and a topic, the state's own headline measure for that
   topic (and its profile) should lead, ahead of narrower series. Fix it in
   `src/dossiers/search-core.js`, generally, with tests on ten state-and-topic queries.

Own: the adapters and bundles you rebake, the checks you add, search-core changes. Coordinate
nothing else; other branches are in flight (review-a, review-b, review-c, fix-shared), so keep
edits to shared files small and marked.

Finish: build and gates in a slot (delete ./dist after), npm test, prose:dry, verify all
prose; status in `docs/status/datafix.md`; message the coordinator "datafix: done".
