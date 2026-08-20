import math, itertools
from oklch import hex_from, lin, unlin, contrast
M={"protan":[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
   "deutan":[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
   "tritan":[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]]}
def to_lin(h): return [lin(int(h[i:i+2],16)/255) for i in (1,3,5)]
def oklab(rgb_lin):
    r,g,b=rgb_lin
    l=(0.4122214708*r+0.5363325363*g+0.0514459929*b)**(1/3)
    m=(0.2119034982*r+0.6806995451*g+0.1073969566*b)**(1/3)
    s=(0.0883024619*r+0.2817188376*g+0.6299787005*b)**(1/3)
    return (0.2104542553*l+0.7936177850*m-0.0040720468*s,
            1.9779984951*l-2.4285922050*m+0.4505937099*s,
            0.0259040371*l+0.7827717662*m-0.8086757660*s)
def sim(h,kind):
    r=to_lin(h); m=M[kind]
    return [max(0.0,min(1.0,sum(m[i][j]*r[j] for j in range(3)))) for i in range(3)]
def dE(a,b):
    A,B=oklab(a),oklab(b)
    return 100*math.sqrt(sum((A[i]-B[i])**2 for i in range(3)))
def report(pal,label,adjacent=True):
    pairs=list(zip(pal,pal[1:])) if adjacent else list(itertools.combinations(pal,2))
    worst_n=min((dE(to_lin(a),to_lin(b)),a,b) for a,b in pairs)
    worst_c=min(((dE(sim(a,k),sim(b,k)),k,a,b) for a,b in pairs for k in M))
    print(f"{label}: normal ΔE {worst_n[0]:5.1f} ({worst_n[1]}↔{worst_n[2]}) | "
          f"CVD ΔE {worst_c[0]:5.1f} ({worst_c[1]}: {worst_c[2]}↔{worst_c[3]})")
    return worst_n[0],worst_c[0]
