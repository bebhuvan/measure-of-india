import json, math
d=json.load(open("panels.json")); R=d["raw"]
H=R["H"]; G=R["G"]; rural=R["rural"]; urban=R["urban"]; N=len(H)
food, misc, hous, fuel, clot, pan = G
def s(t,p,a,ph=0): return a*math.sin(2*math.pi*(t/p)+ph)

# core = headline stripped of food and fuel, re-weighted
core=[round((H[i]-0.4586*food[i]-0.0684*fuel[i])/0.473,2) for i in range(N)]
# wholesale prices: commodity-led, far more violent than the shop counter
wpi=[]
for i in range(N):
    y=2015+i//12; m=i%12+1
    v=1.6+1.35*(H[i]-4.6)+s(i,26,2.4,0.7)
    if y in (2015,2016): v-=5.0
    if y==2020: v-=2.6
    if (y==2021 and m>=3) or y==2022: v+=8.5
    if y in (2023,2024): v-=3.4
    if y>=2025: v-=1.0
    wpi.append(round(v,2))
# GDP deflator: quarterly, whole economy, published with a lag
defl=[]
for q in range(N//3):
    i=q*3+1
    defl.append(round(3.6+0.55*(H[min(i,N-1)]-4.6)+s(q,9,1.1,0.5),2))
# policy repo rate: a step function, decided in meetings
steps=[(0,6.75),(12,6.25),(26,6.00),(38,6.25),(45,6.50),(54,5.75),(57,5.15),
       (63,4.40),(64,4.00),(87,4.40),(89,4.90),(91,5.40),(93,5.90),(95,6.25),
       (97,6.50),(120,6.25),(123,6.00),(126,5.50)]
repo=[]; cur=steps[0][1]; k=0
for i in range(N):
    while k+1<len(steps) and steps[k+1][0]<=i: k+=1; cur=steps[k][1]
    repo.append(cur)
# real rural wage growth: nominal wage growth less rural CPI
nomw=[round(6.4+s(i,53,1.6,0.9)+s(i,19,0.7,2.1)+(1.4 if i>110 else 0),2) for i in range(N)]
realw=[round(nomw[i]-rural[i],2) for i in range(N)]

FAM=[
 ("headline","View A","CPI, combined","The number in the headline",H,"#1A1F1D","rgba(26,31,29,.10)","%",1),
 ("split","View B","CPI rural","Villages, on their own basket",rural,"#4A5551","rgba(74,85,81,.10)","%",1),
 ("split","View B","CPI urban","Towns and cities",urban,"#8A918C","rgba(138,145,140,.13)","%",1),
 ("component","Plate II","CPI food and beverages","Nearly half the basket",food,"#0065B1","#C5E0FC","%",1),
 ("component","Plate 22","CPI core","Everything except food and fuel",core,"#9F7200","#F4E1BA","%",1),
 ("rival","Plate 31","Wholesale Price Index","The factory gate, not the shop",wpi,"#00897C","#BEE8E2","%",1),
 ("rival","Plate 34","GDP deflator","Quarterly, and the whole economy",defl,"#B5462B","#FDD3C8","%",3),
 ("policy","Plate 02","Policy repo rate","Decided in meetings, not measured",repo,"#7153B2","#E0D8FB","%",1),
 ("downstream","Plate 48","Real rural wage growth","What is left after CPI rural",realw,"#278A47","#CBEBD0","%",1),
]

ROW=64; PAD=7
def spark(vals,step,col,is_step=False):
    n=len(vals); lo=min(vals); hi=max(vals); pad=(hi-lo)*0.07 or .5
    Y=lambda v: PAD+(ROW-2*PAD)*(1-(v-lo+pad)/((hi+pad)-(lo-pad)))
    X=lambda i: 1000.0*(i*step)/(N-1)
    if is_step:
        pts=[]
        for i,v in enumerate(vals):
            if i: pts.append(f"{X(i):.1f} {Y(vals[i-1]):.2f}")
            pts.append(f"{X(i):.1f} {Y(v):.2f}")
        p="M"+" L".join(pts)
    else:
        p="M"+" L".join(f"{X(i):.1f} {Y(v):.2f}" for i,v in enumerate(vals))
    z=Y(0) if lo<0<hi else None          # only when the data really crosses zero
    lastx=X(len(vals)-1)
    base=Y(lo-pad)
    area=p+f" L{lastx:.1f} {base:.2f} L0 {base:.2f} Z"
    return p,area,z,round(Y(vals[-1]),1),lo,hi,round(lastx,1)

rows=[]
for i,(tag,ref,name,desc,vals,col,fill,unit,step) in enumerate(FAM):
    p,area,z,ly,lo,hi,lastx=spark(vals,step,col,is_step=(name=="Policy repo rate"))
    kstart=' kstart' if i>0 and tag!=FAM[i-1][0] else ''
    zl=f'<line x1="0" y1="{z:.1f}" x2="1000" y2="{z:.1f}" class="zero-sm"/>' if z is not None else ""
    rows.append(f'''<div class="rail fam-rail{kstart}">
      <span class="fam-tag {tag}">{tag} <em>{ref}</em></span>
      <span class="fam-name"><i style="background:{col}"></i>{name}</span>
      <span class="fam-desc">{desc} &middot; range {lo:.1f} to {hi:.1f}%</span>
    </div>
    <div class="panel fam{kstart}" style="--h:{ROW}px">
      <div class="pg"></div>
      <div class="pp"><svg viewBox="0 0 1000 {ROW}" preserveAspectRatio="none" aria-hidden="true">
        <path d="{area}" fill="{fill}"/>{zl}
        <path d="{p}" fill="none" stroke="{col}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
        <rect x="{lastx-6:.1f}" y="{ly-3}" width="6" height="6" fill="{col}"/>
      </svg></div>
      <div class="pt fam-pt"><span class="famv" style="color:{col}">{vals[-1]:.2f}<em>{unit}</em></span></div>
    </div>''')

f=json.load(open("frags.json"))
f["FRONTISPIECE"]="\n".join(rows)
json.dump(f,open("frags.json","w"))
print("family rows:",len(rows))
for tag,ref,name,desc,vals,col,fill,unit,step in FAM:
    print(f"  {name:28s} latest={vals[-1]:6.2f}  range=({min(vals):.1f},{max(vals):.1f})  n={len(vals)}")
