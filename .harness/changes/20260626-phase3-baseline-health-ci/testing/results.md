# Testing Results

Change ID: `20260626-phase3-baseline-health-ci`
Status: passed_with_concerns

## Tests Added Or Updated

- None.
  Covers: P3-00 is a baseline formatting/config gate repair with no semantic behavior change.

## Commands Run

```sh
node --version
pnpm --version
pnpm --filter @keplar/web format:check
pnpm --filter @keplar/web exec prettier --write package.json src/components/card-row.tsx src/components/command-input.tsx src/components/connection-status-indicator.tsx src/components/goal-space-list.tsx src/components/left-sidebar.tsx src/components/node-board-view.tsx src/components/right-sidebar.tsx src/components/theme-switcher.tsx src/lib/api/cards.ts src/lib/api/client.ts src/lib/api/confirmations.ts src/lib/api/executions.ts src/lib/api/goal-spaces.ts src/lib/api/node-boards.ts src/lib/keyboard/command-parser.ts src/lib/keyboard/shortcuts.ts src/lib/realtime/replay.ts src/lib/realtime/useSseStream.ts src/lib/state/board-store.ts src/lib/state/ui-store.ts src/lib/theme/themes.ts src/lib/theme/tmTheme.ts
pnpm --filter @keplar/web format:check
pnpm --filter @keplar/web typecheck
pnpm --filter @keplar/web lint
pnpm --filter @keplar/web test
pnpm --filter @keplar/web build
git diff --check
```

Result:

- `node --version`: `v25.2.1`.
- `pnpm --version`: `11.5.1`.
- Initial post-ignore `format:check`: failed on 23 source/config files; generated `test-results/` files were no longer reported.
- Targeted Prettier write: passed for the 23 source/config files.
- Final `format:check`: passed.
- `typecheck`: passed.
- `lint`: passed with 0 errors and 14 warnings.
- `test`: passed, 44 files and 572 tests.
- `build`: passed.
- `git diff --check`: passed.

## Verification Matrix

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| format | yes | `pnpm --filter @keplar/web format:check` | passed | Generated artifacts ignored; source/config files formatted. |
| lint | yes | `pnpm --filter @keplar/web lint` | passed_with_warnings | 0 errors, 14 warnings. |
| typecheck | yes | `pnpm --filter @keplar/web typecheck` | passed | `tsc --noEmit` passed. |
| unit | yes | `pnpm --filter @keplar/web test` | passed_with_warnings | 44 files, 572 tests passed; runtime warnings noted below. |
| build | yes | `pnpm --filter @keplar/web build` | passed_with_warnings | Build passed; Next surfaced existing lint warnings. |
| diff_check | yes | `git diff --check` | passed | No whitespace errors. |
| integration | no | n/a | not_applicable | No behavior or persistence changes. |
| api_contract | no | n/a | not_applicable | No API contract changes. |
| migration | no | n/a | not_applicable | No DB changes. |
| smoke | no | n/a | not_applicable | No runtime behavior changes. |
| e2e | no | n/a | not_applicable | P3-00 does not change browser flows. |

## Recorded Warnings

- Every pnpm command warned that the local engine is unsupported: wanted Node `>=20.10.0 <21.0.0`, current Node `v25.2.1`, pnpm `11.5.1`.
- `lint` passed with 14 warnings:
  - Unused variables/imports in API and UI tests.
  - Missing `appendOutput` dependency in `src/components/goal-space-shell.tsx`.
  - Unused symbols in `src/lib/services/confirmations.ts` and `src/lib/services/goal-spaces.ts`.
- `test` passed but emitted:
  - Vite WebSocket server `listen EPERM: operation not permitted 0.0.0.0:24678`.
  - Repeated Node warnings that `--localstorage-file` was provided without a valid path.
- `build` passed but repeated a subset of the existing lint warnings during Next validation.

## Skipped Or Unavailable Checks

- Check: Exact Node 20 verification.
  Reason: Local runtime is Node v25.2.1; package engine requires `>=20.10.0 <21.0.0`.
  Risk: Results may not exactly match the supported CI/runtime engine. Re-run under Node 20 before treating this as exact release evidence.

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| P3-00 | passed_with_concerns | Required checks passed under Node v25.2.1; exact Node 20 verification unavailable. |

## Untested Risks

- Risk: Node 20-specific behavior.
  Reason not covered: Node 20 runtime was not available in this session.

## Follow-Up Test Recommendations

- Re-run the same required verification list under Node 20.

## Sprint Progress Update

P3-00 is implemented and verified with concerns. `sprint_progress.md` and `feature_list.json` have been updated to reflect the Node engine mismatch and warning-only verification output.
