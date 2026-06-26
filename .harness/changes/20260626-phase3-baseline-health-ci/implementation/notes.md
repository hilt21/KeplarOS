# Implementation Notes

Change ID: `20260626-phase3-baseline-health-ci`
Status: implemented

## Files Changed

- `apps/web/.prettierignore`
- `apps/web/package.json`
- `apps/web/src/components/card-row.tsx`
- `apps/web/src/components/command-input.tsx`
- `apps/web/src/components/connection-status-indicator.tsx`
- `apps/web/src/components/goal-space-list.tsx`
- `apps/web/src/components/left-sidebar.tsx`
- `apps/web/src/components/node-board-view.tsx`
- `apps/web/src/components/right-sidebar.tsx`
- `apps/web/src/components/theme-switcher.tsx`
- `apps/web/src/lib/api/cards.ts`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/confirmations.ts`
- `apps/web/src/lib/api/executions.ts`
- `apps/web/src/lib/api/goal-spaces.ts`
- `apps/web/src/lib/api/node-boards.ts`
- `apps/web/src/lib/keyboard/command-parser.ts`
- `apps/web/src/lib/keyboard/shortcuts.ts`
- `apps/web/src/lib/realtime/replay.ts`
- `apps/web/src/lib/realtime/useSseStream.ts`
- `apps/web/src/lib/state/board-store.ts`
- `apps/web/src/lib/state/ui-store.ts`
- `apps/web/src/lib/theme/themes.ts`
- `apps/web/src/lib/theme/tmTheme.ts`
- `.harness/changes/20260626-phase3-baseline-health-ci/**`

## Implementation Summary

- Updated `apps/web/.prettierignore` to exactly include the requested generated artifact paths:
  - `db/migrations/meta/`
  - `db/dev.db`
  - `test-results/`
  - `playwright-report/`
  - `blob-report/`
  - `playwright/.cache/`
- Ran the repo Prettier through `pnpm --filter @keplar/web exec prettier --write` only on the baseline-reported source/config files.
- Excluded generated `test-results/` files from formatting by ignore rule rather than editing generated output.
- Created and updated P3-00 harness artifacts.

## Deviations From Plan

- Did not run `pnpm check` because the user's required verification list for this implementation pass specified the individual commands instead. Those commands were run after changes.
- Did not commit. The user explicitly prohibited commits.

## Remaining Risks Or Follow-Ups

- Exact Node 20 verification is unavailable locally. Verification ran under Node v25.2.1, while `@keplar/web` requires Node `>=20.10.0 <21.0.0`.
- Lint and build pass but still report pre-existing lint warnings.
- Vitest passes but emits Vite WebSocket bind `EPERM` and repeated `--localstorage-file` warnings under this sandbox/runtime.
