# One-off chart migration for the 2026-10 redesign (house style v3), applied to every Plot chart.
# 1. Text never wears the series colour: inside Plot.text/textX/textY calls, any fill set to the
#    accent, a series colour or a colour variable becomes ink, including either branch of a
#    conditional fill. Lines and dots keep their colours.
# 2. Lead lines are 2px: strokeWidth 2.75/3/3.5/4 -> 2 (the v1 "last 13 periods at 4px" emphasis goes).
# 3. End dots are small: r 5/6 -> 3.5, r 4.5 -> 3.5.
# 4. Chart text is a step smaller and quieter: Plot style fontSize 13-13.5px -> 12px, axis colour grey;
#    text-mark fontSize 14-14.5 -> 12.5, 13-13.5 -> 12.
# Idempotent. Run: python3 scripts/migrations/2026-10-chart-v3.py
import re, glob

INK = '"#161A22"'
def calls(src, names=("Plot.text(", "Plot.textX(", "Plot.textY(")):
    """Yield (start, end) spans of each call, matching brackets outside strings and comments."""
    i = 0
    while True:
        hits = [(src.find(n, i), n) for n in names]
        hits = [h for h in hits if h[0] >= 0]
        if not hits: return
        start, name = min(hits)
        j, depth, stack = start + len(name), 1, []
        while j < len(src) and depth:
            c = src[j]
            if stack and stack[-1] in "'\"":
                if c == "\\": j += 1
                elif c == stack[-1]: stack.pop()
            elif stack and stack[-1] == "`":
                if c == "\\": j += 1
                elif c == "`": stack.pop()
                elif src.startswith("${", j): stack.append("{"); j += 1
            else:
                if c in "'\"`": stack.append(c)
                elif c == "{" and stack: stack.append("{")
                elif c == "}" and stack and stack[-1] == "{": stack.pop()
                elif c == "(": depth += 1
                elif c == ")": depth -= 1
            j += 1
        yield start, j
        i = j

fill_re = re.compile(r'fill:\s*(?:"#2E4BD8"|"#C47A16"|\(?\s*\w*\s*\)?\s*=>\s*[\w.\[\]]*\.color|[\w.\[\]]*\.color\b|ACC\b|ACCENT\b|accent\b|acc\b|col\b)')
fs_re = re.compile(r'fontSize:\s*(14\.5|14|13\.5|13)\b')
FS = {"14.5": "12.5", "14": "12.5", "13.5": "12", "13": "12"}
files = glob.glob("src/dossiers/*.client.js") + glob.glob("src/learn/*.client.js") + ["src/charts/plumbing.js"]
tot = {"text-fill": 0, "text-size": 0, "stroke": 0, "dot": 0, "style": 0}
for f in files:
    s = open(f).read(); o = s
    out, last = [], 0
    for a, b in calls(s):
        seg = s[a:b]
        seg2, n1 = fill_re.subn("fill: " + INK, seg)
        seg2, n2 = fs_re.subn(lambda m: "fontSize: " + FS[m.group(1)], seg2)
        # conditional fills ("d.v > 6 ? accent : grey"): the emphasised branch becomes ink, so emphasis
        # in text comes from darkness, never from the series colour
        seg2, n3 = re.subn(r'"#2E4BD8"|"#C47A16"', INK, seg2); n1 += n3
        tot["text-fill"] += n1; tot["text-size"] += n2
        out.append(s[last:a]); out.append(seg2); last = b
    out.append(s[last:]); s = "".join(out)
    s, n = re.subn(r'strokeWidth:\s*(2\.75|3\.5|3|4)\b(?!\.)', "strokeWidth: 2", s); tot["stroke"] += n
    s, n = re.subn(r'leadWidth \?\? 3\b', "leadWidth ?? 2", s); tot["stroke"] += n
    s, n = re.subn(r'\br:\s*(6|5|4\.5)\b(?!\.)', "r: 3.5", s); tot["dot"] += n
    s, n = re.subn(r'fontSize:\s*"1[34](\.5)?px"', 'fontSize: "12px"', s); tot["style"] += n
    s, n = re.subn(r'(style:\s*\{[^}]*?color:\s*)"#5F6675"', r'\1"#878D99"', s); tot["style"] += n
    if s != o: open(f, "w").write(s)
print(tot)
