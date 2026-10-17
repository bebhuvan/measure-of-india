// The site's mark: the Newsreader capital M (wght 600, opsz 72, outlined from public/fonts so it needs
// no web font) standing on a ruler, a rule with graduations at both ends and the middle. One drawing,
// two grounds: "paper" (ink M, indigo ruler) in the masthead, "indigo" (white on the site's indigo) for
// the favicon, the home-screen icon and social cards. scripts/brand.mjs writes the icon files from here.
export const M_PATH = "M51.17 40.17 55 41.28V42H39.7V41.28L43.63 40.35L41.58 13.34L41.95 13.4L30.63 42.25H27.23L15.6 13.78L15.97 13.72L14.3 40.41L18.29 41.28V42H9V41.28L12.68 40.41L14.39 12.97L10.4 11.34V10.61H22.26L32.29 35.48L31.6 35.47L41.29 10.61H53.1V11.34L48.93 12.36Z";

const INK = "#15171A", INDIGO = "#2E4BC4", WHITE = "#FFFFFF", RULE = "#D3D6DA";
const RULER_Y = 51, TICKS = [[9, 6], [30.8, 4.5], [52.6, 6]]; // [left x, height]: ends long, middle short

// the inner drawing in a 0 0 64 64 box; ground "paper" | "indigo"; frame draws the hairline square
export function markBody(ground = "indigo", { frame = ground === "paper" } = {}) {
  const fg = ground === "paper" ? INK : WHITE, rule = ground === "paper" ? INDIGO : WHITE;
  const bg = ground === "paper" ? WHITE : INDIGO;
  return `<rect width="64" height="64" fill="${bg}"/>` +
    (frame ? `<rect x="0.5" y="0.5" width="63" height="63" fill="none" stroke="${RULE}"/>` : "") +
    `<path d="${M_PATH}" fill="${fg}"/>` +
    `<rect x="9" y="${RULER_Y}" width="46" height="3" fill="${rule}"/>` +
    TICKS.map(([x, h]) => `<rect x="${x}" y="${RULER_Y - h}" width="2.4" height="${h}" fill="${rule}"/>`).join("");
}

export function markSVG(ground = "indigo", { size, frame, title } = {}) {
  const dims = size ? ` width="${size}" height="${size}"` : "";
  const label = title ? ` role="img" aria-label="${title}"` : ` aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dims}${label} shape-rendering="geometricPrecision">${markBody(ground, { frame })}</svg>`;
}
