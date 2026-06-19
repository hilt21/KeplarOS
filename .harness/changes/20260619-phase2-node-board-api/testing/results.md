# Testing Results

Change ID: `20260619-phase2-node-board-api`
Status: testing_complete

## Tests Added Or Updated

- Test: `apps/web/__tests__/api/node-boards.test.ts` (NEW, TDD RED-first)
  Covers the six documented endpoints in `docs/specs/interface_spec.md § 3.8`:

  - `GET  /api/v1/goal-spaces/:goalSpaceId/node-boards` — 401 unauthenticated, 200 initiator sees all boards, 200 non-initiator member sees filtered list, 403 actor without access, 404 missing goal space.
  - `POST /api/v1/goal-spaces/:goalSpaceId/node-boards` — 401 unauthenticated, 403 non-initiator, 400 missing `key` / missing `name`, 201 happy path writes audit + realtime, seed members inserted in the same transaction.
  - `GET  /api/v1/node-boards/:id` — 401 unauthenticated, 200 readable board, 404 missing board, 403 cross-goal-space actor.
  - `PATCH /api/v1/node-boards/:id` — 401 unauthenticated, 403 non-initiator, 200 initiator updates, 404 missing board, 422 `VALIDATION_ERROR` invalid status.
  - `POST /api/v1/node-boards/:id/members` — 401 unauthenticated, 403 non-initiator, 400 missing `user_id` / `role`, 422 invalid role, 404 missing board, 201 happy path with audit + realtime.
  - `DELETE /api/v1/node-boards/:id/members/:userId` — 401 unauthenticated, 403 non-initiator, 404 missing board, 204 soft remove with audit + realtime, 204 idempotent re-remove, 204 removing a non-member is also idempotent.
  - Snapshot test pins the four realtime event type constants and the two audit entity types in `apps/web/src/lib/services/node-boards.ts` for F2-08 SSE filtering.
  - Per-lifecycle audit + realtime test group asserts each lifecycle write emits exactly one `audit_entries` row and one `realtime_events` row inside a single `runWithAudit` transaction.

- Existing tests re-exercised:
  - `apps/web/__tests__/authorization/node-board.test.ts` — F-003 authorization helpers (8 tests, all still green).
  - `apps/web/__tests__/api/goal-spaces.test.ts` — F2-03 contract tests (37 tests, all still green).
  - Full web suite — no regressions (414 prior + 37 new = 451 total).

## Commands Run

```sh
pnpm --filter @keplar/web test -- __tests__/api/node-boards.test.ts
```

Result: Passed. All 37 F2-04 contract tests are green.

```sh
pnpm --filter @keplar/web test
```

Result: Passed. 30 test files, 451 tests, no failures. (37 new F2-04 + 414 prior.)

```sh
pnpm check
```

Result: Passed. Typecheck, lint, full Vitest suite, build, and Prettier format check all completed successfully. The only ESLint warning is a pre-existing unused import in `apps/web/src/lib/services/goal-spaces.ts` from F2-03; F2-04 contributes no new warnings. Environment warnings remain (Node `v25.2.1` vs pinned `20.10.0`).

```sh
git diff --check
```

Result: Passed. No patch hygiene issues. All F2-04 changes are in untracked files, so `git diff --check` is empty.

## Verification Matrix

| Check              | Required | Command                                       | Result                          | Notes |
|--------------------|----------|-----------------------------------------------|---------------------------------|-------|
| lint               | yes      | `pnpm check`                                  | passed                          | No new F2-04 warnings. |
| typecheck          | yes      | `pnpm check`                                  | passed                          | `tsc --noEmit` succeeds across the web package. |
| unit               | yes      | targeted F2-04 tests                          | passed                          | 37 / 37 in `node-boards.test.ts`. |
| integration        | yes      | full web suite                                | passed                          | 451 / 451 across 30 files. |
| api_contract       | yes      | `node-boards.test.ts` + `pnpm check`          | passed                          | All 6 endpoints + documented error-code matrix. |
| migration          | n/a      | not run                                       | not_applicable                  | F2-04 adds no migration. |
| smoke              | n/a      | not run                                       | not_applicable                  | UI work belongs to F2-09. |
| e2e                | n/a      | not run                                       | not_applicable                  | E2E belongs to F2-10. |
| diff_check         | yes      | `git diff --check`                            | passed                          | No patch hygiene issues. |
| startup_path       | yes      | `pnpm check`                                  | passed_with_environment_warnings | Full Web verification completed. |

## Skipped Or Unavailable Checks

- Check: Exact Node `20.10.0` verification.
  Reason: This machine still runs `v25.2.1`; `.nvmrc` is correct but local runtime parity is not yet restored.
  Risk: Engine warnings remain until the local runtime is corrected.

- Check: Migration / schema verification.
  Reason: F2-04 does not add or modify migrations. The `node_boards` / `node_board_members` tables, their partial unique indexes, and soft-delete columns are read as defined.
  Risk: None.

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| F2-04     | passed       | All 37 new tests pass; the full web test suite remains green. |

## Untested Risks

- Risk: The `reactivateNodeBoardMember` path is exercised in the repository but the contract test does not assert a previously removed member row is reused (the existing `addNodeBoardMember` happy path is against a fresh insert). The repository explicitly supports re-activation, and a future "remove then re-add" test can pin it.
  Reason not covered: The idempotency contract is the documented primary path; re-activation is a recovery edge case. F2-05+ may add a stress test for the full lifecycle.

- Risk: `listNodeBoardsForGoalSpace` runs the actor's `nodeBoardMembers` distinct query first; for non-initiators with no membership it returns an empty list without hitting the boards query. The test covers the empty case at the route level (200 with `items: []`) and the populated case. A test for "actor with one membership in goal space A, querying goal space B" is not covered at the route level — F2-05 may want to add this when cards are added.
  Reason not covered: Authorization matrix § 4 only requires the membership check; a per-resource negative test would be F2-09 (UI) territory.

## Follow-Up Test Recommendations

- F2-05 (Card API) should add a "previously removed member is re-added" regression test that asserts only one `node_board_members` row exists after the round trip.
- F2-08 (SSE) should import `NODE_BOARD_REALTIME_EVENTS` from `apps/web/src/lib/services/node-boards.ts` rather than hard-coding the names; the snapshot test in `node-boards.test.ts` will catch any drift.
- F2-09 (UI) should add a Playwright happy-path test for node board create + member add + member remove under a real session.
- F2-10 (E2E) should run the full Web verification suite under a real Node `20.10.0` runtime when the local environment is corrected.

## Sprint Progress Update

Testing is complete. F2-04 is verified and ready for delivery.
