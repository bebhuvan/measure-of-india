import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { DOSSIERS } from "./src/dossiers/registry.js";

// Guides lived at /dossiers/<slug>/ before the 2026-10 redesign; old links keep working.
const redirects = Object.fromEntries(DOSSIERS.map((d) => [`/dossiers/${d.slug}`, `/guides/${d.slug}/`]));

export default defineConfig({
  output: "static",
  site: "https://atlas.thisindianlife.today",
  redirects,
  integrations: [sitemap({ filter: (page) => !page.includes("/dossiers/") })],
  build: { inlineStylesheets: "auto" },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
