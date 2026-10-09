import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import fs from "node:fs";
import zlib from "node:zlib";
import { DOSSIERS } from "./src/dossiers/registry.js";

// Raw dumps are stored gzipped (data/raw/*.json.gz, scripts/lib/util.mjs). A page that draws on one
// (the learn explainers read the CPI and NAS index levels) imports the .json.gz; this loads it at
// build time as the same JSON module, so nothing gzipped reaches the browser.
const rawGz = {
  name: "atlas-raw-json-gz",
  enforce: "pre",
  load(id) {
    if (!id.endsWith(".json.gz")) return null;
    return `export default ${zlib.gunzipSync(fs.readFileSync(id)).toString("utf8")};`;
  },
};

// Guides lived at /dossiers/<slug>/ before the 2026-10 redesign; old links keep working.
const redirects = Object.fromEntries(DOSSIERS.map((d) => [`/dossiers/${d.slug}`, `/guides/${d.slug}/`]));

export default defineConfig({
  output: "static",
  site: "https://atlas.thisindianlife.today",
  redirects,
  integrations: [sitemap({ filter: (page) => !page.includes("/dossiers/") })],
  build: { inlineStylesheets: "auto" },
  vite: {
    plugins: [rawGz],
    build: { assetsInlineLimit: 0 },
  },
});
