# Skill — write (or restructure) a dossier

Execute this file top to bottom. Prerequisites: read AGENTS.md and run
`skills/analyze-series.md` first — you do not write a dossier you have not
censused. This skill is the playbook for the two largest hand-written
artifacts per dossier: the PAGE (`src/pages/dossiers/<slug>.astro`) and the
CLIENT module (`src/dossiers/<slug>.client.js`), plus everything that wires
them into the registry, the slots, and the gates.

The binding contracts: `docs/CONTRACT-dossier-structure.md` (section flow),
`docs/CONTRACT-render.md` (page and chart mechanics), `docs/DESIGN.md`
(tokens, typography — elevate, never redesign).

## Step 1 — The skeleton is fixed

Seven sections, in the structure contract's order: headline → lived reality
→ how-to-read → current reading → anatomy → granular cuts → misreadings +
provenance. Declare each section's data inputs (bundle + series keys from
the census) and its prose source (generated slot vs evergreen). Broad first,
granular last; never reorder.

Plates: one `<figure id="cb-<name>">` per plate, with `.plate-head` (title +
sub + `#pv-<name>` value), `.frame` (legend chips, `.plotzone #plot-<name>`,
`.plotfoot` source + downloads), then `.explain` with one `.ev` block
(human-only evergreen, no dates) and one `.now` block (the dated "As of"
reading). The current reading (§4) is the only LLM-written section — every
other dated string is either a data-bound number or the `.now` paragraph.

## Step 2 — Registry entry

Add the dossier to `src/dossiers/registry.js`: identity fields, `calendar`,
`bands` (only where law declares one), `proseConstants` (the verifier's
number whitelist), `spark`, `currentBundle`, `bundles`, `register`, and —
for a prose dossier — `prose: true` plus `proseInputs` (the sibling bundles
the writer must see; facts.mjs summarizes each into the facts sheet and the
coverage gates hold the prose to them).

Do NOT hand-type `dateStamp`/`vintageLabel`: declare `stamp` derivation
styles instead (see `src/dossiers/display.js`). `dateText`/`vintageText` are
allowed only where no bundle fact exists. qc compares every rendered page
stamp against the derivation — a hand-typed string fails the build.

## Step 3 — The client module

- Import bundles as JSON directly; wrap in `hydrate()` from
  `src/charts/plumbing.js`. Never fetch at runtime; never merge bundles.
- Read `src/charts/plumbing.js`'s header FIRST — the chart rules live there:
  Plot ignores function-valued dx/dy/textAnchor (split one text mark per
  side); labels are never struck by rules or connectors (`stripLabelSide`,
  dumbbells labelled outside the dots); `tickFormat` must return strings;
  no smoothing curves (`curve` is a banned word); area washes declare their
  baseline (`y1`).
- Render EVERY displayed number from the baked data — the page has no
  hand-typed figures. Format numbers through the shared renderers
  (`import { fmt } from "../charts/plumbing.js"` → `fmt.pct2`, `fmt.inrR`,
  …): qc renders its expected strings through the same module, so a
  formatter change can never false-fail the gate.
- The `.now` paragraph: date its stamp to the print it describes and write
  only claims the current data supports. It is governed — every block gets a
  `pipeline/asof-manifest.json` entry (`{ "slug#figure-id": { "bundle":
  "<bundle it describes>", "latestDate": "<that bundle's dates.at(-1)>",
  "stamp": "<the As-of text>" } }), and when the bundle advances past
  `latestDate` the gates fail until a human re-reads the paragraph and runs
  `node pipeline/asof.mjs --refresh slug#figure-id`.

## Step 4 — Prose slots (if the dossier has dated commentary)

1. `pipeline/slots.yml`: one entry per dated slot — `id`, `maxSentences`,
   `dateStamp`, `requiredFigures` (paths into the facts sheet), `brief`.
   The `current-reading.what-the-print-says` slot carries the coverage
   floors: `minSeriesMentioned`, `mustName: [extremes]`,
   `mustAcknowledge: [contradictions]`. Set the floor to a real fraction of
   the sheet (CPI: 5 = headline + 4 of 12 divisions), never to whatever the
   first draft happens to hit.
2. If the writer must see sibling bundles, declare them in the registry's
   `proseInputs`.
3. Prove the plumbing: `npm run facts`, then `npm run prose:dry` and READ the
   prompt — the COVERAGE enumeration must name every series and every deep
   cut. Real generation needs `npm run prose` (LLM keys in `.env`).

## Step 5 — Gates are the definition of done

```
npx astro build
npm run gates        # validate + asof + qc + chart lint
npm test
npm run prose:dry    # if slots or facts changed
```

qc refuses a registry dossier with no PAGES entry — add the per-plate id
checks to `scripts/qc.mjs` (title-block numbers, plate values, provenance
vintages), rendering every expected string through `fmt.*`. Add the
asof-manifest entries for every `.now` block. A dossier that is not gated
does not ship; a gate that cannot fail is not a gate.

## Definition of done

- `npm run gates` green with the new dossier's checks inside qc — including
  at least one spot-check per page where a rendered number was traced by
  hand to a `data/raw/` cell, stated in your report.
- The structure contract's seven sections all present, in order, each with
  declared inputs and prose source.
- Every `.now` block governed in the asof manifest; every stamp derived or
  explicitly justified in the registry.
- No commit unless the operator asked.
