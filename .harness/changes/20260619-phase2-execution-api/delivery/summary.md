# Delivery Summary

Change ID: `20260619-phase2-execution-api`
Status: delivered

## Change Summary

F2-07 Deterministic AI Lane Executor API is complete. The change adds the two documented execution endpoints (`docs/specs/interface_spec.md § 7`): `POST /cards/:id/execute` for kicking off a fixture execution with one of the six documented AI roles, and `GET /execute/:taskId` for reading the status of a previously-queued execution. The fixture executor is pure and deterministic — given the same card + role, it returns the same structured result with no external I/O. The Backlog Refiner fixture moves backlog cards to `todo` via the `dependencies_ready` trigger. The Review Guard fixture creates a `needs_confirmation` row for high-risk cards.

Every execution lifecycle write is wrapped in `runWithAudit` so the business change, audit entry, and realtime event share a single `better-sqlite3` transaction. Two `runWithAudit` calls per execution: one for the queued insert (`agent_execution.queued`) and one for the terminal update (`agent_execution.{completed|failed|needs_confirmation}`).

The work reuses the F2-02 actor helper, F2-05 card repository, F-003 authorization helpers, F-002 state-machine module, and F-004 `runWithAudit` transaction wrapper. **No new auth, authorization, audit, state-machine, or transaction primitives were introduced.**

## Files Changed

### New

- `apps/web/src/lib/execution/roles.ts` — 6-role registry + `ROLE_ESTIMATED_TIME_SECONDS` constants.
- `apps/web/src/lib/execution/fixture-executor.ts` — deterministic `executeFixture(card, role)` returning tagged union.
- `apps/web/src/lib/db/repositories/executions.ts` — 4 query/write helpers plus 4 types.
- `apps/web/src/lib/services/executions.ts` — 2 transactional services + 5 constants.
- `apps/web/src/app/api/v1/cards/[id]/execute/route.ts` — `POST` execute.
- `apps/web/src/app/api/v1/execute/[taskId]/route.ts` — `GET` status.
- `apps/web/__tests__/api/executions.test.ts` — TDD contract tests (12 tests).

### Modified

- None. F2-07 introduces only new files.

## Verification Performed

- `pnpm --filter @keplar/web test -- __tests__/api/executions.test.ts` — 12 / 12 passed.
- `pnpm --filter @keplar/web test` — 33 files, 511 / 511 passed (baseline 499 + new 12).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## Known Deviations

1. **Two `runWithAudit` calls per execution**: one for queued insert, one for terminal update. Each emits its own realtime event. Documented in `implementation/notes.md`.
2. **Synchronous execution**: the fixture runs inline inside the POST handler. Response shows `status: 'queued'` per spec; the row's actual status is terminal after the synchronous update. Documented.
3. **`Backlog Refiner` uses `dependencies_ready` trigger** (review F1).
4. **`Review Guard` uses `trigger_type: 'high_risk'`** (review F2).

## Recommended Commit Message

```text
feat(api): add deterministic AI lane execution

Implements F2-07: POST /cards/:id/execute (kick off a fixture execution
with one of 6 documented AI roles) and GET /execute/:taskId (read the
status). The fixture executor is pure and synchronous; the service runs
it inline and persists the result inside two runWithAudit calls (queued
insert + terminal update). Reuses canExecuteCard (F-003, with § 5
mandatory gate), assertTransition (F-002, IllegalTransitionError →
STATE_CONFLICT), and the F2-05 card repository (getCardContext,
updateCardState, insertStateTransition). Backlog Refiner fixture moves
backlog cards to todo via dependencies_ready. Review Guard fixture
creates needs_confirmation for high-risk cards via trigger_type
'high_risk'. Pinned agent_execution.queued / completed / failed /
needs_confirmation in AGENT_EXECUTION_REALTIME_EVENTS for F2-08 SSE
filtering.
```