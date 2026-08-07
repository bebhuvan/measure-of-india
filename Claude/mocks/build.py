import json
S="_src/"
f=json.load(open(S+"frags.json"))
labels={
 "PANEL_A":"Line chart: India's headline CPI inflation year on year, January 2015 to June 2026. It peaks at 7.8 per cent in April 2022 and falls to 0.8 per cent in October 2025.",
 "PANEL_B":"Line chart: rural and urban CPI inflation on one axis, with the space between them shaded.",
 "PANEL_C":"Stacked area chart: each of the six CPI groups' contribution in percentage points, stacking to the headline. Bands below zero subtracted from the headline.",
}
for k,v in labels.items():
    f[k]=f[k].replace('aria-hidden="true"',f'role="img" aria-label="{v}"',1)
# the unit strip already opens Plate II, so the first small-multiple row is not the frame top
f["SMALL_MULTIPLES"]=f["SMALL_MULTIPLES"].replace('class="panel sm first"','class="panel sm"',1)
s=open("05-plate.tmpl.html").read()
for k in ["FRONTISPIECE","AXIS3","PANEL_A","PANEL_B","PANEL_C","PANEL_D","UNIT_STRIP","AXIS2","AXIS","SMALL_MULTIPLES","LEGEND_C"]:
    tok=f"<!--{k}-->"
    assert tok in s, k
    s=s.replace(tok,f[k])
open("05-plate.html","w").write(s)
print("built",len(s))
