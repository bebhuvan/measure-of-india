// /manifest.webmanifest: what the installed app is called, how it opens and what it looks like.
// Name from src/site.js; colours from the :root tokens in src/styles/atlas.css (--bg, the paper the
// masthead sits on), read at build so a palette change moves the app with it; icons from
// scripts/brand.mjs. Shortcuts open the three doors readers use most.
import fs from "node:fs";
import { SITE } from "../site.js";

const root = fs.readFileSync("src/styles/atlas.css", "utf8").match(/:root\{([^}]*)\}/)[1];
const token = (n) => root.match(new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{3,8})`))[1];

export function GET() {
  const bg = token("bg");
  const icon = (src, px, purpose) => ({ src, sizes: `${px}x${px}`, type: "image/png", purpose });
  const manifest = {
    id: "/",
    name: SITE.name,
    short_name: SITE.short,
    description: `${SITE.tagline}: plain-language guides to India's official statistics, with the data to download.`,
    lang: SITE.locale,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: bg,
    background_color: bg,
    categories: ["education", "news", "reference"],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      icon("/icons/icon-192.png", 192, "any"),
      icon("/icons/icon-512.png", 512, "any"),
      icon("/icons/maskable-192.png", 192, "maskable"),
      icon("/icons/maskable-512.png", 512, "maskable"),
    ],
    shortcuts: [
      { name: "Guides", short_name: "Guides", description: "Every guide to India's official statistics", url: "/guides/", icons: [icon("/icons/icon-192.png", 192, "any")] },
      { name: "States and union territories", short_name: "States", description: "A profile of every state and union territory", url: "/states/", icons: [icon("/icons/icon-192.png", 192, "any")] },
      { name: "Search", short_name: "Search", description: "Search guides, charts and series", url: "/#find", icons: [icon("/icons/icon-192.png", 192, "any")] },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 1) + "\n", { headers: { "Content-Type": "application/manifest+json" } });
}
