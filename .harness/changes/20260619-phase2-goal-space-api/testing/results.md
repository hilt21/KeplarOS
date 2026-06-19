# Testing Results

Change ID: `20260619-phase2-goal-space-api`
Status: testing_complete

## Tests Added Or Updated

- Test: `apps/web/__tests__/api/goal-spaces.test.ts`
  Covers:
  - `POST /api/v1/goal-spaces` — 401 unauthenticated, 403 non-initiator, 400 missing name, 201 success with `node_board_counts` + `card_counts`.
  - `GET /api/v1/goal-spaces` — 401 unauthenticated, 200 paginated list, 400 invalid `page`.
  - `GET /api/v1/goal-spaces/:id` — 200 readable detail, 404 missing, 403 non-member.
  - `PATCH /api/v1/goal-spaces/:id` — 200 initiator updates draft, 409 not-draft, 403 non-initiator.
  - `POST /api/v1/goal-spaces/:id/start` — 200 from draft, 409 already active, 403 non-initiator.
  - `POST /api/v1/goal-spaces/:id/complete` — 200 with summary, 409 `CONFIRMATION_REQUIRED`, 409 `STATE_CONFLICT` (blocked card), 422 `VALIDATION_ERROR` (non-terminal card), 409 `STATE_CONFLICT` (draft state).
  - `POST /api/v1/goal-spaces/:id/cancel` — 200 from active, 200 from draft, 400 missing reason, 400 empty reason, 409 already completed, 403 non-initiator.

- Existing tests exercised:
  - `apps/web/__tests__/state-machine/goal-space.test.ts` — state machine guards.
  - `apps/web/__tests__/audit/run-with-audit.test.ts` — transaction wrapper.
  - `apps/web/__tests__/authorization/goal-space.test.ts` — `canReadGoalSpace` / `canManageGoalSpace` per ADR-001.

## Commands Run

```sh
pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts __tests__/state-machine/goal-space.test.ts __tests__/audit/run-with-audit.test.ts __tests__/authorization/goal-space.test.ts
```

Result: Passed. All F2-03 tests plus the related state machine, audit, and authorization tests are green (414 total in the web package, 27 new in `goal-spaces.test.ts`).

```sh
pnpm check
```

Result: Passed. Typecheck, lint, full Vitest suite, build, and Prettier format check all completed successfully. Environment warnings remain (Node `v25.2.1` vs pinned `20.10.0`).

```sh
git diff --check
```

Result: Passed (no patch hygiene issues).

## Verification Matrix

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| lint | yes | `pnpm check` | passed | Included in root check. |
| typecheck | yes | `pnpm check` | passed | After fixing `AcceptanceCriterion.evidence` (removed `readonly` on the service-side type so the response shape matches the documented spec). |
| unit | yes | targeted goal space / state machine / audit / authorization tests | passed | 414 total tests in the web package. |
| integration | yes | same | passed | API contract tests cover the full request / response / error envelope. |
| api_contract | yes | `goal-spaces.test.ts` + `pnpm check` | passed | All seven endpoints plus the documented error-code matrix. |
| migration | n/a | not run | not_applicable | No schema or migration change in F2-03. |
| smoke | n/a | not run | not_applicable | No UI path added. |
| e2e | n/a | not run | not_applicable | E2E belongs to F2-10. |
| diff_check | yes | `git diff --check` | passed | No patch hygiene issues. |
| startup_path | yes if needed by full check | `pnpm check` | passed_with_environment_warnings | Full Web verification completed. |

## Skipped Or Unavailable Checks

- Check: Exact Node `20.10.0` verification.
  Reason: This machine still runs `v25.2.1`; `.nvmrc` is correct but local runtime parity is not yet restored.
  Risk: Engine warnings remain until the local runtime is corrected.

- Check: Migration / schema verification.
  Reason: F2-03 does not add or modify migrations.
  Risk: None.

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| F2-03 | passed | All 27 new tests pass; the full web test suite remains green. |

## Untested Risks

- Risk: `runWithAudit` does not yet accept a context resolver, so F2-03 pre-generates the goal space UUID before the transaction. A refactor of `runWithAudit` would let the service drop the `randomUUID()` step.
  Reason not covered: Documented as a follow-up; the current approach is correct and the tests cover the behavior.

- Risk: The `list` service does N+1 counts for node boards and cards. Tests do not cover the N>1 case; F2-04 / F2-09 UI work should add a stress test if it materializes a real list page.
  Reason not covered: Documented; the F2-03 plan does not include a list-page UI.

## Follow-Up Test Recommendations

- F2-04 should add tests for the cancel cascade (no `agent_executions` / `human_confirmations` left running) once that behavior is implemented.
- F2-09 should add a Playwright E2E for the goal space list and detail pages.
- Re-run `pnpm check` under a real Node `20.10.0` runtime when the local environment is corrected.

## Sprint Progress Update

Testing is complete. F2-03 is verified and ready for delivery.
