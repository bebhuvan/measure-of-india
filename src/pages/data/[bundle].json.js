// /data/<bundle>.json: every canonical bundle, served as published in data/series.
// The download links in each guide's "Data and downloads" table point here.
import fs from "node:fs";
import {requiredByOwner} from "../../dossiers/everycut.js";
import {governedDownloadResponse} from "../../dossiers/governed-downloads.js";
export function getStaticPaths() {
  return fs.readdirSync("data/series").filter((f) => f.endsWith(".json")).map((f) => ({ params: { bundle: f.replace(/\.json$/, "") } }));
}
export function GET({ params }) {
  const text=fs.readFileSync(`data/series/${params.bundle}.json`,"utf8");
  const governed=governedDownloadResponse(params.bundle,JSON.parse(text),"json",{required:requiredByOwner(params.bundle)});
  return governed||new Response(text,{headers:{"Content-Type":"application/json"}});
}
