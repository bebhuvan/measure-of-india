import sys,json,base64,io,openpyxl,datetime
raw=json.load(sys.stdin);out={}
for tag,body in raw.items():
 w=openpyxl.load_workbook(io.BytesIO(base64.b64decode(body['base64'])),data_only=True)
 out[tag]=[{'sheet':s.title,'rows':[[x.isoformat() if isinstance(x,(datetime.datetime,datetime.date)) else x for x in row] for row in s.values]} for s in w]
json.dump(out,sys.stdout,separators=(',',':'))
