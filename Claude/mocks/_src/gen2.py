import json, math

years = {
2015:[5.2,5.4,5.3,4.9,5.0,5.4,3.7,3.7,4.4,5.0,5.4,5.6],
2016:[5.7,5.3,4.8,5.5,5.8,5.8,6.1,5.0,4.4,4.2,3.6,3.4],
2017:[3.2,3.7,3.9,3.0,2.2,1.5,2.4,3.3,3.3,3.6,4.9,5.2],
2018:[5.1,4.4,4.3,4.6,4.9,4.9,4.2,3.7,3.7,3.4,2.3,2.1],
2019:[2.0,2.6,2.9,2.9,3.0,3.2,3.2,3.3,4.0,4.6,5.5,7.4],
2020:[7.6,6.6,5.8,7.2,6.3,6.2,6.7,6.7,7.3,7.6,6.9,4.6],
2021:[4.1,5.0,5.5,4.2,6.3,6.3,5.6,5.3,4.4,4.5,4.9,5.7],
2022:[6.0,6.1,7.0,7.8,7.0,7.0,6.7,7.0,7.4,6.8,5.9,5.7],
2023:[6.5,6.4,5.7,4.7,4.3,4.9,7.4,6.8,5.0,4.9,5.6,5.7],
2024:[5.1,5.1,4.9,4.8,4.8,5.1,3.6,3.7,5.5,6.2,5.5,5.2],
2025:[4.3,3.6,3.3,3.2,2.8,2.1,1.6,2.1,1.5,0.8,1.4,2.0],
2026:[2.4,2.9,3.1,3.4,3.6,3.8],
}
H=[]; MONTH=[]
for y in sorted(years):
    for i,v in enumerate(years[y]):
        H.append(v); MONTH.append((y,i+1))
N=len(H)
mean=sum(H)/N

GROUPS=[("Food and beverages",45.86,"#0065B1","food","#C5E0FC"),
        ("Miscellaneous",28.32,"#9F7200","misc","#F4E1BA"),
        ("Housing",10.07,"#7153B2","hous","#E0D8FB"),
        ("Fuel and light",6.84,"#278A47","fuel","#CBEBD0"),
        ("Clothing and footwear",6.53,"#B5462B","clot","#FDD3C8"),
        ("Pan, tobacco, intoxicants",2.38,"#00897C","pan","#BFE7DF")]

def s(t,p,a,ph=0): return a*math.sin(2*math.pi*(t/p)+ph)

food=[];misc=[];hous=[];fuel=[];clot=[];pan=[]
for i,(h,(y,m)) in enumerate(zip(H,MONTH)):
    t=i
    d=h-mean
    food.append(4.6+1.85*d + s(t,41,1.1) + (2.6 if (y,m)>=(2019,9) and (y,m)<=(2020,2) else 0)
                + (1.9 if y==2023 and m in(7,8,9) else 0) - (3.2 if (y==2025 and m>=8) or (y==2026 and m<=2) else 0))
    misc.append(5.0+0.45*d + s(t,57,0.75,1.2) + (0.9 if y in(2021,2022) else 0) - (0.7 if y>=2025 else 0))
    hous.append(4.6+0.12*d + s(t,73,0.85,0.4) - (1.4 if y in(2021,2022) else 0) + (0.5 if y>=2024 else 0))
    fuel.append(3.0+0.9*d + s(t,29,2.6,2.1) - (5.5 if y in(2015,2016) else 0)
                + (7.0 if (y==2021 and m>=4) or y==2022 else 0) - (5.0 if y in(2023,2024) else 0))
    clot.append(5.2+0.18*d + s(t,64,0.6,2.4) + (4.2 if y==2022 else 0) - (2.2 if y>=2024 else 0))
    pan.append(6.6+0.3*d + s(t,47,1.3,0.8) - (2.4 if y>=2019 else 0) + (3.0 if y==2020 else 0))

G=[food,misc,hous,fuel,clot,pan]
W=[g[1] for g in GROUPS]
# reconcile: a uniform shift d on every group series moves the weighted sum by exactly d
for i in range(N):
    wsum=sum(W[k]*G[k][i] for k in range(6))/100.0
    delta=H[i]-wsum
    for k in range(6): G[k][i]=round(G[k][i]+delta,2)
resid=max(abs(sum(W[k]*G[k][i] for k in range(6))/100.0 - H[i]) for i in range(N))
CONTRIB=[[round(W[k]*G[k][i]/100.0,4) for i in range(N)] for k in range(6)]

# rural / urban: rural leans food-heavy, urban services-heavy
# rural minus urban: food-driven periods push rural above, services-driven pull it below
spread=[0.62*s(i,34,1.0)+0.40*s(i,71,1.0,1.1)+0.34*((G[0][i]-H[i])/3.0)+0.18 for i in range(N)]
rural=[round(H[i]+0.5288*spread[i],2) for i in range(N)]
urban=[round(H[i]-0.4712*spread[i],2) for i in range(N)]

X=lambda i: 1000.0*i/(N-1)
def yscale(h,lo,hi,pt=0,pb=0):
    return lambda v: pt+(h-pt-pb)*(1-(v-lo)/(hi-lo))
def line(vals,Y,x=X): return "M"+" L".join(f"{x(i):.1f} {Y(v):.2f}" for i,v in enumerate(vals))
def band(top,bot,Y):
    a=" L".join(f"{X(i):.1f} {Y(v):.2f}" for i,v in enumerate(top))
    b=" L".join(f"{X(i):.1f} {Y(v):.2f}" for i,v in reversed(list(enumerate(bot))))
    return "M"+a+" L"+b+" Z"

out={}
# ---------- PANEL A : headline, 260px, 0..8.5 ----------
hA=320; YA=yscale(hA,0,8.5)
out["A"]={"path":line(H,YA),"h":hA,
  "grid":{str(v):round(YA(v),1) for v in range(0,9)},
  "band":[round(YA(6),1),round(YA(2)-YA(6),1)],
  "last":[1000.0,round(YA(H[-1]),1)],
  "peak":[round(X(87),1),round(YA(7.8),1)],
  "trough":[round(X(129),1),round(YA(0.8),1)],
  "gap":[round(X(63),1),round(X(64)-X(63),1)]}

# ---------- PANEL B : rural / urban, 150px, 0..8.5 ----------
hB=156; YB=yscale(hB,0,8.5)
out["B"]={"rural":line(rural,YB),"urban":line(urban,YB),"fill":band(rural,urban,YB),"h":hB,
  "grid":{str(v):round(YB(v),1) for v in [2,4,6,8]},
  "rlast":round(YB(rural[-1]),1),"ulast":round(YB(urban[-1]),1),
  "rval":rural[-1],"uval":urban[-1]}

# ---------- PANEL C : contribution stack (signed), 190px, -1.6..8.6 ----------
hC=204; lo,hi=-1.6,8.6; YC=yscale(hC,lo,hi)
CB=[CONTRIB[0],CONTRIB[1],CONTRIB[2],CONTRIB[3],
    [round(CONTRIB[4][i]+CONTRIB[5][i],4) for i in range(N)]]
BANDS=[("Food and beverages","#0065B1","#C5E0FC"),("Miscellaneous","#9F7200","#F4E1BA"),
       ("Housing","#7153B2","#E0D8FB"),("Fuel and light","#278A47","#CBEBD0"),
       ("Clothing, pan and tobacco","#8E958F","#E6E8E3")]
NB=len(BANDS)
pos=[[0.0]*N for _ in range(NB+1)]; neg=[[0.0]*N for _ in range(NB+1)]
for i in range(N):
    up=0.0; dn=0.0
    for k in range(NB):
        c=CB[k][i]
        if c>=0: pos[k][i]=up; up+=c; pos[k+1][i]=up
        else:    neg[k][i]=dn; dn+=c; neg[k+1][i]=dn
areas=[]
for k in range(NB):
    top=[pos[k][i]+CB[k][i] if CB[k][i]>=0 else pos[k][i] for i in range(N)]
    bot=[pos[k][i] for i in range(N)]
    ntop=[neg[k][i] for i in range(N)]
    nbot=[neg[k][i]+CB[k][i] if CB[k][i]<0 else neg[k][i] for i in range(N)]
    areas.append({"pos":band(top,bot,YC),"neg":band(ntop,nbot,YC),
                  "c":BANDS[k][1],"f":BANDS[k][2],"n":BANDS[k][0],
                  "v":round(CB[k][-1],2)})
out["C"]={"areas":areas,"h":hC,"zero":round(YC(0),1),
  "net":line(H,YC),
  "grid":{str(v):round(YC(v),1) for v in [-1,2,4,6,8]}}

# ---------- PANEL D : comparability ribbon ----------
out["D"]={"h":26,"gap":[round(X(63),1),round(X(64)-X(63),1)],
          "prov":[round(X(N-2),1),round(1000-X(N-2),1)]}

# ---------- x axis ----------
out["axis"]=[{"y":y,"x":round(X(i),2)} for i,(y,m) in enumerate(MONTH) if m==1]
out["axisPct"]=[{"y":a["y"],"p":round(a["x"]/10.0,3)} for a in out["axis"]]

# ---------- PLATE II : small multiples, 44px each, own y-range ----------
sm=[]
for k,(nm,w,col,key,fill) in enumerate(GROUPS):
    v=G[k]; lo2=min(v); hi2=max(v); pad=(hi2-lo2)*0.12
    Y=yscale(54,lo2-pad,hi2+pad,4,4)
    sm.append({"n":nm,"w":w,"c":col,"f":fill,"path":line(v,Y),"area":line(v,Y)+f" L{X(N-1):.1f} {Y(lo2-pad):.2f} L{X(0):.1f} {Y(lo2-pad):.2f} Z",
      "zero":round(Y(0),1) if lo2-pad<0<hi2+pad else None,
      "last":round(v[-1],1),"lasty":round(Y(v[-1]),1),
      "min":round(lo2,1),"max":round(hi2,1),
      "contrib":round(CONTRIB[k][-1],2)})
out["SM"]=sm
out["latest"]={"h":H[-1],"prev":H[-2],"rural":rural[-1],"urban":urban[-1],
   "resid":round(resid,4),"n":N}
out["raw"]={"H":H,"G":G,"rural":rural,"urban":urban}
json.dump(out,open("panels.json","w"))
print("resid",resid,"N",N)
print("spread range",round(min(spread),2),round(max(spread),2))
print("latest headline",H[-1],"rural",rural[-1],"urban",urban[-1])
for k,(nm,w,c,key,fl) in enumerate(GROUPS):
    print(f"{nm:28s} w={w:5.2f} latest={G[k][-1]:5.2f} contrib={CONTRIB[k][-1]:5.2f} range=({min(G[k]):.1f},{max(G[k]):.1f})")
print("sum contrib", round(sum(CONTRIB[k][-1] for k in range(6)),3))
