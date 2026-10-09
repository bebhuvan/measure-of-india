# Brief: expand the data paths India Atlas shows

Let's figure out how to expand the data paths that we show. Before building anything, take
an inventory of two sources, compare each with what India Atlas already shows, and write a
plan we can tick off one item at a time.

## 1. MoSPI, through its official MCP server (the first goal: finish all MoSPI statistics)

- Server: `https://mcp.mospi.gov.in/` (streamable HTTP, no auth, "MoSPI Data Server").
  Notes on it: `~/Documents/Data/Data bank/docs/MOSPI_SOURCES.md` ("Product inventory and
  MCP server"). Add it to this session with `claude mcp add --transport http mospi
  https://mcp.mospi.gov.in/` if useful, or call it over HTTP directly.
- List every product, dataset, indicator, dimension (state, sector, gender, item...),
  frequency, base year and time span the server exposes.
- Compare with what India Atlas already bakes (`data/sources.yml`, `data/series/*.json`,
  `scripts/lib/products/*.mjs` which use the eSankhyiki API, and `docs/reference/`).
- Result: what we have in full, what we have in part (which cuts are missing), and what we
  do not have at all.

## 2. RBI DBIE, in the local data lake

- `~/Documents/Data/Data bank`: read its `AGENTS.md`, `README.md`,
  `docs/RBI_DBIE_WEBI_RUNBOOK.md`, `docs/RBI_DBIE_SOURCES.md`,
  `docs/RBI_PUBLICATIONS_SOURCES.md`. Use its inventory commands
  (`uv run databank raw rbi-dbie-webi-inventory`, `datasets list`, `query summary ...`)
  to see what is actually held: reports, rows, coverage, freshness, validation status.
- Group the holdings into families (money and banking, interest rates and policy, public
  finance, external sector, banking health, markets and payments, household finance...).
- Compare with what India Atlas shows today (the External account guide uses some RBI data).

## Output

Write `docs/INVENTORY-data-paths.md` in this repo:
- at the top, a short ranked checklist ("[ ] item: what it adds, source, effort"), MoSPI
  first, written so it reads well on a phone;
- then the two inventories in detail, and the gaps.

## Rules

- This is an inventory, not a build. Read, query and write the document. Do not change
  India Atlas code or data, do not run broad downloads or backfills in the Data Bank, do not
  commit or push anything.
- Never print tokens or credentials. Never guess: if something cannot be checked, say so.
- Plain English, sentence case, no em dashes. AGENTS.md in each repo governs.
