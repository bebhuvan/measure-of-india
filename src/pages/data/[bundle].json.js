// /data/<bundle>.json: every canonical bundle, served as published in data/series.
// The download links in each guide's "Data and downloads" table point here.
import fs from "node:fs";
export function getStaticPaths() {
  return fs.readdirSync("data/series").filter((f) => f.endsWith(".json")).map((f) => ({ params: { bundle: f.replace(/\.json$/, "") } }));
}
export function GET({ params }) {
  return new Response(fs.readFileSync(`data/series/${params.bundle}.json`, "utf8"), { headers: { "Content-Type": "application/json" } });
}
