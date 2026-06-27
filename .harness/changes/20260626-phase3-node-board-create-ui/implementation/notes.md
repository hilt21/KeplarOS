# Implementation Notes

Change ID: `20260626-phase3-node-board-create-ui`
Phase: 3 — Implementation
Author: Application Owner (TDD)

## Files Touched

| Path | Change |
|------|--------|
| `apps/web/src/components/create-node-board-form.tsx` | **new** — client component `CreateNodeBoardForm({ goalSpaceId })` |
| `apps/web/src/__tests__/ui/create-node-board-form.test.tsx` | **new** — Vitest + Testing Library + jest-dom |
| `apps/web/src/components/goal-space-shell.tsx` | **modified** — added `CreateNodeBoardForm` import (line 21) and mounted it via `EmptyState.action` in the `boards.length === 0` branch (lines 320–325) |

No other application files were touched. No backend, API, DB, schema, migration, or authorization files were touched.

## TDD Sequence (Actual)

1. **RED** — added `apps/web/src/__tests__/ui/create-node-board-form.test.tsx` (3 tests). Ran `pnpm --filter @keplar/web test -- src/__tests__/ui/create-node-board-form.test.tsx` → failed with `Failed to resolve import "@/components/create-node-board-form"`. Confirmed RED.
2. **GREEN** — implemented `apps/web/src/components/create-node-board-form.tsx`. Re-ran focused test → 581 tests pass (3 new + 578 pre-existing). Confirmed GREEN.
3. **IMPROVE** — modified `goal-space-shell.tsx` to mount the form. Mount shape uses the existing `EmptyState` `action` prop (verified `apps/web/src/components/empty-state.tsx` accepts optional `action?: ReactNode`). No other shell code changed.

## Deviations From Spec

- None. Spec called for a 3-column grid (`Board key | Board name | Description | submit`); implementation matches.
- Spec called for `description` to be a string (may be empty); implementation uses an `<input type="text">` rather than `<textarea>` for compact dashboard consistency with the P3-02 `CreateGoalSpaceForm`. The acceptance criterion "Request body includes `key`, `name`, and `description` strings (description may be empty string)" is satisfied either way.
- Spec acceptance criterion for `bg-[var(--color-bg)]` vs `bg-[var(--color-surface)]` token usage (Finding 1 in `review/findings.md`) was applied: form uses `--color-surface` for the container and `--color-bg` for the input fields, matching P3-02 visual structure.

## Risks Materialized

- None. The pre-existing `goal-space-shell.tsx:177` lint warning (`appendOutput` missing dep) is unchanged and predates P3-03.

## Verification Already Performed

- `pnpm --filter @keplar/web typecheck` → 0 errors (Node engine warning is pre-existing environment).
- `pnpm --filter @keplar/web lint` → 0 errors; 14 warnings, all pre-existing in unrelated files.
- `pnpm --filter @keplar/web test` → 47 files / 581 tests pass.
- `pnpm --filter @keplar/web build` → succeeded.
- `pnpm --filter @keplar/web format:check` → all matched files use Prettier code style (after `prettier --write` on the two new files).
- `git diff --check` → no whitespace errors.

Detailed outcomes are recorded in `testing/results.md`.

## Unresolved Items

- None.