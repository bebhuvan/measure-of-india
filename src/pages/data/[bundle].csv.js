// /data/<bundle>.csv: the same bundle as one wide table, a row per date and a column per
// series. Missing values stay empty, never zero (AGENTS.md rule 2).
import fs from "node:fs";
export function getStaticPaths() {
  return fs.readdirSync("data/series").filter((f) => f.endsWith(".json")).map((f) => ({ params: { bundle: f.replace(/\.json$/, "") } }));
}
const q = (s) => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
export function GET({ params }) {
  const b = JSON.parse(fs.readFileSync(`data/series/${params.bundle}.json`, "utf8"));
  const keys = Object.keys(b.series);
  const head = ["date", ...keys.map((k) => q(b.series[k].label || k))].join(",");
  const rows = b.dates.map((d, i) => [d, ...keys.map((k) => b.series[k].data[i] ?? "")].join(","));
  return new Response([head, ...rows].join("\n") + "\n", { headers: { "Content-Type": "text/csv" } });
}
