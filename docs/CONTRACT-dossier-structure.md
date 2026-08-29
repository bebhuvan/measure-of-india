# CONTRACT-dossier-structure — the normative dossier flow

Every dossier descends from the broad to the granular in the same order.
This contract makes that descent a checklist, not taste. It is family-neutral
(a World Bank dossier follows the same shape as a MoSPI one). It is the
render-side companion to `CONTRACT-render.md` (mechanics) and the output of
`skills/analyze-series.md` (which series feed which section).

## The seven sections, in order

1. **The headline** — the broad number: what it is, what it is NOT, one
   big reading with its policy band or comparison anchor where one exists
   in law. Numbers from the current bundle only; the retired ruler is
   shown faint, never spliced.
2. **Lived reality** — the translation: what this print means for household
   expenses, wages, purchasing power, job stability. Concretely Indian
   (rupees, kilos, commutes). No jargon without immediate plain-language
   repair.
3. **How to read this** — evergreen. What the measure measures, how it is
   produced, its revision policy, its known seams. Human-written; the LLM
   never generates it.
4. **The current reading** — dated, generated prose under the slot system,
   subject to coverage floors (`minSeriesMentioned`, must name the
   extremes, must acknowledge contradictions with the headline). Names the
   period. Contains a plain "we do not know" where the instrument does not.
5. **The anatomy** — the sub-basket cuts the census bucketed as *lead* and
   *show*: composition (divisions/groups/sectors), use-based, sectoral.
   Coordinated small multiples; one plate per part; the weighted average
   must always sit between its parts.
6. **The granular cuts** — geography, gender, items, fractiles, education,
   social group — each with its own read. The item/state tail is
   summarized (counts, median, extremes) even when not plotted. A cut the
   source does not serve is disclosed as absent, not silently omitted.
7. **Misreadings + provenance** — quote/correction pairs specific to this
   instrument, then the provenance footer: every number's path back to the
   source dump.

## Binding rules

- Every section declares its data inputs (bundles + series keys from the
  census) and its prose source (generated slot vs evergreen) in the page
  template. A section with no declared inputs does not ship.
- Section order is fixed. Depth within a section follows statistical
  meaning, not a word or view ceiling (VISION.md principle 7).
- The current reading (§4) is the only LLM-written prose. Everything
  dated elsewhere (plate "As of" paragraphs) is either migrated into the
  slot system or carries its own freshness gate — ungoverned dated prose
  is a defect.
- The coverage floors of §4 are enforced by `pipeline/contract.mjs`; the
  numbers the section may use are enforced by `pipeline/verify.mjs`.
- When two sections would tell the same number's story, the number appears
  once and the second section links the thought — repetition is not
  emphasis.
