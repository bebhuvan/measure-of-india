import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  site: "https://atlas.thisindianlife.today",
  integrations: [sitemap()],
  build: { inlineStylesheets: "auto" },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
