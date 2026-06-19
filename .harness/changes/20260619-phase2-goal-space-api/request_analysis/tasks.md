# Request Analysis Tasks

Change ID: `20260619-phase2-goal-space-api`
Status: request_analysis

## Implementation Tasks

- [ ] Add `apps/web/src/lib/api/actor.ts` exposing `requireActor(request)` and `requireInitiator(request)`.
  Verify: helpers map to the F2-01 response envelope (401/403 via `apiError`) and reuse `getSessionActor`.

- [ ] Write failing API contract tests in `apps/web/__tests__/api/goal-spaces.test.ts`.
  Verify: `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts` fails before any source change with missing module / route errors.

- [ ] Implement `apps/web/src/lib/db/repositories/goal-spaces.ts` (create, list, getDetail, update, getContext, count helpers).
  Verify: targeted repository tests cover happy and not-found paths.

- [ ] Implement `apps/web/src/lib/services/goal-spaces.ts` (create, start, complete, cancel, update services using `runWithAudit`).
  Verify: services use `assertGoalSpaceTransition` and `runWithAudit`; complete preconditions are gathered inside the same transaction.

- [ ] Implement `apps/web/src/app/api/v1/goal-spaces/route.ts` (`POST` create, `GET` list).
  Verify: route tests assert 201 / 200 envelopes and 401 / 403 / 422 error paths.

- [ ] Implement `apps/web/src/app/api/v1/goal-spaces/[id]/route.ts` (`GET` detail, `PATCH` update).
  Verify: route tests assert detail counts, draft-only update guard, and 404 / 403 / 409 paths.

- [ ] Implement `apps/web/src/app/api/v1/goal-spaces/[id]/start/route.ts` (`POST` start).
  Verify: route tests assert 200 with `StartGoalSpaceResponse` and 409 from any other state.

- [ ] Implement `apps/web/src/app/api/v1/goal-spaces/[id]/complete/route.ts` (`POST` complete).
  Verify: route tests assert 200 with summary, 409 with `CONFIRMATION_REQUIRED`, 409 with `STATE_CONFLICT`, and 422 with `VALIDATION_ERROR` for the three precondition failures.

- [ ] Implement `apps/web/src/app/api/v1/goal-spaces/[id]/cancel/route.ts` (`POST` cancel).
  Verify: route tests assert 200 with summary, 400 on missing reason, 409 from terminal states, and 403 for non-initiator actors.

## Test Tasks

- [ ] RED: run goal space API tests before implementation.
  Verify: `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts` exits non-zero with the expected missing-module failure.

- [ ] GREEN: re-run targeted tests after each route lands.
  Verify: `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts __tests__/state-machine/goal-space.test.ts __tests__/audit/run-with-audit.test.ts` passes.

- [ ] Cover the `complete` precondition matrix in API contract tests.
  Verify: tests assert all three precondition failures (`hasPendingConfirmation`, `hasBlockedCard`, `allCardsDoneOrCancelled`) return the documented error codes and status.

- [ ] Cover `audit_entries` and `realtime_events` write paths.
  Verify: tests assert exactly one audit row and one realtime row per lifecycle write, sharing `goal_space_id` and the documented `type` name.

- [ ] Cover authorization boundaries.
  Verify: tests prove that a chain_user can list but cannot PATCH / start / complete / cancel, and that a non-member cannot read the detail.

- [ ] Run full Web verification.
  Verify: `pnpm check` passes or environment-only warnings are recorded.

- [ ] Run diff hygiene.
  Verify: `git diff --check` passes.

## Documentation Tasks

- [ ] Record F2-03 realtime event type names in `implementation/notes.md`.
  Verify: notes name `goal_space.created`, `goal_space.updated`, `goal_space.started`, `goal_space.completed`, `goal_space.cancelled` for F2-08 SSE filtering.

- [ ] Record the F2-02 follow-up closure for the shared actor helper.
  Verify: notes confirm `apps/web/src/lib/api/actor.ts` is the single new helper and F2-02 routes remain unchanged.

## Sequencing

1. Step: Add `requireActor` / `requireInitiator` helpers and pin their behavior with small unit tests in the route test file.
   Verify: targeted helper tests pass without touching F2-02.
2. Step: Write failing API contract tests for all seven endpoints.
   Verify: targeted test run fails for the right reason.
3. Step: Implement the repository, then the service, then the route handlers, route by route.
   Verify: each route's tests turn green incrementally.
4. Step: Run the full Web verification suite.
   Verify: `pnpm check` passes with environment warnings only.
5. Step: Update `implementation/notes.md`, `testing/results.md`, and `sprint_progress.md`.
   Verify: phase artifacts reflect the final state and any open follow-ups.

## Dependencies

- `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md` — F2-03 plan section.
- `docs/specs/interface_spec.md` — § 3 goal space endpoint contract.
- `docs/specs/authorization_matrix.md` — § 3 / § 4 / § 5 goal space rules.
- `apps/web/src/lib/state-machine/goal-space.ts` — `assertGoalSpaceTransition`, `isGoalSpaceTerminal`, `GoalSpaceStatus`.
- `apps/web/src/lib/authorization/goal-space.ts` — `canReadGoalSpace`, `canManageGoalSpace`.
- `apps/web/src/lib/authorization/types.ts` — `GoalSpaceContext`, `Actor`.
- `apps/web/src/lib/audit/run-with-audit.ts` — `runWithAudit`, `AuditContext`.
- `apps/web/src/lib/api/{response,request,errors,pagination}.ts` — shared API helpers.
- `apps/web/src/lib/auth/session.ts` — `getSessionActor` from F2-02.
- `apps/web/__tests__/api/route-test-harness.ts` — request / response helpers.
- `apps/web/__tests__/__helpers__/sqlite.ts` — in-memory DB + migration loader + fixture.
- `apps/web/db/schema.ts` — `goalSpaces`, `nodeBoards`, `cards`, `users`, `auditEntries`, `realtimeEvents`.
- `apps/web/src/middleware.ts` — cookie / CSRF / origin policy (read-only reference).

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
