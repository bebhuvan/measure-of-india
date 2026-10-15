# XLSX conversion only: rows remain addressed by source labels in the JS adapter.
import openpyxl,json,sys,datetime
out={}
for tag in ['balance','annex-balance']:
 w=openpyxl.load_workbook('/tmp/atlas-energy-'+tag+'-2026.xlsx',data_only=True)
 out[tag]=[{'sheet':s.title,'rows':[[x.isoformat() if isinstance(x,(datetime.datetime,datetime.date)) else x for x in row] for row in s.values]} for s in w]
with open('/tmp/atlas-energy-workbook-rows.json','w') as f:json.dump(out,f)
