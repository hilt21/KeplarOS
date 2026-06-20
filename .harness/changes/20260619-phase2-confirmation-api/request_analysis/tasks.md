# F2-06 Human Confirmation API — Implementation Tasks

Change ID: `20260619-phase2-confirmation-api`
Status: request_analysis

## Conventions

- Strict TDD: every task begins with a failing test, then minimal GREEN implementation, then REFACTOR.
- Tests live alongside the F2-04 / F2-05 pattern: `apps/web/__tests__/api/confirmations.test.ts` with inline `queueSelectResults`, `captureMutations`, `makeTxHarness`, `expectAuditCall`, `expectRealtimeCall`.
- All routes use `apps/web/src/lib/api/actor.ts` `requireActor`.
- All services use F-002 state machine + F-003 authorization helpers + F-004 `runWithAudit`.
- Realtime event type names are exported as constants from `apps/web/src/lib/services/confirmations.ts`.

---

## T1. Repository helpers — load confirmation context (READ)

**RED** — write a service-level test that calls `getConfirmationForDecideService(confirmationId, actor)` and asserts the right authorization + return shape. Watch it fail with `getConfirmationForDecideService is not defined`.

**GREEN** — implement in `apps/web/src/lib/db/repositories/confirmations.ts`:

- `getConfirmationById(db, id)` — single-row select.
- `getConfirmationContext(db, confirmationId)` — joins confirmation + card + goal space; returns `{ confirmation, card, goalSpaceInitiatorId, memberIds, confirmationStatus }` for `canDecideConfirmation` consumption.
- `listConfirmationsForActor(db, actor, { status, page, limit })` — returns `{ items, total }`. Initiator path filters by `goal_spaces.initiator_id = actor.id`; non-initiator path filters by card accessibility (`node_board_id` in member boards OR `assigned_to = actor.id`).
- `updateConfirmationDecision(tx, id, decision)` — writes `status`, `decisionOutcome`, `decisionBy`, `decisionReason`, `decisionComment`, `decidedAt`, `resolvedAt`. Returns the updated row.

**REFACTOR** — split helpers into <50-line functions; ensure no mutation.

## T2. Service: list confirmations

**RED** — write a service-level test for `listConfirmationsService(actor, { status })`.

**GREEN** — `listConfirmationsService`:
- Defaults `status` to `'pending'`.
- Validates `status` is in `['pending', 'approved', 'rejected', 'cancelled']`. Invalid → `INVALID_FIELD` (400).
- Calls `listConfirmationsForActor(db, actor, { status, page, limit })`.
- Maps each row to `HumanConfirmationResponse`. For pending confirmations, omits `decision`. For non-pending, includes `decision` with `outcome`, `decided_by`, `decided_at`, `comment`, `reason`.
- Returns `{ items, total }`.

**REFACTOR** — extract `toResponse` mapper.

## T3. Service: decide confirmation

**RED** — write service-level tests for both approve and reject paths.

**GREEN** — `decideConfirmationService(confirmationId, input, actor)`:
- Loads confirmation context via `getConfirmationContext`. Throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canDecideConfirmation(actor, ctx)` is false (covers non-initiator and already-decided).
- Validates `outcome` is `'approved'` or `'rejected'`. Otherwise `VALIDATION_ERROR` (422).
- On reject: requires `reason` non-empty. Otherwise `VALIDATION_ERROR`.
- On approve with `target_state` set: calls `assertTransition(currentState, targetState, 'human_confirm')` → catches `IllegalTransitionError` → maps to `STATE_CONFLICT` (409).
- On approve without `target_state`: no state change; `card_state_changed: false`.
- On reject: calls `assertTransition(currentState, 'blocked', 'human_reject')`. If current state is terminal, returns `STATE_CONFLICT` directly. Otherwise the assertion passes (every non-terminal state can transition to `blocked` via `human_reject`).
- Defensive: if current card state is terminal, returns `STATE_CONFLICT` with a clear message before calling `assertTransition`.
- Wraps everything in `runWithAudit`:
  - Update `human_confirmations` row (`updateConfirmationDecision`).
  - If state change: `updateCardState` + `insertStateTransition`.
  - audit_entries row (`entityType: 'confirm'`, action `approve` / `reject`).
  - realtime_events row (`type: HUMAN_CONFIRMATION_REALTIME_EVENTS.approved | rejected`, `resourceType: 'confirmation'`).
- Returns `DecideConfirmationResponse`.

**REFACTOR** — extract decision-mapper helpers (`mapApprove`, `mapReject`).

## T4. Route handlers (2 files)

**RED-first** — each handler test is part of the contract test file; write them before the route implementation.

**GREEN** — implement each route:

- `apps/web/src/app/api/v1/confirmations/route.ts` — `GET` list.
- `apps/web/src/app/api/v1/confirmations/[id]/decide/route.ts` — `POST` decide.

**REFACTOR** — share the `try/catch` boilerplate (consistent with F2-02 / F2-03 / F2-04 / F2-05).

## T5. Realtime event constants + snapshot test

**RED** — snapshot test asserts:

```ts
expect(HUMAN_CONFIRMATION_REALTIME_EVENTS).toEqual({
  approved: "human_confirmation.approved",
  rejected: "human_confirmation.rejected",
});
```

**GREEN** — export `HUMAN_CONFIRMATION_REALTIME_EVENTS` and `HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE = "confirm"` from `apps/web/src/lib/services/confirmations.ts`.

**REFACTOR** — none.

## T6. Contract tests file

**RED-then-GREEN** — write the full test file `apps/web/__tests__/api/confirmations.test.ts` covering:

- 401 without session for both endpoints.
- 200 with the documented response shape for happy paths.
- 400 for invalid `status` query param on list.
- 403 for non-initiator on decide.
- 404 for missing confirmation on decide.
- 409 STATE_CONFLICT for already-decided confirmation on decide.
- 422 VALIDATION_ERROR for invalid `outcome` on decide.
- 422 VALIDATION_ERROR for missing `reason` on reject.
- 200 + card_state_changed=true on approve with `target_state` (verifies state_transitions row written).
- 200 + card_state_changed=true on reject (verifies state_transitions row written; card now in `blocked`).
- Audit + realtime capture assertions per decision write.
- Realtime event constants snapshot.

**REFACTOR** — extract helpers if repeated three or more times.

## T7. Verification

- `pnpm --filter @keplar/web test -- __tests__/api/confirmations.test.ts` — green.
- `pnpm --filter @keplar/web test -- __tests__/authorization/confirmation.test.ts` — green (no F-003 regression).
- `pnpm --filter @keplar/web test` — full web suite stays green (485 + new tests).
- `pnpm check` — typecheck + lint + test + build + format:check pass with environment warnings only.
- `git diff --check` — clean.

## T8. Delivery artifacts

- `.harness/changes/20260619-phase2-confirmation-api/implementation/notes.md` — files changed, reuse summary, deviations, risks, verification.
- `.harness/changes/20260619-phase2-confirmation-api/testing/results.md` — test diff and verification matrix.
- `.harness/changes/20260619-phase2-confirmation-api/delivery/summary.md` — feature summary + commit message suggestion.
- `.harness/changes/20260619-phase2-confirmation-api/handoff.md` — F2-07 / F2-08 handoff with realtime event names + audit entity type constants.

## T9. Update `feature_list.json` + `sprint_progress.md`

- Mark `F2-06` `implementation_status: completed`, `test_status: passed`, `done_status: completed`.
- Update sprint progress phase table: Implementation / Testing / Delivery → Complete.

## Sequencing Rules

- One task at a time. Do not start T(N+1) until T(N) is GREEN + REFACTOR + tests stay green.
- Tests are RED-first — write the failing test, watch it fail, then implement.
- If a deviation from `spec.md` is needed, document it in `implementation/notes.md` immediately and stop if it requires returning to Phase 1 / Phase 2.