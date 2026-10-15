// src/dossiers/everycut-html.js: one every-cut table row as HTML. The single template for a row:
// src/components/EveryCutTable.astro renders the first rows of a page with it, and the row packs
// (src/pages/ec/[slug]/[view]/[pack].gz.js) carry the rest of the page in the same markup, which
// src/dossiers/everycut.client.js streams into the table. One template, so a streamed row cannot
// differ from a rendered one.
import crypto from "node:crypto";
import { SPARK_W, SPARK_H, everyCutPlan } from "./everycut.js";
import { seriesURL, identity } from "../explore/model.js";

// rows a page renders in its HTML; the rest of the page arrives in its pack
export const SSR_ROWS = 100;
// bump when the row markup changes, so every pack name changes with it
export const ROW_TEMPLATE_VERSION = 1;

const text = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const attr = (k, v) => (v === undefined || v === null || v === false ? "" : ` ${k}="${String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`);
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const num = (v) => (v == null ? "" : String(Math.round(v * 1e4) / 1e4));

/** The anchor id of a page's source-review note for one policy. */
export const policyNotesId = (tableId, q) => tableId + "-policy-" + crypto.createHash("sha256").update(q.id).digest("hex").slice(0, 12);

/**
 * One <tr>, on one line (packs are split on newlines).
 * @param r        a row from everycut.js rowsOf
 * @param i        its place in the page (data-o: the order to restore after a sort)
 * @param o        { filterBy: "cut" | "group", policyNotes: boolean, tableId: string }
 */
export function rowHTML(r, i, { filterBy = "cut", policyNotes = false, tableId }) {
  const facet = (filterBy === "group" ? r.group : r.cut) || "Other";
  const href = text(seriesURL([identity(r.bundle, r.id)]));
  const sub = cap([filterBy === "group" ? r.cut : r.group, r.unitNote, r.base].filter(Boolean).join(", "));
  let ct = text(facet);
  if (r.sourceQuality) ct += `<small>${policyNotes ? `<a href="#${text(policyNotesId(tableId, r.sourceQuality))}">Source review details</a>` : text(r.sourceDefinition) + (r.referenceBasis ? text(` Reference basis: ${r.referenceBasis}`) : "")}</small>`;
  if (r.expected) ct += `<small>${text(r.expectedWindowNote)} ${text(r.expectedMethod)}</small>`;
  const vTitle = r.expected ? r.expectedNote || "Expected source schedule" : r.sourceQuality?.canInterpret === false ? (policyNotes ? r.sourceQuality.status : r.sourceQuality.reason) : r.unavailableReason || (r.estimated ? r.estimatedNote || "An estimate, not a measurement" : undefined);
  const vSmall = text(r.period) + (r.expected ? text(` · Expected schedule; ${r.expectedAsOf}`) : "") + (r.estimated ? ", est." : "") + (r.unavailableReason ? " · Not published" : "") + (r.sourceQuality?.canInterpret === false ? " · Source definition under review" : "");
  const spark = r.spark ? `<svg width="${SPARK_W}" height="${SPARK_H}" viewBox="0 0 ${SPARK_W} ${SPARK_H}" aria-hidden="true">${r.spark.zero != null ? `<line x1="0" x2="${SPARK_W}" y1="${r.spark.zero}" y2="${r.spark.zero}"></line>` : ""}<path d="${text(r.spark.d)}"></path><circle cx="${r.spark.end[0]}" cy="${r.spark.end[1]}" r="1.75"></circle></svg>` : "";
  return `<tr${attr("id", r.id)}${attr("data-o", i)}${attr("data-file", r.bundle)}${attr("data-v", num(r.latest))}${attr("data-c", num(r.change))}>`
    + `<td class="w"><a href="${href}">${text(r.label)}</a><small>${text(sub)}</small></td>`
    + `<td class="ct">${ct}</td>`
    + `<td class="n v"${attr("title", vTitle)}>${text(r.latestText)}<small>${vSmall}</small></td>`
    + `<td class="n c"${attr("title", r.changeEstimated ? "Uses an estimated value" : undefined)}>${text(r.changeText)}${r.changeEstimated ? "<small> est.</small>" : ""}</td>`
    + `<td class="sp">${spark}</td>`
    + `<td class="n"><a href="${href}">Series data</a></td></tr>`;
}

/** A page's streamed rows (those after SSR_ROWS), one per line, and the pack's content name. */
export function packOf(rows, o) {
  const rest = rows.slice(SSR_ROWS);
  if (!rest.length) return null;
  const body = rest.map((r, k) => rowHTML(r, SSR_ROWS + k, o)).join("\n");
  const hash = crypto.createHash("sha256").update(`${ROW_TEMPLATE_VERSION}\0${body}`).digest("hex").slice(0, 12);
  return { body, hash, rows: rest.length };
}

/* ---------- pages and their packs ----------
 * The specs every page and every pack endpoint read, so both render the same rows the same way. */
/** A guide page's inline every-cut table. */
export function inlineSpec(d) {
  const plan = everyCutPlan(d);
  return { view: "inline", n: 0, rows: plan.inlineRows, o: { filterBy: "cut", policyNotes: d.sourcePolicyNotes === "per-page", tableId: `ec-${d.slug}` } };
}
/** Page n of a long-tail view. */
export function tailSpec(d, t, n) {
  if (t.id === "inline") throw new Error(`everycut: a view may not be called "inline" (${d.slug})`);
  const rows = t.pages[n], hasGroups = t.kind === "bundle" && rows.some((r) => r.group);
  return { view: t.id, n, rows, o: { filterBy: hasGroups ? "group" : "cut", policyNotes: d.sourcePolicyNotes === "per-page", tableId: `ec-${t.id}` } };
}
// a page and its pack's endpoint run in one build process: the pack's name is worked out once
const packMemo = new Map();
/** { href, rows } of a spec's pack, or null when the page renders every row. */
export function packLink(slug, spec) {
  const k = `${slug}/${spec.view}/${spec.n}`;
  if (!packMemo.has(k)) { const p = packOf(spec.rows, spec.o); packMemo.set(k, p && { href: `/ec/${slug}/${spec.view}/${spec.n}.${p.hash}.gz`, rows: p.rows }); }
  return packMemo.get(k);
}
