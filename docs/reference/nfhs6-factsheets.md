# NFHS-6 (2023-24) fact sheets

What the profiles learned about the source, for whoever builds on it next.

## The source

- IIPS and the Ministry of Health and Family Welfare, "National Family Health Survey (NFHS-6)
  2023-2024 Fact Sheets", one PDF of 182 pages:
  `https://www.nfhsiips.in/nfhsuser/assets/National%20Family%20Health%20Survey%20(NFHS-6)%202023-2024%20Fact%20Sheets.pdf`,
  sha256 `59dec561e837bea060b6684a75caca84e0c982ed9e2670848521755f2ab267f9`. The PDF's own
  metadata: created 14 May 2026, modified 27 May 2026. IIPS prints no release date; the bundles'
  vintage is the modification date and `releaseDate` is null.
- MoSPI's eSankhyiki API serves NFHS-4 and NFHS-5 only (checked through the existing adapter,
  `scripts/lib/products/nfhs.mjs`). NFHS-6 is not on it.
- One page pair per geography: India and 35 states and UTs (the merged Dadra and Nagar Haveli
  and Daman and Diu is one unit; Jammu and Kashmir and Ladakh are separate). 101 indicators,
  each urban, rural and total for NFHS-6 and the total for NFHS-5.
- Not in the NFHS-6 fact sheets, though NFHS-5's had them: anaemia, improved sanitation,
  clean cooking fuel, sex ratio at birth and of the population, cancer screening, child
  mortality. The profiles keep those on NFHS-5 (MoSPI) and say so.

## How it reaches the Atlas

- The owner parsed the PDF with their own tool (`~/Documents/Bhuvan projects/Indica doc parse`,
  output `out/nfhs6_clean/nfhs6_indicators.csv`, one row per geography and indicator; native PDF
  text for the 120 born-digital pages, a vision model for the other 62; no estimated values).
- `scripts/lib/products/profiles-nfhs6.mjs` reads that CSV (sources.yml `profiles-nfhs6`, family
  `pdfparse`), archives it with the PDF's sha256 in `data/raw/profiles-nfhs6.json`, and bakes
  `profiles-nfhs6` (NFHS-6, 10,600 series) and `profiles-nfhs6-nfhs5` (the NFHS-5 column the
  fact sheets print, 3,607 series). Two rulers, registered in sources.yml `seams:`.

## Checks, and what they found

- The NFHS-5 column against MoSPI's NFHS-5, matched indicator by indicator by value across
  states: 70 of 101 indicators match, 2,486 of 2,499 state cells agree to the fact sheet's
  rounding. The other indicators are NFHS-6 additions or restated: health insurance, for one,
  is printed for NFHS-5 several points above MoSPI's figure in most states (Bihar 17.4% against
  14.55%), so the fact sheets use a wider definition now. Profiles compare NFHS-6 only with the
  NFHS-5 figure the same fact sheets print.
- Every NFHS-6 total lies between its urban and rural figures (3,405 of 3,405).
- By hand against the PDF, Bihar (pages 43 to 45): stunting 35.6% (NFHS-5 42.9%); health
  insurance 21.5, 21.1 and 21.1 (urban, rural, total); women with a bank account 90.9%; men's
  tobacco use 45.8%. All as baked.

## Quirks

- `*` is a figure suppressed for fewer than 25 unweighted cases (308 cells): not baked, counted
  in `meta.omitted`. A figure in brackets is based on 25 to 49 cases: baked, flagged `caution`.
- Indicators 78 to 83 (blood sugar) and 84 to 89 (blood pressure) are printed under "Women" and
  "Men" sub-headers that the row text does not repeat; 20 to 27 under the family planning
  headers. The adapter restores those words from the printed headers (`CONTEXT`).
- The parse writes CRLF line endings and footnote digits glued to the label ("source1 (%)");
  the adapter strips both.
