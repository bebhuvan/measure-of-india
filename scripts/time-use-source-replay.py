#!/usr/bin/env python3
"""Independent source-cell replay against the archived original XLSX bytes."""
import base64,gzip,hashlib,io,json,sys
from pathlib import Path
import openpyxl
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
x=json.load(gzip.open(root/'data/raw/time-use/extracted-2024.json.gz'))
count=0; blanks=0
for t in x['tables']:
 source=json.load(gzip.open(root/t['rawFile']))
 body=base64.b64decode(source['bodyBase64'])
 assert hashlib.sha256(body).hexdigest()==t['sourceSha256'], t['id']
 w=openpyxl.load_workbook(io.BytesIO(body),data_only=True,read_only=False)
 seen=set()
 for r in t['records']:
  cell=w[r['sheet']][r['cell']]
  assert cell.value==r['raw'], (t['id'],r['cell'],'Original source cell changed')
  assert (r['sheet'],r['cell']) not in seen, (t['id'],r['cell'],'Repeated physical source cell')
  seen.add((r['sheet'],r['cell']))
  if r['value'] is None:
   assert str(cell.value).strip()=='-',(t['id'],r['cell'],'Unpublished marker');blanks+=1
  else:
   assert float(cell.value)==r['value'],(t['id'],r['cell'],'Numeric conversion');count+=1
print(json.dumps({'workbooks':len(x['tables']),'numericCells':count,'sourceDashes':blanks,'originalCellMismatches':0}))
