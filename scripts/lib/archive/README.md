# Deep-archive export hooks

`scripts/archive.mjs` builds the deep archive (docs/PLAN-launch.md §2b). For each coverage
ledger with `archive: true` rules it loads `scripts/lib/archive/<ledger family>.mjs` and calls

    export async function* tables({ rules, root, vintage, log })

`rules` is a list of `{ rule, items }`: the ledger rule and the catalogue items it decides.
The hook yields one table spec per archive table:

    { table,          // file stem, unique within the family ("dbie-966")
      title,          // one line for the manifest and the dataset card
      source,         // publisher, as a reader would cite it
      rule,           // the ledger rule's match, as written
      rolls_up_to,    // the baked bundles this table is the finer grain of
      vintage,        // the data vintage (YYYY-MM-DD), never the export date
      columns,        // column names, long format: dimensions, date, value, unit, flags, source, vintage
      rows,           // async iterable of arrays in column order
      expectedRows,   // what the catalogue or the source says the table holds, or null
      expectedNote,   // where that expectation comes from
      unserved,       // optional: catalogue item ids the source's API returns nothing for
      unservedNote }  // optional: how that was established

The builder writes csv.gz and Parquet, counts rows, and refuses a table whose count differs
from `expectedRows`. A hook never drops a requested item silently: an item the source does
not serve is either a failure (the hook misread the answer) or listed in `unserved`, which the
manifest carries on the table's entry; climate-cckp re-asks each empty facet alone to tell the two apart. Families that stage files instead (trade) need no hook: anything in
`data/archive/staging/<family>/files.json` and `staging/<family>-raw/` with an index in
`data/raw/<family>-index.json` is picked up as it is.
