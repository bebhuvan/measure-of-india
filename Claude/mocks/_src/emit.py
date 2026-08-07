import json
d=json.load(open("panels.json")); o={}

def yls(vals,g,unit=""):
    return "".join(f'<span class="yl" style="top:{g[str(v)]}px">{v}{unit if v==vals[-1] else ""}</span>'
                   for v in vals)

# ---------------- A · headline ----------------
A=d["A"]; g=A["grid"]
grid="".join(f'<line x1="0" y1="{g[str(v)]}" x2="1000" y2="{g[str(v)]}"/>' for v in [2,4,6,8])
o["PANEL_A"]=f'''<div class="panel" style="--h:{A['h']}px">
  <div class="pg">{yls([2,4,6,8],g," %")}</div>
  <div class="pp">
    <svg viewBox="0 0 1000 {A['h']}" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="{A['band'][0]}" width="1000" height="{A['band'][1]}" class="stat-band"/>
      <g class="grid">{grid}</g>
      <rect x="{A['gap'][0]}" y="0" width="{max(A['gap'][1],5)}" height="{A['h']}" class="gap-mark"/>
      <path d="{A['path']}" class="ink-line"/>
      <rect x="{A['peak'][0]-3}" y="{A['peak'][1]-3}" width="6" height="6" class="dot-rev"/>
      <rect x="{A['trough'][0]-3}" y="{A['trough'][1]-3}" width="6" height="6" class="dot-rev"/>
      <rect x="994" y="{A['last'][1]-3}" width="6" height="6" class="dot-ink"/>
    </svg>
    <span class="an band-an" style="top:{g['2']-21:.0f}px">Statutory band, 2 to 6%</span>
    <span class="an lead flip" style="left:{A['peak'][0]/10+0.4:.2f}%;top:2px">7.8% &middot; April 2022<i style="height:8px"></i></span>
    <span class="an lead flip" style="left:{A['trough'][0]/10-0.5:.2f}%;top:{A['trough'][1]-36:.0f}px">0.8% &middot; October 2025<i style="height:24px"></i></span>
    <span class="an lead up" style="left:{A['gap'][0]/10+1.0:.2f}%;top:{A['h']-19:.0f}px">Collection suspended, Apr–May 2020<i style="height:{A['h']-42:.0f}px"></i></span>
  </div>
  <div class="pt"><span class="tv" style="top:{A['last'][1]-17}px">3.8<i>%</i><small>June 2026</small></span></div>
</div>'''

# ---------------- B · rural and urban ----------------
B=d["B"]; gb=B["grid"]
grid="".join(f'<line x1="0" y1="{gb[str(v)]}" x2="1000" y2="{gb[str(v)]}"/>' for v in [2,4,6])
o["PANEL_B"]=f'''<div class="panel" style="--h:{B['h']}px">
  <div class="pg">{yls([2,4,6],gb," %")}</div>
  <div class="pp">
    <svg viewBox="0 0 1000 {B['h']}" preserveAspectRatio="none" aria-hidden="true">
      <g class="grid">{grid}</g>
      <path d="{B['fill']}" class="gap-fill"/>
      <path d="{B['urban']}" class="ink-line thin muted"/>
      <path d="{B['rural']}" class="ink-line thin"/>
      <rect x="994" y="{B['rlast']-3}" width="6" height="6" class="dot-ink"/>
      <rect x="994" y="{B['ulast']-3}" width="6" height="6" class="dot-mut"/>
    </svg>
  </div>
  <div class="pt">
    <span class="tv sm" style="top:{min(B['rlast']-15,B['h']-82):.0f}px">{B['rval']}<small>Rural</small></span>
    <span class="tv sm mut" style="top:{min(B['rlast']-15,B['h']-82)+42:.0f}px">{B['uval']}<small>Urban</small></span>
  </div>
</div>'''

# ---------------- C · contribution ----------------
C=d["C"]; gc=C["grid"]
grid="".join(f'<line x1="0" y1="{gc[str(v)]}" x2="1000" y2="{gc[str(v)]}"/>' for v in [2,4,6])
ar="".join(f'<path d="{a["pos"]}" fill="{a["f"]}"/><path d="{a["neg"]}" fill="{a["f"]}"/>'
           for a in C["areas"])
edges="".join(f'<path d="{a["pos"]}" fill="none" stroke="{a["c"]}" stroke-opacity=".34" stroke-width="1" vector-effect="non-scaling-stroke"/>'
              f'<path d="{a["neg"]}" fill="none" stroke="{a["c"]}" stroke-opacity=".34" stroke-width="1" vector-effect="non-scaling-stroke"/>'
              for a in C["areas"])
o["PANEL_C"]=f'''<div class="panel" style="--h:{C['h']}px">
  <div class="pg"><span class="yl" style="top:{gc['-1']}px">&minus;1</span>{yls([2,4,6],gc," pp")}</div>
  <div class="pp">
    <svg viewBox="0 0 1000 {C['h']}" preserveAspectRatio="none" aria-hidden="true">
      <g class="grid">{grid}</g>
      <g class="stack">{ar}{edges}</g>
      <line x1="0" y1="{C['zero']}" x2="1000" y2="{C['zero']}" class="zero"/>
      <path d="{C['net']}" class="ink-line net"/>
    </svg>
  </div>
  <div class="pt"><span class="tv sm" style="top:{C['zero']-60}px">3.80<small>Net, pp</small></span></div>
</div>'''

# ---------------- D · comparability ----------------
D=d["D"]
o["PANEL_D"]=f'''<div class="panel ribbon" style="--h:48px">
  <div class="pg"><span class="yl rl">Status</span></div>
  <div class="pp"><div class="rib">
      <span class="rib-gap" style="left:{D['gap'][0]/10:.2f}%;width:{max(D['gap'][1]/10,0.9):.2f}%"></span>
      <span class="rib-prov" style="left:{D['prov'][0]/10:.2f}%;width:{D['prov'][1]/10:.2f}%"></span>
  </div>
  <span class="an rib-an" style="left:0">Final</span>
  <span class="an rib-an rev" style="left:{D['gap'][0]/10+1.4:.2f}%">Imputed</span>
  <span class="an rib-an flip" style="left:{D['prov'][0]/10-0.6:.2f}%">Provisional</span>
  </div>
  <div class="pt"></div>
</div>'''

# ---------------- basket, 100 cells ----------------
GROUPS_META=[("Food and beverages",45.86,"#0065B1"),("Miscellaneous",28.32,"#9F7200"),
  ("Housing",10.07,"#7153B2"),("Fuel and light",6.84,"#278A47"),
  ("Clothing and footwear",6.53,"#B5462B"),("Pan, tobacco, intoxicants",2.38,"#00897C")]
ROUNDW=[46,28,10,7,7,2]
cells="".join(f'<i style="background:{GROUPS_META[k][2]}"></i>'
              for k in range(6) for _ in range(ROUNDW[k]))
o["UNIT_STRIP"]=f'''<div class="panel unit" style="--h:74px">
  <div class="pg"><span class="yl rl">Basket</span></div>
  <div class="pp"><div class="ustrip" role="img" aria-label="One hundred cells, one per cent of the consumer basket each: food 46, miscellaneous 28, housing 10, fuel 7, clothing 7, pan and tobacco 2.">{cells}</div>
    <span class="an ustrip-an">One cell = 1% of the basket</span>
  </div>
  <div class="pt"><b class="smhead"><span>Now</span><span>pp</span></b></div>
</div>'''

# ---------------- shared axis, drawn once per plate ----------------
YEARS=[2015,2018,2021,2024,2026]
labs="".join(f'<span class="xl" style="left:{a["p"]+(4.3 if a["y"]<2026 else 2.0):.3f}%">{a["y"]}</span>'
             for a in d["axisPct"] if a["y"] in YEARS)
o["AXIS"]=f'''<div class="panel axis">
  <div class="pg"></div><div class="pp"><div class="xaxis">{labs}</div></div><div class="pt"></div>
</div>'''
o["AXIS2"]=o["AXIS"]; o["AXIS3"]=o["AXIS"]

# ---------------- Plate II · the six groups ----------------
rows=[]
for i,s in enumerate(d["SM"]):
    zero=f'<line x1="0" y1="{s["zero"]}" x2="1000" y2="{s["zero"]}" class="zero-sm"/>' if s["zero"] is not None else ""
    rows.append(f'''<div class="rail sm-rail">
      <span class="sm-name"><i style="background:{s['c']}"></i>{s['n']}</span>
      <span class="sm-meta">{s['w']:.2f}% of the basket &middot; range {s['min']:.1f} to {s['max']:.1f}%</span>
    </div>
    <div class="panel sm" style="--h:54px">
      <div class="pg"></div>
      <div class="pp">
        <svg viewBox="0 0 1000 54" preserveAspectRatio="none" aria-hidden="true">
          <path d="{s['area']}" fill="{s['f']}"/>{zero}
          <path d="{s['path']}" fill="none" stroke="{s['c']}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
          <rect x="994" y="{s['lasty']-3}" width="6" height="6" fill="{s['c']}"/>
        </svg>
      </div>
      <div class="pt sm-pt"><span class="smv" style="color:{s['c']}">{s['last']}</span><span class="smc">{s['contrib']:.2f}</span></div>
    </div>''')
o["SMALL_MULTIPLES"]="\n".join(rows)

o["LEGEND_C"]="".join(
  f'<span class="lk"><i style="background:{a["f"]};box-shadow:inset 0 0 0 1px {a["c"]}"></i>{a["n"]}<b>{a["v"]:.2f}</b></span>'
  for a in C["areas"])
json.dump(o,open("frags.json","w"))
print({k:len(v) for k,v in o.items()})
