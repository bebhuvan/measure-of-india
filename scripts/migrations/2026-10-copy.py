# One-off copy migration for the 2026-10 redesign: reader-visible punctuation only.
#   - em dashes: one in a sentence becomes a colon; two or more become commas
#   - middle-dot strings ("y/y · base 2024") become commas
#   - spaced en-dash ranges ("Jan 2016 – Dec 2025") become "to"
# Touches only text a reader sees: markup text in .astro files (never frontmatter, <script>
# or <style>), string literals in client JS (never comments or code), and prose markdown.
# A bare "—" (the missing-value marker) is never touched: only " — " with spaces both sides.
# Idempotent. Run: python3 scripts/migrations/2026-10-copy.py
import re, glob, sys

def fix_text(t):
    if " — " not in t and " · " not in t and " – " not in t: return t
    t = re.sub(r"(\w[\w.]*) – (\w)", r"\1 to \2", t)          # ranges
    t = t.replace(" · ", ", ")
    if " — " in t:
        parts = re.split(r"(?<=[.!?])\s+", t)                 # sentence by sentence
        out = []
        for p in parts:
            n = p.count(" — ")
            p = p.replace(" — ", ": ", 1) if n == 1 else p.replace(" — ", ", ")
            out.append(p)
        t = " ".join(out) if len(parts) > 1 else out[0]
    return t.replace(",,", ",").replace(": ,", ":")

def astro(src):
    # protect frontmatter, script and style blocks; transform the rest
    m = re.match(r"^---\n.*?\n---\n", src, re.S)
    head, body = (m.group(0), src[m.end():]) if m else ("", src)
    chunks = re.split(r"(<script[\s\S]*?</script>|<style[\s\S]*?</style>)", body)
    for i in range(0, len(chunks), 2):
        # text between tags, and attribute values that readers see (aria-label, title, alt)
        chunks[i] = re.sub(r">([^<]+)<", lambda mm: ">" + fix_text(mm.group(1)) + "<", chunks[i])
        chunks[i] = re.sub(r'((?:aria-label|alt)=")([^"]*)(")', lambda mm: mm.group(1) + fix_text(mm.group(2)) + mm.group(3), chunks[i])
        chunks[i] = re.sub(r'((?:crumbRight|crumbLeft)=\{`)([^`]*)(`\})', lambda mm: mm.group(1) + fix_text(mm.group(2)) + mm.group(3), chunks[i])
    return head + "".join(chunks)

def js(src):
    # walk the source; transform only the contents of string literals
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith("//", i):
            j = src.find("\n", i); j = n if j < 0 else j; out.append(src[i:j]); i = j; continue
        if src.startswith("/*", i):
            j = src.find("*/", i); j = n if j < 0 else j + 2; out.append(src[i:j]); i = j; continue
        if c == "/":                                          # a regex literal, not division
            prev = "".join(out).rstrip()[-1:]
            if prev == "" or prev in "(,=:[!&|?{};+-*%<>~^":
                j, cls = i + 1, False
                while j < n and (cls or src[j] != "/") and src[j] != "\n":
                    if src[j] == "\\": j += 2; continue
                    cls = True if src[j] == "[" else False if src[j] == "]" else cls
                    j += 1
                if j < n and src[j] == "/":
                    out.append(src[i:j + 1]); i = j + 1; continue
        if c in "'\"`":
            j, buf = i + 1, []
            while j < n and src[j] != c:
                if src[j] == "\\": buf.append(src[j:j + 2]); j += 2; continue
                if c == "`" and src.startswith("${", j):          # keep template expressions verbatim
                    depth, k = 1, j + 2
                    while k < n and depth:
                        depth += {"{": 1, "}": -1}.get(src[k], 0); k += 1
                    buf.append("\x00" + src[j:k] + "\x00"); j = k; continue
                buf.append(src[j]); j += 1
            raw = "".join(buf)
            pieces = raw.split("\x00")
            for p in range(0, len(pieces), 2): pieces[p] = fix_text(pieces[p])
            if j >= n:                                        # unterminated: leave the rest untouched
                out.append(src[i:]); break
            out.append(c + "".join(pieces) + c); i = j + 1; continue
        out.append(c); i += 1
    return "".join(out)

files = {"astro": glob.glob("src/pages/**/*.astro", recursive=True) + glob.glob("src/learn/*.astro") + glob.glob("src/layouts/*.astro") + glob.glob("src/components/*.astro"),
         "js": glob.glob("src/dossiers/*.js") + glob.glob("src/learn/*.js") + ["src/charts/plumbing.js", "src/pages/rss.xml.js"],
         "md": glob.glob("pipeline/out/prose-*.md")}
changed = 0
for kind, fl in files.items():
    for f in fl:
        s = open(f).read()
        o = astro(s) if kind == "astro" else js(s) if kind == "js" else fix_text(s)
        if o != s: open(f, "w").write(o); changed += 1
print("files changed:", changed)
