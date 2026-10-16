// scripts/fonts-build.mjs: cuts the site's web fonts from the self-hosted originals in fonts/source/
// into public/fonts/, and writes the @font-face rules (src/styles/fonts.generated.css) and the
// file manifest (src/styles/fonts.generated.js) the layout and chart downloads read.
// Run by hand when a font or fonts/primary.txt changes; the outputs are committed, so builds and
// CI never need it.   node scripts/fonts-build.mjs [--check]
//
// Each face is split, never trimmed: every character the originals cover is still covered.
//   primary   the characters the site uses (fonts/primary.txt), from the latin original:
//             the one file nearly every page needs, preloaded
//   extra     the characters of fonts/primary.txt that only the latin-ext original has (₹, †)
//   rest      everything else each original covers, in two files a page loads only if it shows
//             such a character (a name with ő, a rare symbol)
// unicode-range on each rule is the file's actual coverage, so a browser never fetches a file
// for a character the file does not have (the old Golos latin-ext rule claimed ₹; Golos has none).
// Variation axes stay whole: cutting wght to the used range saved about 7% but moved some outlines by
// a font unit at the new axis ends, so it is not done. Self-check: every glyph's outline, drawn at several weights and optical sizes from the new
// file, equals the original's, so the cut cannot change a single rendered shape.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as hb from "harfbuzzjs";
import fontverter from "fontverter";
import subsetFont from "subset-font";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "fonts/source"), OUT = path.join(ROOT, "public/fonts");
const CHECK = process.argv.includes("--check");

const FACES = [
  { id: "serif", family: "Newsreader", style: "normal", weight: [200, 800], latin: "newsreader-normal-latin", ext: "newsreader-normal-latin-ext", preload: true },
  { id: "serif-italic", family: "Newsreader", style: "italic", weight: [200, 800], latin: "newsreader-italic-latin", ext: "newsreader-italic-latin-ext" },
  { id: "sans", family: "Libre Franklin", style: "normal", weight: [100, 900], latin: "libre-franklin-normal-latin", ext: "libre-franklin-normal-latin-ext", preload: true },
];

// fonts/primary.txt: one code point per line as U+XXXX (comments after #); ASCII is always in
const primaryWanted = new Set(Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i));
for (const line of fs.readFileSync(path.join(ROOT, "fonts/primary.txt"), "utf8").split("\n")) {
  const m = line.replace(/#.*/, "").trim().match(/^U\+([0-9A-F]+)$/i);
  if (m) primaryWanted.add(parseInt(m[1], 16));
}

const ttfOf = async (buf) => Buffer.from(await fontverter.convert(buf, "truetype"));
const faceOf = (ttf) => new hb.Face(new hb.Blob(ttf), 0);
const unicodes = (ttf) => new Set(faceOf(ttf).collectUnicodes());
const features = (ttf) => { const f = faceOf(ttf); return [...new Set([...f.getTableFeatureTags("GSUB"), ...f.getTableFeatureTags("GPOS")])]; };
const toRanges = (cps) => {
  const s = [...cps].sort((a, b) => a - b), out = [];
  for (const c of s) { const last = out.at(-1); if (last && c === last[1] + 1) last[1] = c; else out.push([c, c]); }
  return out.map(([a, b]) => (a === b ? `U+${a.toString(16).toUpperCase()}` : `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`)).join(",");
};

// the outline of a code point at some axis settings, as a path string (empty for spaces)
const fonts = new Map();   // one harfbuzz font per file: they live in wasm memory
const outline = (ttf, cp, vars) => {
  let font = fonts.get(ttf);
  if (!font) fonts.set(ttf, (font = new hb.Font(faceOf(ttf))));
  font.setVariations(Object.entries(vars).map(([tag, value]) => new hb.Variation(tag, value)));
  const g = font.nominalGlyph(cp);
  return g ? font.glyphToPath(g) + "|" + font.glyphHAdvance(g) : null;
};

const css = [], manifest = { faces: {} };
const written = new Set();
for (const F of FACES) {
  const latin = await ttfOf(fs.readFileSync(path.join(SRC, F.latin + ".woff2")));
  const ext = await ttfOf(fs.readFileSync(path.join(SRC, F.ext + ".woff2")));
  const L = unicodes(latin), E = unicodes(ext);
  const axes = faceOf(latin).getAxisInfos();
  const parts = [
    { part: "primary", src: latin, cps: [...L].filter((c) => primaryWanted.has(c)) },
    { part: "extra", src: ext, cps: [...E].filter((c) => primaryWanted.has(c) && !L.has(c)) },
    { part: "rest", src: latin, cps: [...L].filter((c) => !primaryWanted.has(c)) },
    { part: "rest-ext", src: ext, cps: [...E].filter((c) => !L.has(c) && !primaryWanted.has(c)) },
  ].filter((p) => p.cps.some((c) => c > 0x20));
  // coverage is preserved: the parts' code points are exactly the originals' union
  const union = new Set(parts.flatMap((p) => p.cps)), orig = new Set([...L, ...E]);
  if (union.size !== orig.size || [...orig].some((c) => !union.has(c))) throw new Error(`${F.id}: split loses coverage`);
  manifest.faces[F.id] = { family: F.family, style: F.style, weight: F.weight.join(" "), files: {} };
  for (const p of parts) {
    const woff2 = await subsetFont(p.src, String.fromCodePoint(...p.cps), { targetFormat: "woff2", keepFeatures: features(p.src) });
    const ttf = await ttfOf(woff2);
    const got = unicodes(ttf);
    const missing = p.cps.filter((c) => !got.has(c));
    if (missing.length) throw new Error(`${F.id}/${p.part}: subset lost ${missing.map((c) => "U+" + c.toString(16)).join(" ")}`);
    // outline identity at the corners and middle of the kept design space
    const opsz = axes.opsz ? [axes.opsz.min, 16, 30, axes.opsz.max] : [null];
    const wghts = [F.weight[0], axes.wght.default, Math.round((F.weight[0] + F.weight[1]) / 2), F.weight[1]];
    let compared = 0;
    for (const c of p.cps) for (const w of wghts) for (const o of opsz) {
      const v = o == null ? { wght: w } : { wght: w, opsz: o };
      if (outline(ttf, c, v) !== outline(p.src, c, v)) throw new Error(`${F.id}/${p.part}: U+${c.toString(16)} differs at ${JSON.stringify(v)}`);
      compared++;
    }
    const hash = crypto.createHash("sha256").update(woff2).digest("hex").slice(0, 10);
    const file = `${F.id}-${p.part}.${hash}.woff2`;
    written.add(file);
    if (!CHECK) fs.writeFileSync(path.join(OUT, file), woff2);
    manifest.faces[F.id].files[p.part] = file;
    css.push(`@font-face{font-family:"${F.family}";font-style:${F.style};font-weight:${F.weight.join(" ")};font-display:swap;src:url("/fonts/${file}") format("woff2");unicode-range:${toRanges(p.cps)}}`);
    console.log(`${file.padEnd(40)} ${String(woff2.length).padStart(7)} B  ${String(p.cps.length).padStart(4)} chars  ${compared} outlines identical`);
  }
  if (F.preload) (manifest.preload ??= []).push(manifest.faces[F.id].files.primary);
}
const cssText = `/* generated by scripts/fonts-build.mjs: do not edit; edit fonts/primary.txt and rerun */\n${css.join("\n")}\n`;
const manText = `// generated by scripts/fonts-build.mjs: the font files the layout preloads and chart downloads embed\nexport default ${JSON.stringify(manifest, null, 1)};\n`;
if (CHECK) {
  const same = fs.readFileSync(path.join(ROOT, "src/styles/fonts.generated.css"), "utf8") === cssText && fs.readFileSync(path.join(ROOT, "src/styles/fonts.generated.js"), "utf8") === manText
    && [...written].every((f) => fs.existsSync(path.join(OUT, f)));
  if (!same) { console.error("fonts-build --check: committed fonts are stale; run node scripts/fonts-build.mjs"); process.exit(1); }
  console.log("fonts-build --check: committed fonts match their sources");
} else {
  fs.writeFileSync(path.join(ROOT, "src/styles/fonts.generated.css"), cssText);
  fs.writeFileSync(path.join(ROOT, "src/styles/fonts.generated.js"), manText);
  // drop superseded generated files (hash-named); never touches anything else
  for (const f of fs.readdirSync(OUT)) if (/^(serif|serif-italic|sans)-(primary|extra|rest|rest-ext)\.[0-9a-f]{10}\.woff2$/.test(f) && !written.has(f)) fs.rmSync(path.join(OUT, f));
}
