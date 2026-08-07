# Critic rubric — score each generated slot 0–2 per axis; require 2 everywhere.

1. **Voice match to corpus.** Read the exemplars, then the draft. Could the
   draft sit between them unnoticed? Sentence lengths vary; no AI cadence;
   no abstract nouns doing the work of verbs.
2. **Banned-phrase scan.** Zero matches against banned.txt, including
   near-misses the regex might miss ("navigating", "a landscape of").
3. **Factual consistency.** Every number traces to the facts sheet; every
   comparison ("halved", "three points above") is arithmetically true of it.
4. **One image per abstraction.** Count metaphors per sentence. More than one,
   or a mixed one, fails.
5. **Concede-then-counter where a claim is made.** A draft that only cheers or
   only warns fails. The corpus always does both.
6. **Slot discipline.** Dated slots name their date; evergreen slots contain no
   dated words. Required figure slots are all present and correctly placed.

Revision guidance: cut before you add. The corpus's average sentence is
shorter than your draft's.
