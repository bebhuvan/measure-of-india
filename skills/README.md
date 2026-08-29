# skills/ — task playbooks for LLM agents (any harness)

These files are tool-agnostic. They work for Claude Code, opencode, Cursor,
Codex, Kimi, GLM, DeepSeek-driven agents, and humans reading them directly.
No harness-specific configuration lives here on purpose: switching models or
tools must never require editing the playbooks.

## How to use

- **If you are an agent told to do one of these tasks:** your operator will
  say something like "read skills/add-source.md and do it". Read the file,
  follow it exactly. The playbooks reference AGENTS.md and docs/ — read those
  sections too when pointed at them.
- **If you are an operator (human):** point your agent at the file. One line
  is enough: `Read AGENTS.md and skills/<name>.md, then execute the task:
  <description>`. If your tool supports project skills directories (e.g.
  `.claude/skills/`, `.opencode/skill/`), symlink or copy the file in rather
  than rewriting it.
- **If you are writing a new skill:** keep it a recipe with exact commands,
  exact gates, and a definition of done that is a command exit code — never
  a vibe. Link to contracts in docs/, never duplicate their content.

## Index

| File | When to use |
|---|---|
| `analyze-series.md` | MANDATORY before touching any dossier's prose/charts/structure: run the census, account for every series |
| `add-source.md` | Adding a new data product (API, CSV dump) end-to-end |
| `write-dossier.md` | Writing or restructuring a dossier page + client module: registry, plates, slots, as-of governance, gates |
| `release.md` | Cutting a release: what to run, what to check, how the PR is made |
| `prose-review.md` | Critiquing dated prose drafts against voice/rubric without inventing numbers |

## Standing rules for every skill execution

1. `npm run gates` green is the exit condition of anything here. If it can't
   be green, say why and stop — do not work around a gate.
2. Never commit unless the operator asked you to.
3. Never edit `data/raw/` by hand.
4. When a playbook and reality disagree, stop and report the disagreement;
   fixing the playbook is part of the task.
