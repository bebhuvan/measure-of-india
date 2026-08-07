#!/usr/bin/env node
// pipeline/turing.mjs — the weekly Turing-lint. Shuffle generated prose
// against corpus paragraphs and ask a judge model to separate them. The score
// is the judge's FAILURE rate: 1.0 means the generated prose is
// indistinguishable from the corpus, 0.0 means the judge caught every one.
// Chance is 0.5. Scores append to pipeline/evals/turing-log.jsonl.
// Usage: node pipeline/turing.mjs [--pairs N]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch {}
if (!process.env.INDIA_ATLAS_LLM_KEY) { console.error("turing: INDIA_ATLAS_LLM_* not set — cannot judge"); process.exit(1); }
const PAIRS = Number(process.argv[process.argv.indexOf("--pairs") + 1]) || 8;

// corpus passages: dated slot types only (generated prose is always dated)
const corpusPassages = [];
for (const slug of ["cpi", "gdp"]) {
  const c = YAML.parse(fs.readFileSync(path.join(ROOT, "pipeline/corpus", slug + ".yml"), "utf8"));
  for (const sec of ["current-reading", "as-of"]) {
    for (const e of c[sec] ?? []) corpusPassages.push({ origin: `corpus:${slug}/${e.slot}`, text: e.text.trim() });
  }
}
// generated passages from pipeline/out/
const genPassages = fs.readdirSync(path.join(ROOT, "pipeline/out"))
  .filter((f) => /^prose-.*\.md$/.test(f))
  .map((f) => ({ origin: "generated:" + f.replace(/^prose-|\.md$/g, ""), text: fs.readFileSync(path.join(ROOT, "pipeline/out", f), "utf8").trim() }));

if (!genPassages.length) { console.error("turing: no generated prose in pipeline/out/ — run npm run prose first"); process.exit(1); }

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
const pairs = [];
const gens = shuffle([...genPassages]), corps = shuffle([...corpusPassages]);
for (let i = 0; i < Math.min(PAIRS, gens.length, corps.length); i++) {
  const flip = Math.random() < 0.5;
  pairs.push({ a: flip ? gens[i] : corps[i], b: flip ? corps[i] : gens[i], genFirst: flip });
}

async function llm(system, user) {
  const res = await fetch(process.env.INDIA_ATLAS_LLM_BASE + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + process.env.INDIA_ATLAS_LLM_KEY },
    body: JSON.stringify({
      model: process.env.INDIA_ATLAS_LLM_MODEL,
      temperature: 0,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const json = await res.json();
  return json.choices[0].message.content.trim();
}

const JUDGE_SYS = "You are a detector of machine-written prose. You will be shown two passages from the same publication, on similar subjects. Exactly one was written by a human, the other by a machine imitating that human. Judge by rhythm, specificity, and the fingerprints of machine prose. Reply with exactly one character: 1 or 2, then one sentence of reasoning.";

let caught = 0;
const detail = [];
for (const [i, p] of pairs.entries()) {
  const user = `PASSAGE 1:\n${p.a.text}\n\nPASSAGE 2:\n${p.b.text}\n\nWhich passage is machine-written?`;
  const reply = await llm(JUDGE_SYS, user);
  const guess = reply.trim()[0];
  const genPos = p.genFirst ? "1" : "2";
  const hit = guess === genPos;
  if (hit) caught++;
  detail.push({ pair: i + 1, generated: p[p.genFirst ? "a" : "b"].origin, corpus: p[p.genFirst ? "b" : "a"].origin, judgeCaught: hit, judge: reply.slice(0, 200) });
  console.log(`pair ${i + 1}: judge ${hit ? "CAUGHT" : "missed"} the generated passage (${p[p.genFirst ? "a" : "b"].origin})`);
}

const score = 1 - caught / pairs.length; // judge failure rate — higher is better
const rec = { date: new Date().toISOString().slice(0, 10), pairs: pairs.length, caught, score: Math.round(score * 1000) / 1000, detail };
fs.mkdirSync(path.join(ROOT, "pipeline/evals"), { recursive: true });
fs.appendFileSync(path.join(ROOT, "pipeline/evals/turing-log.jsonl"), JSON.stringify(rec) + "\n");
console.log(`\nturing-lint score: ${score.toFixed(2)} (judge failure rate over ${pairs.length} pairs; 0.5 = chance, 1.0 = indistinguishable)`);
console.log("logged to pipeline/evals/turing-log.jsonl");
