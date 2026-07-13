# Handoff

Purpose: recovery snapshot for the next session. Keep it concise. Do not duplicate full sprint progress or full testing results; link or summarize them.

Change ID: `20260713-node25-migration`
Generated At: `2026-07-13`
Status: delivery

## Resume Summary

The Node 25 migration is complete and ready to commit if requested. The runtime pin is `25.2.1`; root and Web engines are constrained to `>=25.0.0 <26.0.0`. No dependency, lockfile, CI-logic, or application-source change was made.

## Approval State

- Request analysis: approved.
- Review: completed; no blocking findings.
- Implementation: completed (F-001).
- Testing: completed with an out-of-scope Prettier exception.
- Delivery: completed.

## Last Known State

- Current phase: delivery complete.
- Current focus: no further work required for the approved migration.
- Last completed artifact: `delivery/summary.md`.

## Remaining Tasks

- None for the approved Node 25 migration.

## Verification Snapshot

| Check | Result | Notes |
|------|--------|-------|
| lint | passed_with_warnings | 25 existing warnings, no errors. |
| typecheck | passed | Ran under Node 25.2.1. |
| unit | passed | 68 files / 706 tests. |
| integration | passed | Covered by existing Vitest suite. |
| api_contract | not_applicable | No API changes. |
| migration | passed | Frozen install without KEPLAR engine warning. |
| smoke | passed | 3 tests. |
| e2e | passed | 4 Playwright tests on full rerun. |

Detailed verification evidence belongs in `testing/results.md`.

## Failed, Skipped, Or Unavailable Verification

- Check: `pnpm format:check` through `pnpm check`.
  Reason: seven pre-existing files outside F-001 fail Prettier.
  Risk: the aggregate `pnpm check` command remains non-green until a separately approved formatting cleanup.

## Blockers

- None for this migration.

## Files Touched

- `.nvmrc`
- `package.json`
- `apps/web/package.json`
- `README.md`
- `docs/CODEMAPS/dependencies.md`
- `.harness/changes/20260713-node25-migration/`

## Exact Next Step

- Commit the scoped migration if the human requests it; otherwise no action is needed.

## Notes For Next Session

- The active goal can be treated as complete; no commit was created.
