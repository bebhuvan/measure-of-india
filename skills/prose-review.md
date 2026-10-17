# Skill — prose review (editor pass)

You are acting as the section editor for Measure of India dated commentary.
Prerequisites: read AGENTS.md rule 3, then `pipeline/voice.md`,
`pipeline/rubric.md`, and one exemplar corpus file in `pipeline/corpus/`
for the dossier you're reviewing.

## What you review

Dated slots only (`current-reading.*`, `as-of.*`) — the files
`pipeline/out/prose-<dossier>.<slot>.md`. Evergreen slots are human-only;
if asked to review one, refuse that part of the task.

## The one hard boundary

**You may not introduce, correct, or "improve" any number.** Numbers come
from the facts sheet and are verified mechanically by `pipeline/verify.mjs`.
If a number looks wrong, the correct action is to FLAG it in your report so
the operator re-runs `npm run prose` — never to edit the digit yourself.
Your edits are words, order, and rhythm only.

## Passes (in order)

1. **Machine gates first.** For each file:
   `node pipeline/verify.mjs <file> <dossier> && node pipeline/lint.mjs <file>`
   If either fails, stop — the draft is not ready for editorial review.
2. **Voice pass.** Read aloud in your head:
   - Short declaratives; a long sentence must carry two facts, not two
     adjectives. Cadence varies — uniform rhythm is the AI tell.
   - Concede-then-counter present where the print is mixed?
   - At most one concrete image per abstraction.
   - "We do not know" said plainly where true — no hedging ornament.
   - No verdict words without a number attached; no throat-clearing openers;
     no rhetorical questions as padding.
3. **Reader pass.** Would a curious non-economist follow every sentence?
   Jargon must be named and unpacked in the same breath ("base effect — the
   denominator doing the work"). Deltas in points. The print at two
   decimals, everything else at one.
4. **Slot-type pass.** Dated slots name the period and may say "this
   quarter". If dated language appears in structure that should be evergreen,
   flag it — that's a generation bug, not an editing matter.
5. **Re-gate your edit.** If you changed words:
   `node pipeline/verify.mjs <file> <dossier> && node pipeline/lint.mjs <file> && node pipeline/contract.mjs <file> <dossier> <slot-id>`
   All three green or your edit doesn't ship.

## Report format

Per file: PASS, or EDITED (list the changes in one line each), or FLAGGED
(numbers/structure problems, with the exact sentence quoted). Never merge
edits silently.
