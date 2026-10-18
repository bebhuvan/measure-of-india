// Icon files from the one mark (src/brand/mark.js): the SVG favicon, a 32px PNG for browsers that
// want one, the 180px home-screen icon, and the installed app's icons (public/icons/): 192 and 512
// as drawn, and 192 and 512 "maskable", the mark shrunk into the safe circle (the middle 80%) on a
// full indigo ground, so a launcher can crop it to any shape. All on the indigo ground, which holds
// up in a row of tabs and on a home screen.
//   node scripts/brand.mjs        (npm run brand; rerun after any change to the mark)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { markSVG, markBody } from "../src/brand/mark.js";

const PUB = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "public");
const svg = markSVG("indigo");
fs.writeFileSync(path.join(PUB, "favicon.svg"), svg + "\n");
for (const [file, px] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180]]) {
  // rasterise at 8x and scale down, so the thin ruler keeps its weight at 32px
  await sharp(Buffer.from(markSVG("indigo", { size: px * 8 }))).resize(px, px, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(path.join(PUB, file));
}
fs.mkdirSync(path.join(PUB, "icons"), { recursive: true });
// maskable: the mark's corners reach 31.4 units from the centre of its 64-unit box; the safe circle
// is 25.6 units, so the mark is drawn at 0.72 (22.6 units) on an indigo field
const maskable = (px) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${px}" height="${px}"><rect width="64" height="64" fill="#2E4BC4"/><g transform="translate(32 32) scale(0.72) translate(-32 -32)">${markBody("indigo")}</g></svg>`;
for (const px of [192, 512]) {
  await sharp(Buffer.from(markSVG("indigo", { size: px * 4 }))).resize(px, px, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(path.join(PUB, "icons", `icon-${px}.png`));
  await sharp(Buffer.from(maskable(px * 4))).resize(px, px, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(path.join(PUB, "icons", `maskable-${px}.png`));
}
console.log("brand: favicon.svg, favicon-32.png, apple-touch-icon.png and icons/ (192, 512, maskable) written from src/brand/mark.js");
