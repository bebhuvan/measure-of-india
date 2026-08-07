India produces a voluminous amount of economic data and a lot of it is stuck in random places on different websites, different horribly designed websites, PDFs, so on and so forth. Even to this day, it's very hard to figure out where to get what economic data point and there's the problems suffered by even seasoned observers of the Indian economy, the markets and so on. And this has been a problem that has been nagging at me for a long time. And I figured I might as well do something and that is a genesis of the idea the Indian economic at last so the idea here is Instead of building another website like the World Bank Data portal or R. World in data where we just chart we just show good charts of Economic data points the idea is to create a living economic at-class Instead so we aggregate all the economic financial socio-economic data points in one portal and instead of just creating one indicator the core artifact of this new project is adosir. Instead of just one individual chart, we create an entire page with all the related data points, like for example, CPI and its sub components, weights, sub-indices, et cetera, are all one dossier. And somebody who searches for CPIC is all this entire page with one dossier. The same applies to national accounts, real estate, health, and various other economic data points. The reason for doing this is because Every data point has different stories and those stories are often told by the sub-indices and so on and so forth. And finally, to tie it all, the idea is to leverage the language capabilities of large language models and to create beautiful explanation boxes, both evergreen and current commentary of the current data points and also to primarily create economic, socioeconomic text book of sorts for people to understand what each and every economic data point means. This entire project is aimed towards people who are not academics, people who are not scholars, general people who want to know how life in India is and this is aimed at the broader audiences. So that means the pros, the explanations have to be absolutely simple without being condescending, without being oversimplified at the risk of losing the depth and the nuance. Perhaps more importantly, the goal is not just to explain a particular data point, but the goal is to help people how to read a data point, how not to read a point, explain the common mistakes that people make and help them develop and I have them learn the vocabulary needed to understand a particular socioeconomic data point. And for this, before we start, I want a beautiful design. I said beautiful, absolutely beautiful, gorgeous, minimalist design. I like clean, white space, white backgrounds with contrasting dark backgrounds, soft but lively colors, bright but soft colors. I hate all cliched design patterns especially the design patterns that are so pervasive and common to AI. Like your first instinct will be to create something generic resist. The charts have to look absolutely gorgeous. I'm thinking of using either observable plot or D3JS or some other robust charting library that makes life simple for us. The pros has to be beautifully shown which means rich and absolutely gorgeous typography. The design has to be to be opinionated, elegant with a minimalist code, no distractions, no gradients, no pop-ups, none of that distracting bullshit. All the focus should be on the charts, the visuals, the data and the explanation. Can you help me come up with let's say four different mock styles of different approaches and all of them have to be absolutely stunning and gorgeous.


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