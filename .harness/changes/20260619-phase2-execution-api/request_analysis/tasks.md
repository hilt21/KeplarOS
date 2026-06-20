# F2-07 Deterministic AI Lane Executor API — Implementation Tasks

Change ID: `20260619-phase2-execution-api`
Status: request_analysis

## Conventions

- Strict TDD: every task begins with a failing test, then minimal GREEN implementation, then REFACTOR.
- Tests live alongside the F2-04 / F2-05 / F2-06 pattern: `apps/web/__tests__/api/executions.test.ts` with inline `queueSelectResults`, `captureMutations`, `makeTxHarness`, `expectAuditCall`, `expectRealtimeCall`.
- All routes use `apps/web/src/lib/api/actor.ts` `requireActor`.
- All services use F-002 state machine + F-003 authorization helpers + F-004 `runWithAudit`.
- Realtime event type names are exported as constants from `apps/web/src/lib/services/executions.ts`.

---

## T1. Role registry (READ)

**RED** — write a unit test that imports `AGENT_ROLES` and asserts the exact 6 documented role names.

**GREEN** — implement in `apps/web/src/lib/execution/roles.ts`:

- `AGENT_ROLE_VALUES` literal union (matches `interface_spec.md § 7.1`).
- `AGENT_ROLES` array of 6 role names.
- `isValidAgentRole(value: unknown): value is AgentRole`.

**REFACTOR** — none.

## T2. Fixture executor (READ)

**RED** — write a unit test for each role's expected output:
- `Backlog Refiner` on a `backlog` card → `{ status: 'completed', new_state: 'todo', confidence: 0.85, message: '...' }`.
- `Review Guard` on a `riskLevel: 'high'` card → `{ status: 'needs_confirmation', target_state: 'done', trigger_type: 'high_risk', confidence: 0.6 }`.
- `Dev Crafter` on a `dev` card → `{ status: 'completed', new_state: 'review', confidence: 0.8 }`.
- Any role on a terminal-state card → `{ status: 'failed', error: { code: 'INVALID_STATE', message: '...' } }`.
- Any role on an unexpected from-state → `{ status: 'failed', error: { code: 'UNSUPPORTED_TRANSITION', message: '...' } }`.

**GREEN** — implement in `apps/web/src/lib/execution/fixture-executor.ts`:

- `executeFixture(card, role, nowMs)` → `FixtureExecutionResult`.
- Switch statement on `role` returning a structured result.
- The executor is pure and synchronous (no I/O).

**REFACTOR** — extract per-role handlers into named functions.

## T3. Repository helpers — execution write paths

**RED** — write a service-level test for `createExecutionService(...)` and watch it fail.

**GREEN** — implement in `apps/web/src/lib/db/repositories/executions.ts`:

- `createAgentExecution(tx, input)` — inserts a `queued` row.
- `getAgentExecutionById(db, id)` — single-row select.
- `updateAgentExecutionResult(tx, id, result)` — updates `status`, `result`, `errorCode`, `errorMessage`, `durationMs`, `completedAt`.
- `createHumanConfirmationForExecution(tx, input)` — inserts a `human_confirmations` row with `triggerType`, `targetState`, etc.

**REFACTOR** — split helpers into <50-line functions.

## T4. Service: create execution

**RED** — write service-level tests for the POST handler.

**GREEN** — `createExecutionService(cardId, input, actor)`:
- Loads card context via `getCardContext` (reuses F2-05). Returns NOT_FOUND if missing.
- Validates `role` is in `AGENT_ROLE_VALUES`. Returns VALIDATION_ERROR (422) otherwise.
- Checks `canExecuteCard(actor, { card, hasPendingConfirmation, currentState })`. Returns FORBIDDEN if false; CONFIRMATION_REQUIRED if `hasPendingConfirmation` is true; STATE_CONFLICT if `currentState` is terminal.
- Calls the fixture executor synchronously to get the result.
- Wraps the persistence + audit + realtime in `runWithAudit`:
  - Insert `agent_executions` row.
  - If result is `needs_confirmation`: insert `human_confirmations` row.
  - If result is `completed` with `new_state`: update card + insert `state_transitions` row.
  - Update `agent_executions` to terminal status.
  - Audit + realtime.
- Returns the new `ExecuteCardResponse` with `task_id`, `status: 'queued'` (per spec; the GET endpoint shows the terminal status).

**REFACTOR** — extract apply-result helper.

## T5. Service: get execution status

**RED** — write service-level tests.

**GREEN** — `getExecutionStatusService(taskId, actor)`:
- Loads execution by id. Returns NOT_FOUND if missing.
- Loads card context for the execution. Returns NOT_FOUND if card is missing.
- Checks `canReadCard(actor, ctx)`. Returns FORBIDDEN otherwise.
- Maps the execution to `ExecuteStatusResponse`.

**REFACTOR** — extract mapper.

## T6. Route handlers (2 files)

**RED-first** — write handler tests first.

**GREEN** — implement each route:

- `apps/web/src/app/api/v1/cards/[id]/execute/route.ts` — `POST` execute.
- `apps/web/src/app/api/v1/execute/[taskId]/route.ts` — `GET` status.

**REFACTOR** — share the standard try/catch boilerplate.

## T7. Realtime event constants + snapshot test

**RED** — snapshot test asserts the documented event type strings.

**GREEN** — export `AGENT_EXECUTION_REALTIME_EVENTS` and `AGENT_EXECUTION_AUDIT_ENTITY_TYPE` from `apps/web/src/lib/services/executions.ts`.

**REFACTOR** — none.

## T8. Contract tests file

**RED-then-GREEN** — write the full test file covering:
- 401 without session for both endpoints.
- 422 for invalid role.
- 403 for viewer on POST.
- 404 for missing card / task_id.
- 409 STATE_CONFLICT for terminal-state card on POST.
- 409 CONFIRMATION_REQUIRED for pending confirmation on POST.
- 202 happy path: Backlog Refiner on backlog card → task_id returned.
- 200 on GET: status reflects the queued-then-completed lifecycle.
- 403 for non-member on GET.
- Backlog Refiner applies state transition (state_transitions row written).
- Review Guard creates needs_confirmation (human_confirmations row written).
- Failed execution records error and emits failed realtime event.
- Audit + realtime capture assertions per lifecycle write.

**REFACTOR** — extract helpers if repeated 3+ times.

## T9. Verification

- `pnpm --filter @keplar/web test -- __tests__/api/executions.test.ts` — green.
- `pnpm --filter @keplar/web test -- __tests__/authorization/execute.test.ts __tests__/authorization/execute-db.test.ts` — green.
- `pnpm --filter @keplar/web test` — full web suite stays green (499 + new tests).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web lint` — 0 errors (no new F2-07 warnings).
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## T10. Delivery artifacts

- `.harness/changes/20260619-phase2-execution-api/implementation/notes.md`
- `.harness/changes/20260619-phase2-execution-api/testing/results.md`
- `.harness/changes/20260619-phase2-execution-api/delivery/summary.md`
- `.harness/changes/20260619-phase2-execution-api/handoff.md`

## T11. Update `feature_list.json` + `sprint_progress.md`

- Mark `F2-07` `implementation_status: completed`, `test_status: passed`, `done_status: completed`.
- Update sprint progress phase table.

## Sequencing Rules

- One task at a time. Do not start T(N+1) until T(N) is GREEN + REFACTOR + tests stay green.
- Tests are RED-first — write the failing test, watch it fail, then implement.
- If a deviation from `spec.md` is needed, document it in `implementation/notes.md` immediately.