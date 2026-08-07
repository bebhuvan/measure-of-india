import json
f=json.load(open("_src/frags_v1.json"))
s=open("_src/06-matrix.v1.tmpl.html").read()
for k in ["GRID_ROWS","SEGS","KEYS","DUMB","TICKS","GUIDES","FAM"]:
    tok=f"<!--{k}-->"
    assert tok in s, k
    s=s.replace(tok,f[k])
open("06-matrix.html","w").write(s); print("built V1:",len(s))
