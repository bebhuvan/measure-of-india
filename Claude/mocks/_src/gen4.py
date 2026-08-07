import json
d=json.load(open("panels.json")); R=d["raw"]
H=R["H"]; G=R["G"]; rural=R["rural"]; urban=R["urban"]; N=len(H)
MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
BINS=[(-99,2,"#338DDF","on-light"),(2,3,"#6BB2F8","on-light"),(3,4,"#BEDDFD","on-light"),
      (4,5,"#FECBC2","on-light"),(5,6,"#F38B7E","on-light"),(6,99,"#E25B54","on-light")]
def binof(v):
    for lo,hi,c,t in BINS:
        if lo<=v<hi: return c,t
    return BINS[-1][2],BINS[-1][3]

IMPUTED={(2020,4),(2020,5)}
PROVISIONAL={(2026,5),(2026,6)}

cells=[]; i=0
for y in range(2015,2027):
    cells.append(f'<span class="yr">{y}</span>')
    for m in range(1,13):
        if i>=N:
            cells.append('<i class="cell void"></i>'); continue
        v=H[i]; c,t=binof(v)
        cls=["cell",t]
        if (y,m) in IMPUTED: cls.append("imputed")
        if (y,m) in PROVISIONAL: cls.append("prov")
        cells.append(f'<i class="{" ".join(cls)}" style="--c:{c}" '
                     f'title="{MONTHS[m-1]} {y} · {v:.1f}%">{v:.1f}</i>')
        i+=1
grid="\n      ".join(cells)

inband=sum(1 for v in H if 2<=v<=6); above=sum(1 for v in H if v>6); below=sum(1 for v in H if v<2)

# ---- basket: one proportional bar, sequential ink ramp ----
# one hue per group, used wherever that group appears anywhere in the atlas
BASKET=[("Food and beverages",45.86,"#4FA3F4"),("Miscellaneous",28.32,"#FB8578"),
        ("Housing",10.07,"#36C1CF"),("Fuel and light",6.84,"#E1AC41"),
        ("Clothing and footwear",6.53,"#B18CF0"),("Pan, tobacco, intoxicants",2.38,"#6DC688")]
segs="".join(f'<span style="flex:{w};background:{c}" title="{n} · {w}%"></span>' for n,w,c in BASKET)
keys="".join(f'<li><i style="background:{c}"></i><b>{n}</b><em>{w:.2f}%</em></li>' for n,w,c in BASKET)

# ---- dumbbell: each group now vs twelve months ago ----
NAMES=[b[0] for b in BASKET]
now=[round(g[-1],2) for g in G]; ago=[round(g[-13],2) for g in G]
lo=min(min(now),min(ago)); hi=max(max(now),max(ago)); pad=(hi-lo)*0.16
lo-=pad; hi+=pad
X=lambda v:(v-lo)/(hi-lo)*100
rows=[]
order=sorted(range(6),key=lambda k:-now[k])
for k in order:
    a,b=ago[k],now[k]
    col=BASKET[k][2]                    # the group's own colour, not a value encoding
    x1,x2=X(min(a,b)),X(max(a,b))
    rows.append(f'''<div class="dumb">
      <span class="dn">{NAMES[k]}</span>
      <span class="dtrack">
        <span class="dbar" style="left:{x1:.2f}%;width:{max(x2-x1,0.35):.2f}%;background:{col};opacity:.28"></span>
        <span class="dot was" style="left:{X(a):.2f}%;box-shadow:inset 0 0 0 2px {col}"></span>
        <span class="dot now" style="left:{X(b):.2f}%;background:{col}"></span>
      </span>
      <span class="dv">{b:.1f}</span>
    </div>''')
ticks="".join(f'<span class="dtick{" zero" if v==0 else ""}" style="left:{X(v):.2f}%">{v}</span>' for v in range(-1,6))
guides="".join(f'<span class="dguide{" tgt" if v==4 else ""}" style="left:{X(v):.2f}%"></span>' for v in range(-1,6))
guides+=f'<span class="dguide tgt" style="left:{X(4):.2f}%"></span>'

fam=[("CPI, combined",H[-1],"the headline"),("Rural",rural[-1],"villages"),
     ("Urban",urban[-1],"towns and cities"),("Food and beverages",G[0][-1],"45.9% of the basket"),
     ("Core, ex food and fuel",round((H[-1]-0.4586*G[0][-1]-0.0684*G[3][-1])/0.473,2),"47.3% of the basket"),
     ("Wholesale prices",1.16,"the factory gate"),("GDP deflator",3.58,"quarterly"),
     ("Policy repo rate",5.50,"decided, not measured")]
famrows="".join(f'<tr><td>{n}</td><td class="fd">{d}</td><td class="fv">{v:.2f}</td></tr>' for n,v,d in fam)

json.dump({"GRID_ROWS":grid,"SEGS":segs,"KEYS":keys,"DUMB":"\n".join(rows),
           "TICKS":ticks,"GUIDES":guides,"FAM":famrows},open("frags4.json","w"))
print("in band",inband,"above",above,"below",below,"of",N)
print("now",now); print("ago",ago); print("scale",round(lo,2),round(hi,2))

# ---------------- the last three years: presence, colour, direct labels ----------------
import urllib.parse
W,HH=1000.0,400.0
win=H[-36:]                       # Jul 2023 .. Jun 2026
n=len(win)
sm=[round(sum(win[max(0,i-1):min(n,i+2)])/len(win[max(0,i-1):min(n,i+2)]),3) for i in range(n)]
X2=lambda i: W*i/(n-1)
Y2=lambda v: HH*(1-v/8.0)
P=lambda y: y/HH*100
TGT=Y2(4)
raw="M"+" L".join(f"{X2(i):.1f} {Y2(v):.2f}" for i,v in enumerate(win))
trend="M"+" L".join(f"{X2(i):.1f} {Y2(v):.2f}" for i,v in enumerate(sm))
grid="".join(f'<line x1="0" y1="{Y2(v):.2f}" x2="{W:.0f}" y2="{Y2(v):.2f}"/>' for v in [2,6])
ylabs="".join(f'<span class="lyl" style="top:{P(Y2(v)):.2f}%">{v}{"%" if v==6 else ""}</span>' for v in [2,4,6])
MLB=["Jul 2023","Jan 2024","Jul","Jan 2025","Jul","Jan 2026","Jun"]
XT=list(zip([0,6,12,18,24,30,35],MLB))
xlabs="".join(f'<span class="lxl" style="left:{X2(i)/10:.2f}%">{t}</span>' for i,t in XT)
trough=win.index(min(win)); peak=15
marks="".join(f'<circle cx="{X2(i):.1f}" cy="{Y2(win[i]):.2f}" r="4.5" class="ldot"/>'
              for i in [0,peak,trough,n-1])
line_frag=f'''<svg viewBox="0 0 {W:.0f} {HH:.0f}" preserveAspectRatio="none" aria-hidden="true">
  <rect x="0" y="{Y2(6):.2f}" width="{W:.0f}" height="{Y2(2)-Y2(6):.2f}" class="lband"/>
  <g class="lgrid">{grid}</g>
  <line class="ltgt" x1="0" y1="{TGT:.2f}" x2="{W:.0f}" y2="{TGT:.2f}"/>
  <path d="{raw}" class="lraw"/>
  <path d="{trend}" class="ltrend"/>
  {marks}
</svg>'''
def vlab(i,cls,txt):
    return (f'<span class="lval {cls}" style="left:{X2(i)/10:.2f}%;'
            f'top:{P(Y2(win[i])):.2f}%">{txt}</span>')
anns=(vlab(0,"up","7.4%")+vlab(peak,"up","6.2%")+vlab(trough,"down","0.8%")
      + f'<span class="lan tgt" style="top:{P(TGT)+1.6:.2f}%">4% target</span>'
      + f'<span class="lan bandlab" style="top:{P(Y2(6))+1.4:.2f}%">Statutory band, 2 to 6%</span>'
      + f'<span class="lan end" style="top:{P(Y2(win[-1]))-19:.2f}%">3.8%<em>June 2026</em></span>')

# ---- real CSV downloads, embedded as data URIs (no server, no script) ----
def csv_uri(head,rows):
    txt=head+"\n"+"\n".join(rows)+"\n"
    return "data:text/csv;charset=utf-8,"+urllib.parse.quote(txt)
MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
allrows=[f"{2015+i//12}-{i%12+1:02d},{v}" for i,v in enumerate(H)]
csv_all=csv_uri("month,cpi_yoy_pct",allrows)
csv_win=csv_uri("month,cpi_yoy_pct,three_month_avg",
    [f"{2023+((6+i)//12)}-{((6+i)%12)+1:02d},{win[i]},{sm[i]}" for i in range(n)])
csv_basket=csv_uri("group,weight_pct",[f"{n_},{w}" for n_,w,c in BASKET])
csv_groups=csv_uri("group,jun_2025_pct,jun_2026_pct",
    [f"{NAMES[k]},{ago[k]},{now[k]}" for k in range(6)])

o=json.load(open("frags4.json"))
o.update({"LINE":line_frag,"LYL":ylabs,"LXL":xlabs,"LANN":anns,
          "CSV_ALL":csv_all,"CSV_WIN":csv_win,"CSV_BASKET":csv_basket,"CSV_GROUPS":csv_groups})
json.dump(o,open("frags4.json","w"))
print("line ok | trend end",sm[-1],"| csv sizes",len(csv_all),len(csv_win))
