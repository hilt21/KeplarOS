# F2-06 Human Confirmation API — Request Analysis

Change ID: `20260619-phase2-confirmation-api`
Status: request_analysis

## Request Summary

Implement the Human Confirmation REST API for the Web Collaboration Beta (F2-06). This is the fourth application feature in Phase 2, following F2-03 (Goal Space), F2-04 (Node Board + Member), and F2-05 (Card + Transition).

Scope of this change is the **two documented confirmation endpoints** in `docs/specs/interface_spec.md § 6`:

1. `GET /api/v1/confirmations?status=pending` — list accessible confirmations.
2. `POST /api/v1/confirmations/:id/decide` — initiator approves or rejects a pending confirmation, which moves the card to `target_state` (approve) or `blocked` (reject).

Every decision write is wrapped in `runWithAudit` so the confirmation update, card state transition, audit entry, realtime event, and `state_transitions` row share a single `better-sqlite3` transaction. `canDecideConfirmation` (F-003) governs authorization: only the goal-space initiator can decide, and only when the confirmation is `pending`.

This change **does not** introduce: AI execution / role registry (F2-07), SSE filtering (F2-08), UI (F2-09), E2E (F2-10), or the `pending` confirmation creation flow (F2-07 will create confirmations when AI role execution needs them; F2-06 only consumes them).

## Assumptions

- F2-03 / F2-04 / F2-05 are committed on `master` (commits `507344a`, `29af35b`, `d1d1dcc`, `248a505`). Reuse their patterns verbatim — same route-harness queue convention, same `captureMutations` / `makeTxHarness` test helpers, same response envelopes.
- `canDecideConfirmation` (F-003) is the single source of authorization truth. Only the goal-space initiator can decide; chain_user / viewer always get 403. Non-pending confirmations always return 409 STATE_CONFLICT.
- `assertTransition` (F-002) governs the state machine. Approval with a `target_state` triggers a transition tuple `(current_state, target_state, human_confirm)`. Rejection triggers `(current_state, blocked, human_reject)`. Both tuples already exist in CARD_TRANSITIONS.
- `runWithAudit` (F-004) wraps the decision write. The decision update + card update + state_transitions row + audit + realtime all share one transaction.
- The repository loads the confirmation context (confirmation row + card row + goal-space context) from the database inside a single call site — never trust caller-supplied context. Consistent with the F2-05 review follow-up.
- The list endpoint accepts `status` as an optional query param. `status=pending` is the documented default behavior; `status=approved|rejected|cancelled` is permitted for completeness. No other filters in F2-06.
- The list endpoint paginates with `page` + `limit` query params (consistent with F2-03 / F2-05 list endpoints), default `page=1, limit=20`.
- `card_title` in `HumanConfirmationResponse` is loaded from the `cards` table via a join. The repository fetches it inside the same query path (single-query join, not a separate fetch per row).
- The detail response (`GET /confirmations/:id`) is out of scope — the spec only documents `?status=...` list and `POST /:id/decide`. F2-09 UI can re-use the list endpoint or extend F2-06 if a detail view is needed.
- The list endpoint's "only accessible confirmations" rule:
  - Initiator: sees all `human_confirmations` whose card is in a goal space they initiated.
  - Chain_user / viewer: sees confirmations whose card they can read (`canReadCard` semantics). This is the same rule the `card-id-list` endpoint follows for non-initiators (per `docs/specs/authorization_matrix.md § 4`).
- Realtime event type names are exported as constants from the service for F2-08 SSE filtering handoff. Two events: `human_confirmation.approved` and `human_confirmation.rejected`. These match the F2-04 / F2-05 precedent of pinning realtime names.

## Scope

### In Scope

Two endpoints per `docs/specs/interface_spec.md § 6`:

| # | Method | Path | § | Purpose |
|---|--------|------|---|---------|
| 1 | GET | `/api/v1/confirmations?status=pending` | 6.1 | List accessible confirmations |
| 2 | POST | `/api/v1/confirmations/:id/decide` | 6.2 | Approve or reject a pending confirmation |

Plus the supporting layers:

- `apps/web/src/lib/db/repositories/confirmations.ts` — query/write helpers (`getConfirmationContext`, `listConfirmationsForActor`, `updateConfirmationStatus`, etc.).
- `apps/web/src/lib/services/confirmations.ts` — 2 transactional services + `HUMAN_CONFIRMATION_REALTIME_EVENTS` + `HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE` constants.
- `apps/web/__tests__/api/confirmations.test.ts` — TDD contract tests for the 2 endpoints + the realtime event constant snapshot.

### Out of Scope

- AI execution / role registry / execution results — F2-07 (F2-07 will create `human_confirmations` rows when needed; F2-06 only consumes them).
- SSE filtering and realtime fan-out — F2-08.
- UI rendering — F2-09.
- Playwright E2E journeys — F2-10.
- The `pending` confirmation creation endpoint — F2-07 creates confirmations; F2-06 only decides them.
- Bulk decision (multi-approval) endpoint.
- `DELETE /confirmations/:id` — cancellations flow through F2-07 (e.g., when a goal space is cancelled).
- Notification / email integration.

## Affected Modules

### Existing files (read-only references, not modified)

- `apps/web/db/schema.ts` — `humanConfirmations`, `cards`, `goalSpaces`, `stateTransitions`, `auditEntries`, `realtimeEvents` tables and their enums.
- `apps/web/src/lib/authorization/confirmation.ts` — `canDecideConfirmation`.
- `apps/web/src/lib/authorization/types.ts` — `ConfirmationContext` (already carries `confirmationStatus` so the F-003 helper can early-return false on non-pending).
- `apps/web/src/lib/state-machine/card.ts` — `assertTransition`, `canTransition`, `getRequiredActor`, `TRANSITION_TRIGGERS`.
- `apps/web/src/lib/api/actor.ts` — `requireActor`, `requireInitiator`.
- `apps/web/src/lib/api/request.ts` — `readJsonBody`, `requireString`, `optionalString`.
- `apps/web/src/lib/api/response.ts` — `apiOk`, `apiCreated`, `apiNoContent`, `apiError`.
- `apps/web/src/lib/api/errors.ts` — `ApiRequestError`, `API_ERROR_CODES` (already includes `STATE_CONFLICT`, `VALIDATION_ERROR`, `FORBIDDEN`).
- `apps/web/src/lib/audit/run-with-audit.ts` — `runWithAudit`, `AuditContext`.
- `apps/web/src/lib/db/client.ts` — `getDb`, `DrizzleDb`.
- `apps/web/src/lib/db/repositories/cards.ts` — `getCardContext`, `updateCardState`, `insertStateTransition` (reuse for the decision flow's card move).
- `apps/web/src/lib/api/pagination.ts` — `parsePagination` (reused for the list endpoint).
- `apps/web/__tests__/api/route-test-harness.ts` — `createJsonRequest`, `expectApiOk`, `expectApiError`, `withTestSession`.

### New files

- `apps/web/src/lib/db/repositories/confirmations.ts`
- `apps/web/src/lib/services/confirmations.ts`
- `apps/web/src/app/api/v1/confirmations/route.ts`
- `apps/web/src/app/api/v1/confirmations/[id]/decide/route.ts`
- `apps/web/__tests__/api/confirmations.test.ts`

### Modified files

None. F2-06 introduces only new files. F2-02 / F2-03 / F2-04 / F2-05 / F-002 / F-003 / F-004 files are not modified.

## Acceptance Criteria

### Endpoint behavior

1. **GET `/api/v1/confirmations?status=pending`** — Initiator sees all pending confirmations on cards in their goal spaces. Chain_user / viewer see only pending confirmations on cards they can read (per `canReadCard` semantics). Returns `200` with `{ items: HumanConfirmationResponse[], total: number }`. Returns `401` without a session. The `status` query param defaults to `pending`; accepts `pending | approved | rejected | cancelled`. Out-of-range `status` returns `400 INVALID_FIELD`.

2. **POST `/api/v1/confirmations/:id/decide`** — Initiator only. Body: `{ outcome: 'approved' | 'rejected', comment?: string, reason: string }` (reason required when `outcome === 'rejected'`). On approve with `target_state`: the card transitions to `target_state` via `human_confirm` trigger. On reject: the card transitions to `blocked` via `human_reject` trigger, and `decision_reason` records the reject reason. Returns `200` with `DecideConfirmationResponse`. Returns `401` without a session, `403` for non-initiator, `404` for missing confirmation, `409 STATE_CONFLICT` for already-decided or cancelled, `422 VALIDATION_ERROR` for invalid outcome or missing `reason` on reject, `409 CONFIRMATION_REQUIRED` if the underlying card is missing (should not happen but defensive).

### Cross-cutting

3. Every decision write persists exactly one `audit_entries` row (entity_type `"confirm"`, action `"approve"` or `"reject"`), one `realtime_events` row (`human_confirmation.approved` or `human_confirmation.rejected`), one `state_transitions` row (if the card state changed), and the confirmation status update inside a single transaction. Failure rolls back the decision.
4. The `approval` path's `state_transitions` row uses `trigger: 'human_confirm'`, `actor: 'human'`, `actor_id: actor.id`.
5. The `rejection` path's `state_transitions` row uses `trigger: 'human_reject'`, `actor: 'human'`, `actor_id: actor.id`.
6. `canDecideConfirmation` is used by the decision service (no new authorization helpers).
7. `assertTransition` is used by the decision service for both the approve and reject paths (no state-machine duplication).
8. `runWithAudit` wraps every decision write (no transaction duplication).
9. Realtime event type names (`human_confirmation.approved`, `human_confirmation.rejected`) are exported as constants from `apps/web/src/lib/services/confirmations.ts`. A snapshot test pins them.
10. The list endpoint reuses `parsePagination` from F2-02's `apps/web/src/lib/api/pagination.ts`.

### Verification

11. `pnpm --filter @keplar/web test -- __tests__/api/confirmations.test.ts` passes.
12. `pnpm --filter @keplar/web test -- __tests__/authorization/confirmation.test.ts` passes (no F-003 regression).
13. `pnpm --filter @keplar/web test` passes (the full web suite stays green; F2-05's 485 tests remain green).
14. `pnpm check` passes (typecheck + lint + test + build + format:check) with environment warnings only.
15. `git diff --check` passes.
16. No files outside the F2-06 file set or unrelated prior changes are modified.

## Risks and Open Questions

| # | Risk / Question | Severity | Resolution |
|---|---|---|---|
| R1 | The `comment` field on the decision is documented in `DecideConfirmationRequest` as optional. The schema has `decisionComment`. | Low | Service writes `decisionComment: input.comment ?? null`. Pin with a contract test. |
| R2 | The `reason` field is documented as required when `outcome === 'rejected'`. On approve, the spec is ambiguous. | Low | Resolved: accept `reason` as optional on approve, required on reject (matches schema `decisionReason`). Pin with two contract tests. |
| R3 | The `HumanConfirmationResponse.decision` object is present only after a decision is made. The list endpoint should include it for non-pending confirmations and omit it for pending ones. | Low | Resolved: mapper sets `decision: row.status === 'pending' ? undefined : { ... }`. Pin with a contract test. |
| R4 | The list endpoint's "accessible" rule for non-initiator actors needs `canReadCard` semantics. The repository must load each card's authorization context (members, goal-space initiator) per row, OR run a single SQL join to filter by accessibility. | Medium | The repository uses a single SQL join: `human_confirmations ⋈ cards ⋈ goal_spaces` plus a subquery that limits to (card.node_board_id in member_boards OR card.assigned_to = actor.id) for non-initiators. The `actor.role === 'initiator'` branch returns all confirmations in goal spaces they initiated. |
| Q1 | Should `POST /:id/decide` accept `reason` on approve? | — | Resolved: optional on approve. The schema's `decisionReason` is nullable. No human input needed. |
| Q2 | Should the list endpoint paginate? | — | Resolved: yes — `parsePagination` defaults to `page=1, limit=20`. Confirmations are bounded but the request to scan them is expensive (per-card join). Pin with a contract test that asserts `total === 1` for a single-row fixture. |
| Q3 | Should `decision_outcome` and `decision` fields on `HumanConfirmationResponse` map the existing `decisionOutcome` column? | — | Resolved: yes — `decisionOutcome` (`approved | rejected | null`) becomes `decision.outcome`. The mapper handles the null case for `pending` confirmations. |
| R5 | The `state_transitions` table requires `toState` (NOT NULL). When a rejection moves a card from `done` (terminal) to `blocked`, this is rejected by `assertTransition` (`isTerminalState('done') → false`). | Low | Resolved: in practice, a `pending` confirmation should never exist for a `done` card (the card cannot reach terminal state while a confirmation is pending). Defensive: the service checks `isTerminalState(card.state)` before the rejection path and returns `STATE_CONFLICT` if the card is already terminal. |
| R6 | `audit_entries.entity_type = 'confirm'` (note: `'confirm'`, not `'confirmation'` — the F-001 schema enum uses `'confirm'`; the realtime `resource_type` uses `'confirmation'`). | Low | Resolved: audit uses `'confirm'`. Realtime uses `'confirmation'`. The two are inconsistent in the existing schema (per `apps/web/db/schema.ts` notes); F2-06 follows the existing convention. The handoff to F2-08 documents both. |
| R7 | `actor_name` on `state_transitions` is a free-text field. | Low | Resolved: pass `actor.id` as `actor_name` (consistent with F2-05 convention). S4+ should join `users.name`. |
| R8 | The list endpoint's "initiator sees all" branch must filter by `goal_spaces.initiator_id = actor.id`. Non-initiator branch must filter by card accessibility (members / assigned_to). | Low | The repository does the SQL filtering; the service does not need to post-filter. |
| R9 | The `expires_at` column is required on insert but the spec doesn't specify how to set it on creation. F2-07 will create confirmations with a default TTL (e.g., 24 hours from creation). | Low | F2-06 only consumes existing confirmations. F2-07 owns the create-side TTL. |

## Reuse Summary (no new primitives)

| Concern | Reused from | File |
|---|---|---|
| Session / actor resolution | F2-02 | `apps/web/src/lib/api/actor.ts` |
| Authorization check | F-003 | `apps/web/src/lib/authorization/confirmation.ts` |
| State machine | F-002 | `apps/web/src/lib/state-machine/card.ts` |
| Transaction wrapper | F-004 | `apps/web/src/lib/audit/run-with-audit.ts` |
| Response envelope | F2-01 | `apps/web/src/lib/api/response.ts` |
| JSON validation | F2-02 | `apps/web/src/lib/api/request.ts` |
| Pagination | F2-02 | `apps/web/src/lib/api/pagination.ts` |
| Mock harness pattern | F2-04 / F2-05 | `apps/web/__tests__/api/node-boards.test.ts`, `cards.test.ts` (re-declared inline) |
| Card context loading | F2-05 | `apps/web/src/lib/db/repositories/cards.ts` (`getCardContext`, `updateCardState`, `insertStateTransition`) |
| Goal space read | F2-03 | `apps/web/src/lib/db/repositories/goal-spaces.ts` |

## Sequencing

1. Phase 1: Request Analysis (this document) — human approval.
2. Phase 2: Review — risk matrix + open questions re-checked.
3. Phase 3: Implementation via TDD (RED → GREEN → REFACTOR):
   - Repository helpers (`getConfirmationContext`, `listConfirmationsForActor`, `updateConfirmationStatus`).
   - Service layer with `runWithAudit` + state-machine + authorization.
   - 2 route handlers (list + decide).
   - TDD contract tests written first, watched to fail, then implementation passes.
4. Phase 4: Testing — targeted tests + full web suite + pnpm check.
5. Phase 5: Delivery — `delivery/summary.md` + `handoff.md`.

## Next-Step Hint

F2-07 (Deterministic AI Lane Executor API) is the immediate follow-up. It should:

- Create `human_confirmations` rows when an AI role's fixture executor produces high-risk or low-confidence output (per `CONFIRMATION_TRIGGER_TYPE_VALUES`).
- Set `target_state` based on the role's transition logic (e.g., `Backlog Refiner` → `todo`, `Dev Crafter` → `review`).
- Reuse `runWithAudit` for the create-side audit + realtime.
- Consume `card.blocked` and `card.unblocked` realtime events from F2-05 to update fixture state.
- Export confirmation-side realtime event constants from `apps/web/src/lib/services/executions.ts` for F2-08.

F2-08 (SSE) should:

- Read `HUMAN_CONFIRMATION_REALTIME_EVENTS` from F2-06's service module.
- Read `CARD_REALTIME_EVENTS` from F2-05's service module.
- Read `NODE_BOARD_REALTIME_EVENTS` from F2-04's service module.
- Filter SSE streams by per-actor accessibility (initiator sees all; chain_user / viewer see only their goal spaces / cards).