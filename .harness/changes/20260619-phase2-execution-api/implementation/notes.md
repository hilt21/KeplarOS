# Implementation Notes

Change ID: `20260619-phase2-execution-api`
Status: implementation_complete

## Files Changed

### New

- `apps/web/src/lib/execution/roles.ts` — `AGENT_ROLE_VALUES` literal union + `AGENT_ROLES` array + `isValidAgentRole` + `ROLE_ESTIMATED_TIME_SECONDS`.
- `apps/web/src/lib/execution/fixture-executor.ts` — deterministic `executeFixture(card, role)` returning a tagged union (`completed | needs_confirmation | failed`).
- `apps/web/src/lib/db/repositories/executions.ts` — query/write helpers (`createAgentExecution`, `updateAgentExecutionResult`, `createHumanConfirmationForExecution`, `getAgentExecutionById`).
- `apps/web/src/lib/services/executions.ts` — 2 transactional services (`createExecutionService`, `getExecutionStatusService`) + `AGENT_EXECUTION_REALTIME_EVENTS` + `AGENT_EXECUTION_AUDIT_ENTITY_TYPE` + `AGENT_EXECUTION_REALTIME_RESOURCE_TYPE` + `HUMAN_CONFIRMATION_CREATED_REALTIME_EVENT` constants.
- `apps/web/src/app/api/v1/cards/[id]/execute/route.ts` — `POST` execute.
- `apps/web/src/app/api/v1/execute/[taskId]/route.ts` — `GET` status.
- `apps/web/__tests__/api/executions.test.ts` — TDD contract test file (12 tests).

### Modified

- None. F2-07 introduces only new files. No F2-02 / F2-03 / F2-04 / F2-05 / F2-06 / F-002 / F-003 / F-004 files were modified.

## Implementation Summary

The implementation followed strict TDD (RED → GREEN → REFACTOR):

1. **RED** — wrote 12 failing contract tests for the 2 documented endpoints, the membership matrix, the fixture executor outputs, the audit + realtime + state_transitions writes, the CONFIRMATION_REQUIRED + STATE_CONFLICT gates, and the realtime event constant snapshot.
2. **GREEN** — implemented the role registry, the deterministic fixture executor (per-role switch statement), the repository helpers, the 2 transactional services (each making 1-2 `runWithAudit` calls per execution), and the 2 route handlers.
3. **REFACTOR** — ran `prettier --write` on the 7 new files, then ran typecheck + lint + 511 tests + format:check and `git diff --check`.

### Reuse Notes

- `requireActor` from F2-02's `apps/web/src/lib/api/actor.ts` is used by every F2-07 route.
- `canExecuteCard` from F-003's `apps/web/src/lib/authorization/execute.ts` is used by the create service. The helper encodes the § 5 mandatory gate.
- `runWithAudit` from F-004's `apps/web/src/lib/audit/run-with-audit.ts` wraps every lifecycle write.
- `getCardContext`, `insertStateTransition`, `updateCardState` from F2-05's repository are reused for card side-effects.
- `isTerminalState` from F-002's state-machine module is used for the terminal-state defensive guard.
- `apiOk`, `apiCreated`, `apiError` from F2-01's `apps/web/src/lib/api/response.ts` is used by every F2-07 route.

## Deviations from Plan

### Two `runWithAudit` calls per execution (review R2)

**Decision:** Each execution uses 2 `runWithAudit` calls: one for the queued insert, one for the terminal update. Each call writes its own audit + realtime.

**Reasoning:** The plan § F2-07 Step 4 says "write realtime event" once. The natural pattern is to emit `agent_execution.queued` when the row is inserted and `agent_execution.{completed|failed|needs_confirmation}` when the row is updated to terminal status. The F-004 wrapper contract is "1 audit + 1 realtime per `runWithAudit` call"; using two calls satisfies this without violating the wrapper.

The trade-off is that the two transactions are not atomic — if the second call fails after the first succeeds, the row is in `queued` status with no terminal update. better-sqlite3 wraps each call in its own `db.transaction`, so this is acceptable for the F2-07 synchronous-execution model. Future S4+ async execution may need to use a single transaction with two inserts.

### Synchronous execution with `status: 'queued'` response (review R7 option b)

**Decision:** The fixture executor runs synchronously inside the POST handler. The response shows `status: 'queued'` per spec § 7.1. The `agent_executions` row's actual `status` is `completed | failed | needs_confirmation` after the synchronous update.

**Reasoning:** The plan § F2-07 Step 3 requires the executor to be deterministic. Asynchronous execution would require a worker queue, which is out of scope for F2-07. The synchronous model keeps the implementation simple and matches the existing F2-04 / F2-05 / F2-06 patterns.

The trade-off is that the response shape doesn't fully reflect the actual row state — the row is already at its terminal status when the response is sent. Subsequent `GET /execute/:taskId` returns the terminal status.

### `Backlog Refiner` uses `dependencies_ready` trigger (review F1)

**Decision:** `Backlog Refiner` fixture outputs `trigger: 'dependencies_ready'` for the `(backlog, todo)` transition.

**Reasoning:** The F-002 convention assigns `dependencies_ready` to Backlog Refiner and `context_complete` to Todo Orchestrator. Both tuples exist in `CARD_TRANSITIONS`. The contract test asserts `Backlog Refiner → dependencies_ready`.

### `Review Guard` uses `trigger_type: 'high_risk'` (review F2)

**Decision:** `Review Guard` on a high-risk card creates a `human_confirmations` row with `trigger_type: 'high_risk'` (the enum literal).

**Reasoning:** `apps/web/db/schema.ts:85-92` defines `CONFIRMATION_TRIGGER_TYPE_VALUES = ['high_risk', ...]`. Using "high risk" (with a space) would fail the schema enum constraint.

## Risks and Follow-Ups

- **R5**: `human_confirmations.expiresAt` is set to `now + 24h`. Future tuning may adjust the TTL.
- **R6**: `trigger = role` for all executions.
- **R7**: Synchronous execution model. Future async migration would need a worker queue.
- **R9**: `needs_confirmation` path skips the card state transition; the card state is changed only when the initiator approves via F2-06.
- **R12**: When the execute service creates a `human_confirmations` row, it does NOT emit a `human_confirmation.created` realtime event. The realtime event is `agent_execution.needs_confirmation` only. F2-09 UI should poll the confirmation list (F2-06's endpoint) or listen for the agent execution event. Documented in handoff.

## Verification Performed

```sh
pnpm --filter @keplar/web test -- __tests__/api/executions.test.ts
# 12 / 12 passed
pnpm --filter @keplar/web test
# 33 files, 511 / 511 passed
pnpm --filter @keplar/web typecheck
# 0 errors
pnpm --filter @keplar/web format:check
# clean
git diff --check
# clean
```

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