// src/kit/card.js: the image a chart download makes (PNG and SVG), loaded by src/kit/enhance.js only
// when a reader asks for one, so no page carries this code until then.
import FONTS from "../styles/fonts.generated.js";
import { markBody } from "../brand/mark.js";
import { SITE } from "../site.js";
const SITE_NAME = SITE.name;

// A chart that leaves the site carries its title, subtitle, headline figure, source and its own
// address, in the site's faces and with room around it: what a reader shares should read as a
// finished graphic, not a crop of the page. Always the 720 px drawing (figure.js WIDTHS.mid): its
// text sits at a size that reads in an image at any screen the reader downloaded from. The faces
// travel inside the file (base64 woff2), or the PNG would be drawn in a system sans.
const CARD = { pad: 44, ink: "#15171A", ink2: "#3D4148", muted: "#6B7078", rule: "#E6E7E9", hair: "#15171A", serif: "Newsreader", sans: "Libre Franklin" };
const XML = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let fontCssP = null;
function fontCss() {
  return (fontCssP ??= (async () => {
    const want = [["serif", "primary"], ["serif", "extra"], ["sans", "primary"], ["sans", "extra"], ["sans", "rest"]];
    const rules = await Promise.all(want.filter(([f, p]) => FONTS.faces[f]?.files[p]).map(async ([f, p]) => {
      const face = FONTS.faces[f], buf = new Uint8Array(await fetch("/fonts/" + face.files[p]).then((r) => r.arrayBuffer()));
      let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
      return `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2")}`;
    }));
    return rules.join("");
  })().catch(() => ""));
}
let measureCtx;
const measure = (text, font) => { measureCtx ??= document.createElement("canvas").getContext("2d"); measureCtx.font = font; return measureCtx.measureText(text).width; };
function wrapText(text, width, font) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (!cur || measure(t, font) <= width) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}
// the 720 px drawing of a figure: inline, else from kit.json, else whatever is shown
async function cardDrawing(f, visibleSVG, kit) {
  const mid = f.querySelector(".akf-plot > .akf-mid");
  let svg = mid?.querySelector("svg");
  if (!svg && mid?.dataset.k) { const t = (await kit())[mid.dataset.k]; if (t) svg = new DOMParser().parseFromString(t, "image/svg+xml").documentElement; }
  return (svg ?? visibleSVG(f)).cloneNode(true);
}
export async function standalone(fig, { visibleSVG, kit }) {
  const box = fig.closest("figure") ?? fig;
  // a plate with several drawings (learn port: a level above its rate) downloads them all, stacked
  const svgs = await Promise.all((box === fig ? [fig] : [...box.querySelectorAll(".akf")]).map((f) => cardDrawing(f, visibleSVG, kit)));
  const txt = (sel) => (box.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
  const title = txt(".akf-title, .plate-head h3"), sub = txt(".akf-sub, .plate-head .sub"), src = txt(".akf-src, .plotfoot .src");
  const val = txt(".plate-head .plate-val .v"), valCap = txt(".plate-head .plate-val .c");
  const guide = (document.title.split(" · ")[0] || "").trim();
  const canon = document.querySelector('link[rel="canonical"]')?.href || location.href.split("#")[0];
  const where = (canon.replace(/^https?:\/\//, "").replace(/\/$/, "") + (box.id ? "/#" + box.id : "")).replace("/#", "#");
  await Promise.all([`500 30px "${CARD.serif}"`, `300 34px "${CARD.serif}"`, `600 15px "${CARD.serif}"`, `400 15px "${CARD.sans}"`, `400 12px "${CARD.sans}"`].map((f) => document.fonts?.load(f).catch(() => null)));
  const P = CARD.pad, cw = Math.max(...svgs.map((s) => +s.getAttribute("width"))), W = cw + 2 * P, inner = cw;
  // title block: the headline figure takes a column on the right when the plate has one
  const valW = val ? Math.max(measure(val, `300 34px "${CARD.serif}"`), measure(valCap, `400 12px "${CARD.sans}"`)) + 28 : 0;
  const tW = inner - valW, tF = `500 30px "${CARD.serif}"`, sF = `400 15px "${CARD.sans}"`, fF = `400 12px "${CARD.sans}"`;
  const tL = wrapText(title, tW, tF), sL = sub ? wrapText(sub, tW, sF) : [];
  const urlW = measure(where, `500 12px "${CARD.sans}"`), srcL = src ? wrapText(src, Math.max(240, inner - urlW - 32), fF) : [];
  const parts = []; let y = P;
  // brand row: the mark and the site's name, the guide on the right
  parts.push(`<g transform="translate(${P},${y - 2}) scale(${26 / 64})">${markBody("paper", { frame: false })}</g>`);
  parts.push(`<text x="${P + 34}" y="${y + 18}" font-family="${CARD.serif}" font-weight="600" font-size="17" letter-spacing="-0.1" fill="${CARD.ink}">${XML(SITE_NAME)}</text>`);
  if (guide && guide !== SITE_NAME) parts.push(`<text x="${W - P}" y="${y + 17}" text-anchor="end" font-family="${CARD.sans}" font-weight="600" font-size="11" letter-spacing="1.1" fill="${CARD.muted}">${XML(guide.toUpperCase())}</text>`);
  y += 36; parts.push(`<rect x="${P}" y="${y}" width="${inner}" height="1" fill="${CARD.hair}"/>`); y += 34;
  // title, subtitle, headline figure
  const top = y;
  tL.forEach((l, i) => parts.push(`<text x="${P}" y="${y + 24 + i * 36}" font-family="${CARD.serif}" font-weight="500" font-size="30" letter-spacing="-0.3" fill="${CARD.ink}">${XML(l)}</text>`));
  y += tL.length * 36 + 6;
  sL.forEach((l, i) => parts.push(`<text x="${P}" y="${y + 16 + i * 22}" font-family="${CARD.sans}" font-size="15" fill="${CARD.muted}">${XML(l)}</text>`));
  y += sL.length * 22;
  if (val) {
    parts.push(`<text x="${W - P}" y="${top + 28}" text-anchor="end" font-family="${CARD.serif}" font-weight="300" font-size="34" fill="${CARD.ink}">${XML(val)}</text>`);
    if (valCap) wrapText(valCap, valW - 28, fF).forEach((l, i) => parts.push(`<text x="${W - P}" y="${top + 50 + i * 16}" text-anchor="end" font-family="${CARD.sans}" font-size="12" fill="${CARD.muted}">${XML(l)}</text>`));
  }
  y = Math.max(y, val ? top + 66 : y) + 26;
  // the drawing(s)
  for (const s of svgs) {
    s.querySelectorAll(".ak-hit").forEach((n) => n.remove());
    const h = +s.getAttribute("height");
    parts.push(`<g transform="translate(${P},${y})" font-family="${CARD.sans}">${s.innerHTML}</g>`); y += h + 24;
  }
  // footer: source on the left, the chart's address on the right
  y += 4; parts.push(`<rect x="${P}" y="${y}" width="${inner}" height="1" fill="${CARD.rule}"/>`); y += 22;
  srcL.forEach((l, i) => parts.push(`<text x="${P}" y="${y + i * 17}" font-family="${CARD.sans}" font-size="12" fill="${CARD.muted}">${XML(l)}</text>`));
  parts.push(`<text x="${W - P}" y="${y}" text-anchor="end" font-family="${CARD.sans}" font-weight="500" font-size="12" fill="${CARD.ink2}">${XML(where)}</text>`);
  y += Math.max(1, srcL.length) * 17 + P - 12;
  const H = Math.ceil(y);
  const css = `${await fontCss()}text{font-kerning:normal}.halo{paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}.tab{font-variant-numeric:tabular-nums}`;
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${CARD.sans}"><style>${css}</style><rect width="${W}" height="${H}" fill="#fff"/>${parts.join("")}</svg>`;
  return { text, w: W, h: H };
}
