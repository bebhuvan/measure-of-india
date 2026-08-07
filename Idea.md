


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

Today, a large amount of useful data exists across government ministries,
statistical agencies, central banks, international institutions, spreadsheets,
PDFs, APIs, and specialist portals. Finding the right series is difficult, but
finding a number is only the beginning. A reader must still determine what it
actually measures, how it was collected, whether it can be compared across
years or places, why another source reports a different value, and what
conclusions the data can and cannot support.

India Atlas will close that interpretation gap by turning important public
statistics into maintained dossiers. Each dossier will connect one statistical
concept, or a small coherent family of concepts, to definitions, methodology,
provenance, historical breaks, caveats, related concepts, and carefully designed
visual explanations. The Atlas will
also provide open, versioned data artifacts wherever source rights permit, so
its work can support education, journalism, research, and the existing This
Indian Life and Hope and Despair projects.

The project succeeds when a curious non-specialist can arrive with a real-world
question, find the relevant indicator, understand what the chart says and does
not say, recognize important uncertainty or discontinuities, and trace every
displayed value back to its original source. It must achieve this without
becoming either a generic dashboard or an editorial operation whose maintenance
burden grows faster than its usefulness.

## 2. Product thesis

India Atlas is not a universal dashboard or a prettier catalogue. Existing
portals already aggregate and visualize large amounts of Indian data. The
underserved problem is interpretation for citizens, students, and educators.

The primary product object is a **dossier**: a reviewed explanation of one
statistical concept or a small, coherent family of concepts, accompanied by one
or more source-specific series, curated chart views, observation-level
provenance, and explicit limits. Indicators remain precise data entities; a
dossier is the public editorial container that makes them understandable
together.

The product promise is not “maximal context for every datapoint.” That promise
is unsustainable and would produce repetitive, low-quality prose. The promise
is:

> Every displayed observation is traceable; every indicator has the context a
> non-specialist needs to interpret it correctly.

### Principles

1. **Depth before breadth.** Three excellent authoritative dossiers are the
   launch threshold; grow toward twelve only after a real update cycle.
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
7. **Statistical meaning determines editorial depth.** Do not impose fixed
   ceilings on the number of dossier views, chapters, family members, headline
   facts or words in an explanation. Use as many as the reader's question and
   the data genuinely require, and remove repetition through editing rather
   than truncation. A numeric limit is acceptable only when it protects a
   specific technical or statistical invariant—such as a renderer constraint,
   payload budget or comparison contract—and must be documented at that local
   boundary. It must never become a proxy for deciding how much explanation a
   subject deserves.