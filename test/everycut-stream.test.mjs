// The every-cut client streams a page's rest from its gzip pack. Hosts differ in how they serve a
// .gz file: Workers static assets send the raw bytes (application/gzip), and a host that adds
// Content-Encoding: gzip has the browser unpack them first. Every row must arrive either way.
import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { JSDOM } from "jsdom";

const SHOWN = 3, TOTAL = 40;
const row = (i) => `<tr id="s${String(i).padStart(7, "0")}" data-o="${i}" data-file="b" data-v="${i}" data-c=""><td class="w"><a href="#">Row ${i}</a><small></small></td><td class="ct">Cut</td><td class="n v">${i}<small></small></td><td class="n c"></td><td class="sp"></td><td class="n"></td></tr>`;
const pack = Array.from({ length: TOTAL - SHOWN }, (_, k) => row(SHOWN + k)).join("\n");

async function streamed(bytes) {
  const dom = new JSDOM(`<div class="ec" data-total="${TOTAL}" data-fold="25" data-pack="/ec/b/v/0.x.gz"><span class="ec-n"></span><table><tbody>${Array.from({ length: SHOWN }, (_, i) => row(i)).join("")}</tbody></table><p class="ec-none" hidden></p></div>`, { url: "https://atlas.test/guides/b/" });
  const keep = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  // one chunk at a time, so the stream is read the way a network delivers it
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 97) c.enqueue(bytes.subarray(i, i + 97)); c.close(); } }));
  try {
    await import(`../src/dossiers/everycut.client.js?${Math.random()}`);
    const root = dom.window.document.querySelector(".ec");
    const done = new Promise((r) => root.addEventListener("ec:complete", r));
    const failed = new Promise((_, no) => setTimeout(() => no(new Error(root.dataset.failed !== undefined ? root.querySelector(".ec-n").textContent : "timed out")), 5000));
    // the page's load starts the stream once the page is idle
    dom.window.dispatchEvent(new dom.window.Event("load"));
    await Promise.race([done, failed]);
    return [...root.querySelectorAll("tbody tr")].map((tr) => +tr.dataset.o);
  } finally {
    Object.assign(globalThis, keep);
  }
}

test("a raw gzip pack and an already-unpacked pack both deliver every row, in order", async () => {
  const want = Array.from({ length: TOTAL }, (_, i) => i);
  assert.deepEqual(await streamed(zlib.gzipSync(pack)), want);
  assert.deepEqual(await streamed(new TextEncoder().encode(pack)), want);
});
