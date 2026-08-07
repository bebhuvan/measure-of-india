import math,sys
def unlin(c): return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def lin(c):   return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def oklab_to_srgb(L,a,b):
    l_=L+0.3963377774*a+0.2158037573*b; m_=L-0.1055613458*a-0.0638541728*b
    s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r= 4.0767416621*l-3.3077115913*m+0.2309699292*s
    g=-1.2684380046*l+2.6097574011*m-0.3413193965*s
    bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    return [unlin(max(0,min(1,x))) for x in (r,g,bb)]
def hex_from(L,C,H):
    a=C*math.cos(math.radians(H)); b=C*math.sin(math.radians(H))
    return "#%02X%02X%02X"%tuple(round(x*255) for x in oklab_to_srgb(L,a,b))
def relL(hx):
    r,g,b=[int(hx[i:i+2],16)/255 for i in (1,3,5)]
    r,g,b=lin(r),lin(g),lin(b); return .2126*r+.7152*g+.0722*b
def contrast(a,b):
    la,lb=relL(a),relL(b); hi,lo=max(la,lb),min(la,lb); return (hi+.05)/(lo+.05)
if __name__=="__main__":
    print(",".join(hex_from(*[float(x) for x in t.split(":")]) for t in sys.argv[1:]))
