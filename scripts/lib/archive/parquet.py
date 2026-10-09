"""scripts/lib/archive/parquet.py: csv.gz -> Parquet for the deep archive (scripts/archive.mjs).

Usage: python3 parquet.py <in.csv.gz> <out.parquet>
Every column is text except `value`, which is a float (an empty cell is null). Writes zstd
Parquet and prints {"rows": n, "columns": [...]} as JSON. Read with pyarrow only.
"""
import json, sys
import pyarrow as pa
import pyarrow.csv as pcsv
import pyarrow.parquet as pq

src, dst = sys.argv[1], sys.argv[2]
with pcsv.open_csv(src, read_options=pcsv.ReadOptions(block_size=1 << 24)) as probe:
    names = probe.schema.names
types = {n: (pa.float64() if n == "value" else pa.string()) for n in names}
table = pcsv.read_csv(src, read_options=pcsv.ReadOptions(block_size=1 << 24),
                      convert_options=pcsv.ConvertOptions(column_types=types, strings_can_be_null=False,
                                                          null_values=[""], quoted_strings_can_be_null=False))
pq.write_table(table, dst, compression="zstd")
print(json.dumps({"rows": table.num_rows, "columns": names}))
