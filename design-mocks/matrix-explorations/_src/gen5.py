import json, math, urllib.parse
d=json.load(open("panels.json")); R=d["raw"]
H=R["H"]; G=R["G"]; N=len(H)
food,misc,hous,fuel,clot,pan=G
FAM={"food":("Food and beverages","#4FA3F4",food),
     "misc":("Miscellaneous","#FB8578",misc),
     "hous":("Housing","#36C1CF",hous),
     "fuel":("Fuel and light","#E1AC41",fuel),
     "clot":("Clothing and footwear","#B18CF0",clot),
     "pan":("Pan, tobacco","#6DC688",pan)}

# sub-index, family, weight, (beta, level shift, amplitude, period, phase)
SUB=[
 ("Housing","hous",10.07,(1.00, 0.0,0.0,60,0)),
 ("Cereals and products","food", 9.67,(0.55, 1.4,1.1,29,0.4)),
 ("Transport and communication","misc",8.59,(0.80,-0.7,1.6,23,1.9)),
 ("Fuel and light","fuel", 6.84,(1.00, 0.0,0.0,60,0)),
 ("Milk and products","food", 6.61,(0.35, 2.1,0.8,41,2.6)),
 ("Vegetables","food", 6.04,(1.55,-1.2,4.2,17,0.9)),
 ("Health","misc", 5.89,(0.45, 2.2,0.5,53,1.2)),
 ("Clothing","clot", 5.58,(1.02,-0.1,0.4,47,0.3)),
 ("Prepared meals and snacks","food", 5.55,(0.42, 2.4,0.7,37,2.1)),
 ("Education","misc", 4.46,(0.30, 2.9,0.6,61,0.7)),
 ("Personal care and effects","misc",3.89,(0.90, 0.6,2.8,31,2.4)),
 ("Household goods and services","misc",3.80,(0.55, 1.2,0.9,43,1.6)),
 ("Meat and fish","food", 3.61,(0.70, 1.1,1.9,26,1.1)),
 ("Oils and fats","food", 3.56,(1.30,-1.6,3.6,34,2.9)),
 ("Fruits","food", 2.89,(1.10, 0.9,3.3,22,0.2)),
]
def raw_series(key,p):
    base=FAM[key][2]; beta,shift,amp,per,ph=p
    return [base[i]*beta+shift+amp*math.sin(2*math.pi*i/per+ph) for i in range(N)]

# reconcile: within a group, the weight-weighted mean of its sub-indices must equal the group
_raw={nm:raw_series(k,p) for nm,k,w,p in SUB}
for key in FAM:
    mem=[(nm,w) for nm,k,w,p in SUB if k==key]
    if not mem: continue
    tot=sum(w for _,w in mem); parent=FAM[key][2]
    for i in range(N):
        wm=sum(w*_raw[nm][i] for nm,w in mem)/tot
        delta=parent[i]-wm
        for nm,_ in mem: _raw[nm][i]+=delta
SERIES={nm:[round(v,2) for v in _raw[nm]] for nm in _raw}
def series(key,p,name=None): return SERIES[name]

WIN=36
W,HH=300.0,96.0
def panel(name,key,w,p):
    v=SERIES[name][-WIN:]
    lo,hi=min(v),max(v); pad=max((hi-lo)*0.14,0.35)
    Y=lambda t: HH*(1-(t-(lo-pad))/((hi+pad)-(lo-pad)))
    X=lambda i: W*i/(WIN-1)
    line="M"+" L".join(f"{X(i):.1f} {Y(t):.2f}" for i,t in enumerate(v))
    area=line+f" L{W:.0f} {HH:.0f} L0 {HH:.0f} Z"
    col=FAM[key][1]
    zero=(f'<line x1="0" y1="{Y(0):.2f}" x2="{W:.0f}" y2="{Y(0):.2f}" class="sp-zero"/>'
          if lo<0<hi else "")
    return f'''<div class="sp">
      <div class="sp-h"><span class="sp-n">{name}</span><span class="sp-w">{w:.2f}%</span></div>
      <div class="sp-plot">
        <svg viewBox="0 0 {W:.0f} {HH:.0f}" preserveAspectRatio="none" aria-hidden="true">
          <path d="{area}" fill="{col}" fill-opacity=".22"/>{zero}
          <path d="{line}" fill="none" stroke="{col}" stroke-width="2.3"
                stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        </svg>
        <span class="chip" style="background:{col};top:{min(max(Y(v[-1])/HH*100,7),93):.2f}%">{v[-1]:.1f}</span>
      </div>
      <div class="sp-r">{FAM[key][0]} &middot; range {lo:.1f} to {hi:.1f}%</div>
    </div>'''

grid="\n".join(panel(*s) for s in SUB)
rows=[]
for name,key,w,p in SUB:
    v=SERIES[name]
    rows.append(f"{name},{FAM[key][0]},{w},{v[-1]}")
csv="data:text/csv;charset=utf-8,"+urllib.parse.quote(
    "sub_index,group,weight_pct,jun_2026_yoy_pct\n"+"\n".join(rows)+"\n")

o=json.load(open("frags4.json"))
o.update({"SUBGRID":grid,"CSV_SUB":csv})
json.dump(o,open("frags4.json","w"))
print("panels:",len(SUB))
for name,key,w,p in SUB[:5]:
    v=SERIES[name]; print(f"  {name:30s} {FAM[key][0]:22s} w={w:5.2f} now={v[-1]:6.2f}")
