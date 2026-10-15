# Launch cleanup (brief: docs/briefs/launch-cleanup-2026-10-15.md)

Owner: Claude Code session on `launch-build`, main tree. Short dated entries, newest last.

## 2026-10-15

- Started. Tree at 3fa544a plus ~1,530 uncommitted paths (500 modified, 1,033 untracked). Disk 6.9 GB free.
- Scratch moved out of the repo (not deleted) to
  `/home/bhuvanesh.r/Documents/Bhuvan projects/atlas-archive/codex-wave2-2026-10-15/`, paths kept,
  list in its `MANIFEST.txt`: 220 `docs/status` evidence items (259 MB to 0.7 MB left: only the
  per-workstream `.md` logs stay), 25 one-off QA/browser/performance scripts (13 of them loaded
  Playwright from Codex's private runtime), 4 tests that only replayed one-off migrations against
  that evidence (`accepted-artifact-guard`, `performance-browser-ready`, `energy-vintage`,
  `pensions-expected-relocation`), `design-mocks/v4` (unlinked; v5/v6 stay, `docs/DESIGN-v4.md`
  links them), `.github/workflows/deploy-workers.yml.example`, and
  `pipeline/out/facts-energy-editorial.json` (a byte copy of `facts-energy.json`; the two energy
  generators now write only the one file).
- `.gitignore`: `.wrangler/`, `.dev.vars`, `*.tmp`, `.DS_Store`.
- investor-participation parked in `parked/investor-participation/` (README says what moved, what
  stayed dormant, and how to revive). Unregistered from registry, sources and headline; fetch
  product unhooked; `qc.mjs` loads the investor model only when the slug is registered.
- Codex worktrees: all three last touched 12-13 Oct; the main tree carries 15 Oct work. Only
  `ed83` held anything newer: the markets-rbi doc and status-log sections describing the vintage
  and reader-coverage changes that the main tree already applied. Both docs copied in. The
  remaining worktree-only files (logs, a proposal patch, cleanup inspections) are copied to the
  archive's `worktree-salvage/`. Nothing else to salvage. **Owner:** remove them with
  `git worktree remove --force` for `~/.codex/worktrees/{56ae,9dde,ed83}/Economic atlas new Kimi`.
