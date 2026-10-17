// Icon files from the one mark (src/brand/mark.js): the SVG favicon, a 32px PNG for browsers that
// want one, and the 180px home-screen icon. All on the indigo ground, which holds up in a row of tabs.
//   node scripts/brand.mjs        (npm run brand; rerun after any change to the mark)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { markSVG } from "../src/brand/mark.js";

const PUB = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "public");
const svg = markSVG("indigo");
fs.writeFileSync(path.join(PUB, "favicon.svg"), svg + "\n");
for (const [file, px] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180]]) {
  // rasterise at 8x and scale down, so the thin ruler keeps its weight at 32px
  await sharp(Buffer.from(markSVG("indigo", { size: px * 8 }))).resize(px, px, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(path.join(PUB, file));
}
console.log("brand: favicon.svg, favicon-32.png, apple-touch-icon.png written from src/brand/mark.js");
