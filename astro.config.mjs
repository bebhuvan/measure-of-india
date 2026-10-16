import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import fs from "node:fs";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

// Site search is static files under dist/search/, written from the finished pages and the
// bundles once the build is done (scripts/search-index.mjs; budgets in docs/CONTRACT-render.md).
const explorerIndex = {
  name: "atlas-explorer-data",
  hooks: { "astro:build:done": ({ dir }) => {
    execFileSync(process.execPath, [fileURLToPath(new URL("./scripts/explore-pack.mjs", import.meta.url)), fileURLToPath(dir)], { stdio: "inherit" });
  } },
};

const searchIndex = {
  name: "atlas-search-index",
  hooks: {
    "astro:build:done": ({ dir }) => {
      execFileSync(process.execPath, ["--max-old-space-size=8000", fileURLToPath(new URL("./scripts/search-index.mjs", import.meta.url)), fileURLToPath(dir)], { stdio: "inherit" });
    },
  },
};

// Chart kit (src/kit/figure.js): the wide and mid chart drawings a page's placeholders name
// (data-k, a content hash) are written beside the page as kit.json ({ hash: svg }) and fetched by
// src/kit/enhance.js only on screens that show them. A placeholder with no drawing fails the build.
const kitDrawings = {
  name: "atlas-kit-drawings",
  hooks: { "astro:build:done": ({ dir }) => {
    const root = fileURLToPath(dir), ALT = globalThis.__akAlt ?? new Map();
    let files = 0, drawings = 0;
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + "/" + e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) {
        const keys = [...new Set([...fs.readFileSync(p, "utf8").matchAll(/data-(?:k|aksk|csvk)="([0-9a-f]{16})"/g)].map((m) => m[1]))];
        if (!keys.length) continue;
        const missing = keys.filter((k) => !ALT.has(k));
        if (missing.length) throw new Error(`kit: ${p} names ${missing.length} drawings the build never made`);
        const out = e.name === "index.html" ? d + "/kit.json" : p.replace(/\.html$/, ".kit.json");
        fs.writeFileSync(out, JSON.stringify(Object.fromEntries(keys.map((k) => [k, ALT.get(k)])))); files++; drawings += keys.length;
      }
    } };
    walk(root.replace(/\/$/, ""));
    console.log(`kit: ${drawings} drawings and data tables in ${files} kit.json files`);
  } },
};

// Guides lived at /dossiers/<slug>/ before the 2026-10 redesign; old links keep working.
const redirects = Object.fromEntries(DOSSIERS.map((d) => [`/dossiers/${d.slug}`, `/guides/${d.slug}/`]));

export default defineConfig({
  output: "static",
  site: "https://atlas.thisindianlife.today",
  redirects,
  integrations: [sitemap({ filter: (page) => !page.includes("/dossiers/") }), kitDrawings, explorerIndex, searchIndex],
  build: { inlineStylesheets: "auto" },
  vite: {
    plugins: [rawGz],
    // every chart imports Plot by its package name; the site's Plot (src/charts/plot.js) is Plot
    // plus the phone layout for categorical plates (DESIGN.md §0.4). The module imports the real
    // package by path, so the alias does not loop.
    resolve: { alias: [{ find: /^@observablehq\/plot$/, replacement: fileURLToPath(new URL("./src/charts/plot.js", import.meta.url)) }] },
    build: { assetsInlineLimit: 0 },
  },
});
