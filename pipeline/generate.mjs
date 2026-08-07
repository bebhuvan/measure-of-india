#!/usr/bin/env node
// pipeline/generate.mjs — slot-typed prose generation with the full loop:
//   facts sheet → generate → numeric verification → lint → critic → one
//   revision → emit to pipeline/out/prose-<slug>.<slot-id>.md
//
// The model writes ONLY from the facts sheet. Verification and lint are
// scripts, not vibes: an unverified number or an AI-tell is a build failure.
//
// LLM access via env: INDIA_ATLAS_LLM_BASE (OpenAI-compatible), INDIA_ATLAS_LLM_KEY,
// INDIA_ATLAS_LLM_MODEL. Without them, runs as --dry-run: prints the prompts.
//
// Usage: node pipeline/generate.mjs <slug> [--dry-run]

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch {}
const slug = process.argv[2];
const DRY = process.argv.includes("--dry-run") || !process.env.INDIA_ATLAS_LLM_KEY;
if (!slug) { console.error("usage: node pipeline/generate.mjs <slug> [--dry-run]"); process.exit(1); }

const facts = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/out", `facts-${slug}.json`), "utf8"));
const corpus = YAML.parse(fs.readFileSync(path.join(ROOT, "pipeline/corpus", slug + ".yml"), "utf8"));
const slots = YAML.parse(fs.readFileSync(path.join(ROOT, "pipeline/slots.yml"), "utf8"))[slug];
const voice = fs.readFileSync(path.join(ROOT, "pipeline/voice.md"), "utf8");
const rubric = fs.readFileSync(path.join(ROOT, "pipeline/rubric.md"), "utf8");

async function llmOnce(system, user, temperature) {
  const res = await fetch(process.env.INDIA_ATLAS_LLM_BASE + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + process.env.INDIA_ATLAS_LLM_KEY },
    body: JSON.stringify({
      model: process.env.INDIA_ATLAS_LLM_MODEL,
      temperature,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error("LLM API error: " + (json.error.message ?? JSON.stringify(json.error)));
  const choice = json.choices?.[0];
  if (!choice) throw new Error("LLM API returned no choices: " + JSON.stringify(json).slice(0, 400));
  if (choice.finish_reason === "content_filter" || !choice.message?.content) return null;
  return choice.message.content.trim();
}

// a content_filter hit is nondeterministic — resample with jittered
// temperature instead of treating it as a hard failure
async function llm(system, user) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const out = await llmOnce(system, user, 0.3 + attempt * 0.15);
    if (out) return out;
    console.log(`llm: response blocked by content filter, retrying (${attempt + 1}/4)`);
  }
  throw new Error("LLM response blocked by content filter after 4 attempts");
}

function check(file, slotId) {
  try {
    execFileSync("node", [path.join(ROOT, "pipeline/verify.mjs"), file, slug], { stdio: "pipe" });
    execFileSync("node", [path.join(ROOT, "pipeline/lint.mjs"), file], { stdio: "pipe" });
    if (slotId) execFileSync("node", [path.join(ROOT, "pipeline/contract.mjs"), file, slug, slotId], { stdio: "pipe" });
    return null;
  } catch (e) {
    return (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "");
  }
}

const CRITIC_SYS = `You are the critic for India Atlas prose. Score the draft against this rubric:\n${rubric}\nReply with either "PASS" alone, or "REVISE:" followed by the revised draft only. One revision pass, no commentary.`;

for (const slot of slots) {
  const exemplars = (corpus[slot.id.split(".")[0]] ?? []).map((e) => e.text ?? e).slice(0, 3);
  const contract = [
    `Slot: ${slot.id} (dossier: ${slug})`,
    `Type: ${slot.dateStamp ? "dated — must name the period (" + facts.latestPeriod + ")" : "dated commentary"}`,
    `Max sentences: ${slot.maxSentences}`,
    `Required figures (use exactly these, from the facts sheet): ${slot.requiredFigures.join(", ")}`,
    `Brief: ${slot.brief}`,
  ].join("\n");
  const prompt = [
    "VOICE:\n" + voice,
    "EXEMPLARS of this slot type (match them; do not copy them):\n" + exemplars.map((t, i) => `--- exemplar ${i + 1} ---\n${typeof t === "string" ? t : t.text}`).join("\n"),
    "FACTS SHEET (the only numbers you may use):\n" + JSON.stringify(facts, null, 1),
    "CONTRACT:\n" + contract,
    "Write the slot now. Prose only, no headings, no lists.",
  ].join("\n\n");

  const outFile = path.join(ROOT, "pipeline/out", `prose-${slug}.${slot.id}.md`);
  if (DRY) {
    console.log("=== DRY RUN — prompt for", slot.id, "===\n");
    console.log(prompt.slice(0, 1200), "\n…[truncated]\n");
    continue;
  }

  // drafts are staged in .try and only promoted to outFile when every gate
  // passes — a double reject must never clobber a previously emitted file
  const tryFile = outFile + ".try";
  let draft = await llm("You write dated commentary for India Atlas. The corpus is the voice; the facts sheet is the only permitted source of numbers.", prompt);
  fs.writeFileSync(tryFile, draft + "\n");
  let problems = check(tryFile, slot.id);
  if (problems) {
    console.log(`${slot.id}: verification/lint/contract rejected first draft, regenerating with errors attached`);
    draft = await llm("You write dated commentary for India Atlas.", prompt + "\n\nYour previous draft was REJECTED by the verifier:\n" + problems + "\nFix exactly these problems.");
    fs.writeFileSync(tryFile, draft + "\n");
    problems = check(tryFile, slot.id);
    if (problems) {
      console.error(`${slot.id}: REJECTED twice —\n${problems}`);
      fs.rmSync(tryFile, { force: true });
      process.exitCode = 1;
      continue;
    }
  }
  const revised = await llm(CRITIC_SYS, draft);
  if (revised !== "PASS") {
    const candidate = revised.replace(/^REVISE:\s*/i, "");
    fs.writeFileSync(tryFile + ".critic", candidate + "\n");
    if (!check(tryFile + ".critic", slot.id)) fs.renameSync(tryFile + ".critic", tryFile);
    else fs.rmSync(tryFile + ".critic");
  }
  fs.renameSync(tryFile, outFile);
  console.log(`${slot.id}: emitted ${path.relative(ROOT, outFile)}`);
}
if (DRY) console.log("(dry run — set INDIA_ATLAS_LLM_* to generate for real)");
