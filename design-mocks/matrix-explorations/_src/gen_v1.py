"""V1 of the matrix page: original diverging ramp, grey basket ramp,
dumbbell coloured by level against the 4% target. No line chart, no sub-index grid."""
import json, math
d=json.load(open("panels.json")); R=d["raw"]
H=R["H"]; G=R["G"]; rural=R["rural"]; urban=R["urban"]; N=len(H)
MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
BINS=[(-99,2,"#1F6CB0","on-deep"),(2,3,"#6DA3DA","on-mid"),(3,4,"#C0D9F3","on-light"),
      (4,5,"#F9CFBC","on-light"),(5,6,"#D6876C","on-mid"),(6,99,"#B04431","on-deep")]
def binof(v):
    for lo,hi,c,t in BINS:
        if lo<=v<hi: return c,t
    return BINS[-1][2],BINS[-1][3]
IMPUTED={(2020,4),(2020,5)}; PROVISIONAL={(2026,5),(2026,6)}
cells=[]; i=0
for y in range(2015,2027):
    cells.append(f'<span class="yr">{y}</span>')
    for m in range(1,13):
        if i>=N: cells.append('<i class="cell void"></i>'); continue
        v=H[i]; c,t=binof(v); cls=["cell",t]
        if (y,m) in IMPUTED: cls.append("imputed")
        if (y,m) in PROVISIONAL: cls.append("prov")
        cells.append(f'<i class="{" ".join(cls)}" style="--c:{c}" '
                     f'title="{MONTHS[m-1]} {y} · {v:.1f}%">{v:.1f}</i>')
        i+=1
grid="\n      ".join(cells)

BASKET=[("Food and beverages",45.86,"#2A343E"),("Miscellaneous",28.32,"#4A545F"),
        ("Housing",10.07,"#6C7680"),("Fuel and light",6.84,"#8D96A0"),
        ("Clothing and footwear",6.53,"#AEB5BD"),("Pan, tobacco, intoxicants",2.38,"#CCD2D7")]
segs="".join(f'<span style="flex:{w};background:{c}" title="{n} · {w}%"></span>' for n,w,c in BASKET)
keys="".join(f'<li><i style="background:{c}"></i><b>{n}</b><em>{w:.2f}%</em></li>' for n,w,c in BASKET)

NAMES=[b[0] for b in BASKET]
now=[round(g[-1],2) for g in G]; ago=[round(g[-13],2) for g in G]
lo=min(min(now),min(ago)); hi=max(max(now),max(ago)); pad=(hi-lo)*0.16; lo-=pad; hi+=pad
X=lambda v:(v-lo)/(hi-lo)*100
rows=[]
for k in sorted(range(6),key=lambda k:-now[k]):
    a,b=ago[k],now[k]
    lvl="warm" if b>=4 else "cool"
    x1,x2=X(min(a,b)),X(max(a,b))
    rows.append(f'''<div class="dumb">
      <span class="dn">{NAMES[k]}</span>
      <span class="dtrack">
        <span class="dbar" style="left:{x1:.2f}%;width:{max(x2-x1,0.35):.2f}%"></span>
        <span class="dot was" style="left:{X(a):.2f}%"></span>
        <span class="dot now {lvl}" style="left:{X(b):.2f}%"></span>
      </span>
      <span class="dv {lvl}">{b:.1f}</span>
    </div>''')
ticks="".join(f'<span class="dtick{" zero" if v==0 else ""}" style="left:{X(v):.2f}%">{v}</span>' for v in range(-1,6))
guides="".join(f'<span class="dguide{" tgt" if v==4 else ""}" style="left:{X(v):.2f}%"></span>' for v in range(-1,6))

core=round((H[-1]-0.4586*G[0][-1]-0.0684*G[3][-1])/0.473,2)
fam=[("CPI, combined",H[-1],"the headline"),("Rural",rural[-1],"villages"),
     ("Urban",urban[-1],"towns and cities"),("Food and beverages",G[0][-1],"45.9% of the basket"),
     ("Core, ex food and fuel",core,"47.3% of the basket"),("Wholesale prices",1.16,"the factory gate"),
     ("GDP deflator",3.58,"quarterly"),("Policy repo rate",5.50,"decided, not measured")]
famrows="".join(f'<tr><td>{n}</td><td class="fd">{de}</td><td class="fv">{v:.2f}</td></tr>' for n,v,de in fam)

json.dump({"GRID_ROWS":grid,"SEGS":segs,"KEYS":keys,"DUMB":"\n".join(rows),
           "TICKS":ticks,"GUIDES":guides,"FAM":famrows},open("frags_v1.json","w"))
print("v1 fragments written")
