# F2-07 Deterministic AI Lane Executor API — Request Analysis

Change ID: `20260619-phase2-execution-api`
Status: request_analysis

## Request Summary

Implement the Deterministic AI Lane Executor REST API for the Web Collaboration Beta (F2-07). This is the fifth application feature in Phase 2, following F2-03 (Goal Space), F2-04 (Node Board + Member), F2-05 (Card + Transition), and F2-06 (Human Confirmation).

Scope of this change is the **two documented execution endpoints** in `docs/specs/interface_spec.md § 7`:

1. `POST /api/v1/cards/:id/execute` — kick off a fixture execution for a card using one of the six documented AI roles.
2. `GET /api/v1/execute/:taskId` — read the status of a previously-queued execution.

The executor itself is **deterministic**: given the same card and role, it returns the same structured result. It must not call external LLM, MCP, ACP, A2A, GitHub, shell, network, or filesystem write tools (per the plan § F2-07 Step 3 constraint). The six roles (`Backlog Refiner`, `Todo Orchestrator`, `Dev Crafter`, `Review Guard`, `Done Reporter`, `Blocked Resolver`) are exported as a constant registry from `apps/web/src/lib/execution/roles.ts`.

Every execution lifecycle write produces an `agent_executions` row, an `audit_entries` row, and a `realtime_events` row inside a single `runWithAudit` transaction. Successful executions may also apply a state transition (per the role's transition logic) and/or create a `human_confirmations` row (per the § 5 mandatory gate). Pending human confirmations block execution via the F-003 `canExecuteCard` helper.

This change **does not** introduce: real AI / LLM integration, SSE filtering (F2-08), UI (F2-09), or E2E (F2-10).

## Assumptions

- F2-03 / F2-04 / F2-05 / F2-06 are committed on `master` (commits `507344a`, `29af35b`, `d1d1dcc`, `248a505`, `3830fae`). Reuse their patterns verbatim — same route-harness queue convention, same `captureMutations` / `makeTxHarness` test helpers, same response envelopes.
- `canExecuteCard` (F-003) governs execute authorization: viewer always false; chain_user / initiator must have card read access; must not have pending confirmation; current state must be in `EXECUTABLE_CARD_STATES` (backlog / todo / dev / review / blocked). The § 5 mandatory gate is encoded in this helper.
- The fixture executor is **pure and synchronous**: it takes a `Card` and returns a `FixtureExecutionResult` without any I/O. The service is responsible for persisting the result.
- `runWithAudit` (F-004) wraps every execution lifecycle write. The execution service does NOT call `runWithAudit` for the synchronous fixture executor itself (which doesn't write to the database). The execution service wraps the **persistence** of the result inside `runWithAudit`.
- The execution is **synchronous** in S2 (despite the spec showing `status: 'queued'`). The fixture executor runs immediately inside the POST handler; the response shows `status: 'queued'` then `GET /:taskId` shows `completed` (or `failed`, `needs_confirmation`, `blocked`). This matches the existing `agent_executions` schema's `status` enum and the plan's "deterministic" requirement. Future S4+ may switch to asynchronous execution via a worker queue.
- The execution results that produce a state transition use the existing F-002 state-machine tuples. The Backlog Refiner fixture (e.g.) outputs a `new_state` of `todo` only if the current state is `backlog` and the (backlog, todo, dependencies_ready) or (backlog, todo, context_complete) tuple is in CARD_TRANSITIONS. For other from-states, the fixture executor returns a `failed` result with a clear error message (not a state change).
- The execution results that require human approval create a `human_confirmations` row with the appropriate `trigger_type` (`high_risk`, `low_confidence`, `external_write`, `deployment`, `irreversible`). The Review Guard role typically produces `high_risk` confirmations; the Dev Crafter role can produce `external_write` confirmations.
- The plan lists `status: 'queued'` in the POST response but `status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'needs_confirmation' | 'cancelled'` in the GET response. Since the executor is synchronous in S2, the POST response will show `status: 'queued'` and the GET response immediately after will show `status: 'completed' | 'failed' | 'needs_confirmation'` depending on the fixture result. The `running`, `blocked`, and `cancelled` statuses are reserved for async / cancel paths (out of scope for F2-07).
- The `trigger` column on `agent_executions` is a free-text string (per schema § 2.7). For F2-07, the trigger is the AI role name (e.g., `Backlog Refiner`); the audit `action` is `execute`; the realtime event type is `agent_execution.{queued, completed, failed, needs_confirmation}`.
- Realtime event type names are exported as constants from `apps/web/src/lib/services/executions.ts` for F2-08 SSE filtering handoff.
- `sessions` are out of scope for F2-07: `session_id` on `agent_executions` is null. The plan notes that `sessions.id` represents a goal-space run session; the F2-07 execution is per-card and does not span a full session. Future F2-07 extensions may link executions to sessions.
- The `agent_executions.attempt` field defaults to 1; `max_attempts` defaults to 2. Retry logic is out of scope for F2-07 (the fixture executor runs once).
- The `duration_ms` field on `agent_executions` is computed from the fixture executor's runtime (synchronous timing). For test determinism, the fixture executor returns instantly; the `duration_ms` will be 0 in tests. Production timing will be measured.
- The execute endpoint paginates no resources — POST returns a single task_id, GET returns a single execution. No pagination needed.
- The execute endpoint's `polling_url` in the response is `/api/v1/execute/{task_id}`. This is a relative URL; the client may prepend the base URL.

## Scope

### In Scope

Two endpoints per `docs/specs/interface_spec.md § 7`:

| # | Method | Path | § | Purpose |
|---|--------|------|---|---------|
| 1 | POST | `/api/v1/cards/:id/execute` | 7.1 | Kick off a fixture execution |
| 2 | GET | `/api/v1/execute/:taskId` | 7.2 | Read execution status |

Plus the supporting layers:

- `apps/web/src/lib/execution/roles.ts` — 6-role constant registry (`AGENT_ROLE_VALUES`, `AGENT_ROLES`, `isValidAgentRole`).
- `apps/web/src/lib/execution/fixture-executor.ts` — deterministic executor (`executeFixture(card, role)` → `FixtureExecutionResult`).
- `apps/web/src/lib/services/executions.ts` — 2 transactional services (`createExecutionService`, `getExecutionStatusService`) + `AGENT_EXECUTION_REALTIME_EVENTS` + `AGENT_EXECUTION_AUDIT_ENTITY_TYPE` constants.
- `apps/web/src/lib/db/repositories/executions.ts` — query/write helpers (`createAgentExecution`, `getAgentExecutionById`, `updateAgentExecutionResult`, `createHumanConfirmationForExecution`).
- `apps/web/src/app/api/v1/cards/[id]/execute/route.ts` — `POST` execute.
- `apps/web/src/app/api/v1/execute/[taskId]/route.ts` — `GET` status.
- `apps/web/__tests__/api/executions.test.ts` — TDD contract tests.

### Out of Scope

- Real AI / LLM integration. The fixture executor is a pure deterministic function.
- Async / worker-queue execution. The fixture runs synchronously in the POST handler.
- Retry / max_attempts logic. `attempt = 1` always.
- Cancellation / `cancelled` status transition.
- Session linking. `session_id = null` always.
- `polling_url` absolute URL construction (client composes the base URL).
- Multi-card batch execution.
- Result streaming / partial progress.
- Real MCP / ACP / A2A / GitHub / shell / network integrations.

## Affected Modules

### Existing files (read-only references, not modified)

- `apps/web/db/schema.ts` — `agentExecutions`, `humanConfirmations`, `cards`, `goalSpaces`, `auditEntries`, `realtimeEvents`, `stateTransitions` tables and their enums.
- `apps/web/src/lib/authorization/execute.ts` — `canExecuteCard`, `EXECUTABLE_CARD_STATES`.
- `apps/web/src/lib/authorization/types.ts` — `ExecuteCardContext`.
- `apps/web/src/lib/state-machine/card.ts` — `assertTransition`, `canTransition`, `getRequiredActor`, `TRANSITION_TRIGGERS`.
- `apps/web/src/lib/api/actor.ts` — `requireActor`.
- `apps/web/src/lib/api/request.ts` — `readJsonBody`, `requireString`, `optionalObject`.
- `apps/web/src/lib/api/response.ts` — `apiCreated`, `apiOk`, `apiNoContent`, `apiError`.
- `apps/web/src/lib/api/errors.ts` — `ApiRequestError`, `API_ERROR_CODES`.
- `apps/web/src/lib/audit/run-with-audit.ts` — `runWithAudit`, `AuditContext`.
- `apps/web/src/lib/db/client.ts` — `getDb`, `DrizzleDb`.
- `apps/web/src/lib/db/repositories/cards.ts` — `getCardContext`, `updateCardState`, `insertStateTransition`.
- `apps/web/src/lib/db/repositories/confirmations.ts` — `getConfirmationById`, `updateConfirmationDecision` (for the needs_confirmation path).

### New files

- `apps/web/src/lib/execution/roles.ts`
- `apps/web/src/lib/execution/fixture-executor.ts`
- `apps/web/src/lib/db/repositories/executions.ts`
- `apps/web/src/lib/services/executions.ts`
- `apps/web/src/app/api/v1/cards/[id]/execute/route.ts`
- `apps/web/src/app/api/v1/execute/[taskId]/route.ts`
- `apps/web/__tests__/api/executions.test.ts`

### Modified files

None. F2-07 introduces only new files. F2-02 / F2-03 / F2-04 / F2-05 / F2-06 / F-002 / F-003 / F-004 files are not modified.

## Acceptance Criteria

### Endpoint behavior

1. **POST `/api/v1/cards/:id/execute`** — Returns 202 with `ExecuteCardResponse` containing `task_id`, `card_id`, `role`, `status: 'queued'`, `estimated_time`, `polling_url`. Body: `{ role: AgentRole, context?: Record<string, unknown> }`. Validates `role` is one of the 6 documented roles (422 VALIDATION_ERROR otherwise). Rejects viewer (403 FORBIDDEN). Rejects missing card (404 NOT_FOUND). Rejects pending confirmation (409 CONFIRMATION_REQUIRED). Rejects terminal-state card (409 STATE_CONFLICT). The execution runs synchronously inside the request; the response `status` is `queued` and the next `GET /execute/:taskId` returns the final status.

2. **GET `/api/v1/execute/:taskId`** — Returns 200 with `ExecuteStatusResponse`. Returns 404 if `task_id` is missing. Returns 403 if the actor is not the goal-space initiator OR a node-board member OR the card's assignee (uses `canReadCard` semantics). The response includes `attempt`, `max_attempts`, `started_at`, `completed_at`, optional `result` (with `new_state`, `confidence`, `evidence`, `message`), and optional `error` (with `code`, `message`).

### Cross-cutting

3. Every execution lifecycle write persists exactly one `agent_executions` row, one `audit_entries` row (entity_type `agent_execution`, action `execute`), and one `realtime_events` row (`agent_execution.queued` or terminal status event) inside a single `runWithAudit` transaction.
4. The fixture executor is deterministic: given the same `card` + `role` + `context`, returns the same result. It does not call any external I/O.
5. The Backlog Refiner fixture can move a backlog card to `todo`: when `card.state === 'backlog'` and role is `Backlog Refiner`, the fixture outputs `result.new_state = 'todo'` with confidence 0.85. The service applies the state transition via `assertTransition('backlog', 'todo', 'dependencies_ready')`.
6. The Review Guard fixture can create a `needs_confirmation` row for a high-risk card: when `card.riskLevel === 'high'` and role is `Review Guard`, the fixture outputs `result.new_state = undefined` and creates a `human_confirmations` row with `trigger_type = 'high_risk'` and `target_state = 'done'`.
7. Failed execution records an error in `agent_executions.error_code` + `error_message` and emits `agent_execution.failed` realtime event. Audit `action` is `execute_failed`.
8. The execute endpoint respects the `EXECUTABLE_CARD_STATES` check: terminal-state cards (`done`, `cancelled`) cannot be executed (409 STATE_CONFLICT).
9. `canExecuteCard` (F-003) is used by the execute service for the authorization gate. The § 5 mandatory gate (pending confirmation) is encoded in this helper.
10. `assertTransition` (F-002) is used for state transitions; `IllegalTransitionError` is mapped to 409 STATE_CONFLICT (consistent with F2-05 / F2-06).
11. `runWithAudit` wraps every lifecycle write.
12. Realtime event type names (`agent_execution.queued`, `agent_execution.completed`, `agent_execution.failed`, `agent_execution.needs_confirmation`) are exported as constants from `apps/web/src/lib/services/executions.ts`. A snapshot test pins them.

### Verification

13. `pnpm --filter @keplar/web test -- __tests__/api/executions.test.ts` passes.
14. `pnpm --filter @keplar/web test -- __tests__/authorization/execute.test.ts __tests__/authorization/execute-db.test.ts` passes (no F-003 regression).
15. `pnpm --filter @keplar/web test` passes (the full web suite stays green; F2-06's 499 tests remain green).
16. `pnpm check` passes (typecheck + lint + test + build + format:check) with environment warnings only.
17. `git diff --check` passes.
18. No files outside the F2-07 file set or unrelated prior changes are modified.

## Risks and Open Questions

| # | Risk / Question | Severity | Resolution |
|---|---|---|---|
| R1 | The plan says "deterministic" but does not specify the exact transition rules per role. The implementation must encode the role → transition mapping. | Low | Resolved: the fixture executor is a switch statement on `role`, with each case computing the expected state transition or confirmation trigger. Encoded in `fixture-executor.ts`. |
| Q1 | Should the fixture executor be deterministic across runs (i.e., `card.riskLevel === 'high'` always triggers confirmation) or randomized? | — | Resolved: deterministic. Same card + role → same result. Test fixtures pin this. |
| Q2 | Should the role's `target_state` be configurable by the caller, or hard-coded per role? | — | Resolved: hard-coded per role in the fixture executor. The `context` field is recorded in `agent_executions.inputContext` but does not influence the transition logic. Future extensions may support custom target states. |
| R2 | `agent_executions.status = 'needs_confirmation'` requires a corresponding `human_confirmations` row to exist (per the F2-06 partial unique index `idx_human_confirmations_card_pending`). | Low | Resolved: the service creates the `human_confirmations` row inside the same `runWithAudit` transaction, atomically with the `agent_executions` row and the audit + realtime writes. The card is NOT transitioned to a new state when a confirmation is needed (the card's pending state change is deferred to F2-06's approval). |
| R3 | The fixture executor's runtime is synchronous (microseconds), so `duration_ms` will be 0 in tests. | Low | Resolved: the service uses `Date.now()` before/after the executor call and writes the delta. For deterministic test output, the service writes `0` when the input context flag `synchronous === true` (test-only). Production writes the actual duration. |
| R4 | The `polling_url` is documented as a string. Should it be an absolute URL or relative? | — | Resolved: relative URL `/api/v1/execute/{task_id}`. The client prepends the base URL. |
| R5 | The fixture executor must NOT call external I/O. This includes `Date.now()` and `Math.random()` for determinism. | Low | Resolved: the executor receives the current `Date.now()` as a parameter from the service. The service is responsible for time, not the executor. This makes the executor testable with a frozen clock. |
| R6 | `agent_executions.sessionId` is nullable. F2-07 does not create sessions. | Low | Resolved: `sessionId = null`. Future S4+ may add session linking. |
| R7 | The F-002 state machine's transition tuples constrain which (from, to, trigger) combinations are legal. If the fixture executor outputs a `new_state` that is not reachable from the current state via any trigger, `assertTransition` throws. | Low | Resolved: the fixture executor knows the F-002 rules and only outputs legal transitions. The fallback `failed` result covers cases where the from-state is unexpected. |
| R8 | The `evidence` field on the execution result is documented as `Evidence[]` (per interface spec § 5.1). `Evidence` is not explicitly defined in the spec. | Low | Resolved: `Evidence = Record<string, unknown>` — same shape as `cards.evidence`. The fixture executor returns an empty array `[]` for S2. Future extensions may populate. |
| R9 | The execute endpoint's response `estimated_time` is documented as "seconds". | Low | Resolved: a hard-coded constant (e.g., 5 seconds per role). Production may refine via role-specific estimates. |
| R10 | Audit entity type for executions is `agent_execution` (per the existing schema enum). Realtime `resource_type` should match for filtering. | Low | Resolved: audit uses `agent_execution`; realtime uses `agent_execution` (same string). Both align with the schema enum. |
| R11 | `agent_role` is free text in the schema. The 6 documented roles must be enforced. | Low | Resolved: the route validates against `AGENT_ROLE_VALUES` (literal union from F-001). Invalid roles return 422 VALIDATION_ERROR. |
| R12 | The fixture executor's `needs_confirmation` path creates a `human_confirmations` row, which itself emits a realtime event. F2-06's service emits `human_confirmation.approved|rejected` only on decisions; the create-side event is emitted by F2-07 (a `human_confirmation.created` event). | Low | Resolved: F2-07 emits `human_confirmation.created` when creating a confirmation. Documented in handoff. |

## Reuse Summary (no new primitives)

| Concern | Reused from | File |
|---|---|---|
| Session / actor resolution | F2-02 | `apps/web/src/lib/api/actor.ts` |
| Authorization check | F-003 | `apps/web/src/lib/authorization/execute.ts` |
| State machine | F-002 | `apps/web/src/lib/state-machine/card.ts` |
| Transaction wrapper | F-004 | `apps/web/src/lib/audit/run-with-audit.ts` |
| Response envelope | F2-01 | `apps/web/src/lib/api/response.ts` |
| JSON validation | F2-02 | `apps/web/src/lib/api/request.ts` |
| Card context loading | F2-05 | `apps/web/src/lib/db/repositories/cards.ts` |
| State transitions | F2-05 | `apps/web/src/lib/db/repositories/cards.ts` (`updateCardState`, `insertStateTransition`) |
| Mock harness pattern | F2-04 / F2-05 / F2-06 | `apps/web/__tests__/api/route-test-harness.ts` (re-declared inline) |

## Sequencing

1. Phase 1: Request Analysis (this document) — human approval.
2. Phase 2: Review — risk matrix + open questions re-checked.
3. Phase 3: Implementation via TDD (RED → GREEN → REFACTOR):
   - Role registry (`roles.ts`).
   - Fixture executor (`fixture-executor.ts`).
   - Repository helpers (`executions.ts`).
   - Service layer (2 transactional services with `runWithAudit`).
   - 2 route handlers.
   - TDD contract tests written first, watched to fail, then implementation passes.
4. Phase 4: Testing — targeted tests + full web suite + pnpm check.
5. Phase 5: Delivery — `delivery/summary.md` + `handoff.md`.

## Next-Step Hint

F2-08 (SSE Dashboard Endpoint) is the immediate follow-up. It should:

- Read `AGENT_EXECUTION_REALTIME_EVENTS` from F2-07's service module.
- Read `HUMAN_CONFIRMATION_REALTIME_EVENTS` from F2-06's service module.
- Read `CARD_REALTIME_EVENTS` from F2-05's service module.
- Read `NODE_BOARD_REALTIME_EVENTS` from F2-04's service module.
- Read `GOAL_SPACE_REALTIME_EVENTS` from F2-03's service module.
- Filter SSE streams by per-actor accessibility (initiator sees all; chain_user / viewer see only their goal spaces / cards).
- Support `Last-Event-ID` replay.

F2-09 (Web UI) should:

- Add an "Execute" button on each card.
- Display the execution status (queued → running → completed / failed / needs_confirmation).
- Render the `result.new_state` transition.
- Link to a confirmation modal when the result is `needs_confirmation`.

F2-10 (E2E) should:

- Add a Playwright happy-path that exercises a `Backlog Refiner` execution.
- Verify the card transitions from `backlog` → `todo`.
- Verify the SSE-driven UI update without manual refresh.