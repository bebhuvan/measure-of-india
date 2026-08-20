# VISION — why India Atlas exists

*The founding brief, preserved verbatim. It is the north star; when tactics
and this document disagree, this document wins. (Originally `Idea.md`.)*

## 1. Objective

The objective is to make India’s public data **understandable, discoverable,
and trustworthy for people who are not statistical specialists**.

### North star

> **Give any curious person a trustworthy path from a question about how India
> lives to evidence they can understand, interpret and verify—without requiring
> prior statistical training.**

India's public-data problem is not only an absence of observations. A large and
underused body of social, economic, political, cultural and administrative data
already exists, but it is fragmented across difficult portals and files and is
usually separated from the context needed to read it responsibly. India Atlas
exists to provide that missing public interpretation layer: not merely cleaner
downloads or attractive charts, but a clear account of what a measure means,
how it was produced, how its methodology and comparability have changed, what
the evidence does and does not support, and how to trace it to the source.

The north-star reader is an interested non-specialist—a citizen, student,
teacher, worker, journalist or community practitioner—rather than an expert
already equipped to reconstruct the methodology. Success means that reader can
answer a real question about India, explain the relevant measure in ordinary
language, identify its most important limitation or break, and verify the
displayed evidence. The product should increase data literacy through use; it
must never make statistical expertise a prerequisite for entry.

India Atlas closes that interpretation gap by turning important public
statistics into maintained dossiers. Each dossier connects one statistical
concept, or a small coherent family of concepts, to definitions, methodology,
provenance, historical breaks, caveats, related concepts, and carefully designed
visual explanations. The Atlas also provides open, versioned data artifacts
wherever source rights permit, so its work can support education, journalism,
and research.

The project succeeds when a curious non-specialist can arrive with a real-world
question, find the relevant indicator, understand what the chart says and does
not say, recognize important uncertainty or discontinuities, and trace every
displayed value back to its original source. It must achieve this without
becoming either a generic dashboard or an editorial operation whose maintenance
burden grows faster than its usefulness.

## 2. Product thesis

India Atlas is not a universal dashboard or a prettier catalogue. The
underserved problem is interpretation for citizens, students, and educators.

The primary product object is a **dossier**: a reviewed explanation of one
statistical concept or a small, coherent family of concepts, accompanied by one
or more source-specific series, curated chart views, observation-level
provenance, and explicit limits.

The product promise is:

> Every displayed observation is traceable; every indicator has the context a
> non-specialist needs to interpret it correctly.

### Principles

1. **Depth before breadth.** Three excellent authoritative dossiers were the
   launch threshold; growth follows a proven update cycle.
2. **Meaning is reviewed; updates are risk-tiered.** Human judgment is spent on
   definitions, methods, comparisons, caveats, and material changes—not on
   repeatedly approving unchanged prose.
3. **Conflicts remain visible.** Competing estimates are separate series, not
   silently reconciled into a synthetic truth.
4. **Static by default.** The first render is complete HTML and SVG with no
   application runtime.
5. **Open with permission.** Code, Atlas-authored content, and legally
   redistributable artifacts are reusable through stable public contracts.
6. **The system may say “we do not know.”** Missing, stale, incomparable, and
   methodologically broken data are editorial facts, not defects to hide.
7. **Statistical meaning determines editorial depth.** No fixed ceilings on
   views, chapters, or words. A numeric limit is acceptable only when it
   protects a specific technical or statistical invariant—a renderer
   constraint, payload budget or comparison contract—and must be documented at
   that local boundary.

## 3. The expansion clause (added 2026-08)

The vision named "international institutions" as part of the data landscape
from day one. The multi-source expansion (World Bank WDI/Data360, Our World
in Data, and beyond) is the vision maturing, not changing: the dossier remains
the product, the contracts remain the gate, and geography becomes an explicit
dimension of the data model rather than an assumption. See
`docs/ARCHITECTURE.md` for how.
