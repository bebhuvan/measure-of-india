// /data/<bundle>.csv: the same bundle as one wide table, a row per date and a column per
// series. Missing values stay empty, never zero (AGENTS.md rule 2).
import fs from "node:fs";
import { getSourceQuality } from "../../explore/source-quality.js";
import { assertExpectedPolicy } from "../../explore/model.js";
import { periodLabel, requiredByOwner } from "../../dossiers/everycut.js";
import {governedDownloadResponse} from "../../dossiers/governed-downloads.js";
import { replayPensionExpectedProofs } from "../../../scripts/lib/pensions-expected-schedule-factory.mjs";
import { expectedScheduleProblem } from "../../../scripts/lib/source-expected-schedule.mjs";
export function getStaticPaths() {
  return fs.readdirSync("data/series").filter((f) => f.endsWith(".json")).map((f) => ({ params: { bundle: f.replace(/\.json$/, "") } }));
}
const q = (s) => /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
export function GET({ params }) {
  const b = JSON.parse(fs.readFileSync(`data/series/${params.bundle}.json`, "utf8"));
  const governed=governedDownloadResponse(params.bundle,b,"csv",{required:requiredByOwner(params.bundle)});
  if(governed)return governed;
  const keys = Object.keys(b.series);
  const sourceNames=b.meta?.csvHeaderMode==='series-name';
  const headers=keys.map(k=>sourceNames?b.series[k].name??b.series[k].label??k:b.series[k].label||k);
  if(sourceNames){
    const normalized=headers.map(h=>typeof h==='string'?h.trim(): '');
    if(normalized.some(h=>!h||h.toLowerCase()==='date')||new Set(normalized).size!==headers.length)
      throw Error(`CSV source-cut headers must be nonempty and unique: ${params.bundle}`);
  }
  const escape=sourceNames?s=>/[",\r\n]/.test(s)?`"${String(s).replace(/"/g,'""')}"`:String(s):q;
  if (b.meta?.observationKind === "expected-schedule") {
    for (const key of keys) assertExpectedPolicy({key,meta:b.meta,quality:getSourceQuality(params.bundle,b,{...b.series[key],key})});
    const proofs = replayPensionExpectedProofs(process.cwd());
    for (const key of keys) {
      const issue = expectedScheduleProblem(b,key,proofs.get(`${params.bundle}:${key}`),params.bundle);
      if (issue) throw Error(`Expected source CSV is unproved: ${issue}`);
    }
    const extra = ["reference_period","observation_kind","forecast_as_of_status","forecast_as_of_date","forecast_method","forecast_window_note",...headers.map(h=>h+"_expected")];
    const columns = ["date",...headers,...extra];
    if (new Set(columns.map(h=>String(h).trim().toLowerCase())).size !== columns.length) throw Error('Expected source CSV headers collide');
    const quote = value => {const text=String(value??"");return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;};
    const rows = b.dates.map((date,i)=>[date,...keys.map(key=>b.series[key].data[i]??""),periodLabel(params.bundle,b,date),b.meta.observationKind,b.meta.forecastAsOfStatus,b.meta.forecastAsOfDate??"",b.meta.note||"",b.meta.forecastWindowNote||"",...keys.map(key=>(b.series[key].expected||[]).includes(date))].map(quote).join(","));
    return new Response([columns.map(quote).join(","),...rows].join("\n")+"\n",{headers:{"Content-Type":"text/csv"}});
  }
  const head = ["date", ...headers.map(escape)].join(",");
  const rows = b.dates.map((d, i) => [d, ...keys.map((k) => b.series[k].data[i] ?? "")].join(","));
  return new Response([head, ...rows].join("\n") + "\n", { headers: { "Content-Type": "text/csv" } });
}
