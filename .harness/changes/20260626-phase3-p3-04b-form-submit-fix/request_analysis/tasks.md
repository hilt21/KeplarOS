# Request Analysis Tasks

Change ID: `20260626-phase3-p3-04b-form-submit-fix`
Status: pending_human_approval

## Implementation Tasks

- [ ] Refactor `apps/web/src/components/login-form.tsx` to use `type="button"` + `onClick={handleSubmit}`.
  - Verify: form still has `onSubmit={handleSubmit}`; submit button no longer submits natively; existing focused tests still pass.
- [ ] Apply the same pattern to `apps/web/src/components/create-goal-space-form.tsx`.
  - Verify: same as above.
- [ ] Apply the same pattern to `apps/web/src/components/create-node-board-form.tsx`.
  - Verify: same as above.
- [ ] Optional cleanup: remove redundant `waitForLoadState("load")` + `waitForTimeout(1500)` lines from `apps/web/e2e/phase2-board.spec.ts`.
  - Verify: E2E still passes after cleanup; if it doesn't, keep the waits and document why.

## Test Tasks

- [ ] Run the three focused UI tests via `pnpm --filter @keplar/web test -- src/__tests__/ui/{login-form,create-goal-space-form,create-node-board-form}.test.tsx`.
  - Verify: all 9 tests still pass (3 per file).
- [ ] Run `pnpm --filter @keplar/web test` for the full suite.
  - Verify: 581 tests pass.
- [ ] Run `pnpm --filter @keplar/web e2e`.
  - Verify: 1 passed for the P3-04 happy-path spec.

## Documentation Tasks

- [ ] Create and maintain required harness artifacts.
  - Verify: `request_analysis/{spec.md,tasks.md,feature_list.json}`, `sprint_progress.md`, `review/findings.md`, `implementation/notes.md`, `testing/results.md`, `delivery/summary.md`, `handoff.md`.

## Sequencing

1. Step: Create request analysis and review artifacts.
   Verify: artifacts exist under the P3-04b change folder.
2. Step: Modify the three form files.
   Verify: typecheck/lint pass; focused UI tests still pass.
3. Step: Run `pnpm e2e` against the running dev server.
   Verify: 1 passed; capture command output in `testing/results.md`.
4. Step: Prepare delivery and handoff artifacts.
   Verify: final status, files, risks, and command outcomes are recorded.

## Dependencies

- P3-04 happy-path spec (committed in `1e9d03f`) which depends on these forms submitting reliably in the browser.
- Existing focused unit tests for the three forms (no test changes expected).

## Stop Condition

Stop after Phase 1 Request Analysis artifacts are written. Wait for explicit human approval (e.g., "approved", "执行", "继续实现") before starting Phase 3 Implementation. Do not commit.