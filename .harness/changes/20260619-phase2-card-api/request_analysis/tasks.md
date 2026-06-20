# F2-05 Card and Transition API — Implementation Tasks

Change ID: `20260619-phase2-card-api`
Status: request_analysis

## Conventions

- Strict TDD: every task begins with a failing test, then minimal GREEN implementation, then REFACTOR.
- Tests live alongside the F2-04 pattern: `apps/web/__tests__/api/cards.test.ts` with inline `queueSelectResults`, `captureMutations`, `makeTxHarness`, `expectAuditCall`.
- All routes use `apps/web/src/lib/api/actor.ts` `requireActor` / `requireInitiator`.
- All services use F-002 state machine + F-003 authorization helpers + F-004 `runWithAudit`.
- Realtime event type names are exported as constants from `apps/web/src/lib/services/cards.ts`.

---

## T1. Repository helpers — load card with context (READ)

**RED** — write a service-level test that calls `getCardByIdService("c-1", actor)` and asserts the right authorization + return shape. Watch it fail with `getCardByIdService is not defined`.

**GREEN** — implement in `apps/web/src/lib/db/repositories/cards.ts`:

- `getCardById(db, id)` — `select * from cards where id = ? and deleted_at is null`.
- `getGoalSpaceContextForCard(db, goalSpaceId)` — returns `{ goalSpaceId, initiatorId, nodeBoardMemberIds }` (mirrors F2-04 `getGoalSpaceContextForBoard`).
- `getCardWithContext(db, cardId)` — combines the two, plus a `nodeBoardMemberIds` filter to only the card's node board (so the authz context is node-board-scoped). Returns `{ card, goalSpaceId, goalSpaceInitiatorId, memberIds, hasPendingConfirmation }`.
- `listActiveCardsForGoalSpace(db, goalSpaceId, filters)` — applies state / assigned_to / tags filters; returns `{ items, total }`.
- `listTransitionsForCard(db, cardId)` — `select * from state_transitions where entity_type='card' and entity_id=cardId order by timestamp asc`.

**REFACTOR** — split helpers into `<50`-line functions; ensure no mutation; type-only.

## T2. Service: list cards in a goal space

**RED** — write a service-level test that calls `listCardsForGoalSpaceService("gs-1", actor, filters)`.

**GREEN** — `listCardsForGoalSpaceService`:
- Reads goal space via `getGoalSpaceWithMembers`; throws `NOT_FOUND` if missing.
- Reads visible card ids per the authz rule (initiator → all; chain_user / viewer → only those whose `node_board_id` is in the actor's member boards OR whose `assigned_to === actor.id`).
- Applies optional `state`, `assigned_to`, `tags` filters.
- Returns `{ items: CardResponse[], total: number }`.

**REFACTOR** — extract visibility predicate.

## T3. Service: create card

**RED** — write a service-level test for `createCardService(goalSpaceId, input, actor)`.

**GREEN** — `createCardService`:
- Reads goal space + node board + members; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` for viewer; allowed for initiator (always) and chain_user if member of `node_board_id`.
- Generates `display_id` via `MAX(CAST(SUBSTR(display_id, 6) AS INTEGER)) + 1` inside the transaction (default `"CARD-001"` if no cards yet).
- Wraps the insert + audit + realtime in `runWithAudit`. Realtime type: `card.created`.
- Returns the new `CardResponse`.

**REFACTOR** — extract display-id counter into a helper.

## T4. Service: get card detail

**RED** — test for `getCardDetailService(cardId, actor)`.

**GREEN** — `getCardDetailService`:
- Loads card + context via `getCardWithContext`; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canReadCard` is false.
- Reads `transitions` + `confirmations` + `audit_trail` (last N=50 audit rows for the card).
- Returns `CardDetailResponse`.

**REFACTOR** — paginate audit trail (`limit 50`) inline.

## T5. Service: update card

**RED** — test for `updateCardService(cardId, input, actor)`.

**GREEN** — `updateCardService`:
- Loads context; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canMutateCard(action='update')` is false.
- Validates `priority` (0–4), `risk_level` (enum), `tags` (string array). Throws `VALIDATION_ERROR` otherwise.
- Rejects `state` in body (state is state-machine-managed).
- Wraps update + audit + realtime (`card.updated`) in `runWithAudit`.
- Returns updated `CardResponse`.

**REFACTOR** — extract validation helpers into `validatePriority` / `validateRiskLevel`.

## T6. Service: assign card

**RED** — test for `assignCardService(cardId, { assigned_to }, actor)`.

**GREEN** — `assignCardService`:
- Loads context; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canMutateCard(action='update')` is false (assign is a metadata update; F2-05 review follow-up resolves that `assign` follows the `update` authz gate).
- Throws `INVALID_FIELD` if `assigned_to` is missing or not a string.
- Idempotent on same `assigned_to`: short-circuits and returns the existing card without writing audit/realtime.
- Wraps update + audit + realtime (`card.assigned`) in `runWithAudit`.
- Returns updated `CardResponse`.

**REFACTOR** — confirm idempotency path matches F2-04 pattern.

## T7. Service: block card

**RED** — test for `blockCardService(cardId, { reason }, actor)`.

**GREEN** — `blockCardService`:
- Loads context; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canMutateCard(action='update')` is false.
- Throws `INVALID_FIELD` if `reason` is missing or empty.
- Throws `STATE_CONFLICT` if current state is terminal (`done` / `cancelled`).
- Calls `assertTransition(from=currentState, to='blocked', trigger='review_failed')`. Throws `IllegalTransitionError` → mapped to `422 VALIDATION_ERROR` (or `STATE_CONFLICT` per review).
- Inside `runWithAudit`: writes `cards` update (state, blocked_reason, blocked_at), `state_transitions` row (actor = `getRequiredActor(...)`), `audit_entries`, `realtime_events` (`card.blocked`).
- Returns updated `CardResponse`.

**REFACTOR** — extract transition runner into a `runCardTransition` helper to be reused in T8.

## T8. Service: unblock card

**RED** — test for `unblockCardService(cardId, { target_state }, actor)`.

**GREEN** — `unblockCardService`:
- Loads context; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canMutateCard(action='unblock')` is false. Note: `canMutateCard('unblock')` already returns false when `hasPendingConfirmation=true` (F-003 AC-3.7 + spec § 5 mandatory gate).
- Throws `INVALID_FIELD` if `target_state` is missing; `VALIDATION_ERROR` if not in `{backlog, todo, dev, review}`.
- Throws `STATE_CONFLICT` if current state is not `blocked`.
- Calls `assertTransition(from='blocked', to=target_state, trigger='blocked_resolved')`. Maps `IllegalTransitionError` to `VALIDATION_ERROR` (422).
- Inside `runWithAudit`: writes `cards` update (state, blocked_reason=null, blocked_at=null), `state_transitions` row, `audit_entries`, `realtime_events` (`card.unblocked`).
- Returns updated `CardResponse`.

**REFACTOR** — share transition runner with T7.

## T9. Service: list transitions

**RED** — test for `listCardTransitionsService(cardId, actor)`.

**GREEN** — `listCardTransitionsService`:
- Loads context; throws `NOT_FOUND` if missing.
- Throws `FORBIDDEN` if `canReadCard` is false.
- Returns `listTransitionsForCard(db, cardId)` mapped to `StateTransitionResponse[]`.

**REFACTOR** — extract response mapper.

## T10. Route handlers (8 files)

**RED-first** — each handler test is part of the contract test file; write them before the route implementation.

**GREEN** — implement each route with `requireActor` / `requireInitiator` + the corresponding service:

- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/cards/route.ts` — `GET` list + `POST` create.
- `apps/web/src/app/api/v1/cards/[id]/route.ts` — `GET` detail + `PATCH` update.
- `apps/web/src/app/api/v1/cards/[id]/assign/route.ts` — `POST` assign.
- `apps/web/src/app/api/v1/cards/[id]/block/route.ts` — `POST` block.
- `apps/web/src/app/api/v1/cards/[id]/unblock/route.ts` — `POST` unblock.
- `apps/web/src/app/api/v1/cards/[id]/transitions/route.ts` — `GET` transitions.

**REFACTOR** — share `try/catch` pattern across all routes (the standard F2-02 / F2-04 boilerplate).

## T11. Realtime event constants + snapshot test

**RED** — snapshot test asserts:

```ts
expect(CARD_REALTIME_EVENTS).toEqual({
  created: "card.created",
  updated: "card.updated",
  assigned: "card.assigned",
  blocked: "card.blocked",
  unblocked: "card.unblocked",
});
```

**GREEN** — export `CARD_REALTIME_EVENTS` and `CARD_AUDIT_ENTITY_TYPE = "card"` from `apps/web/src/lib/services/cards.ts`.

**REFACTOR** — none.

## T12. Contract tests file

**RED-then-GREEN** — write the full test file `apps/web/__tests__/api/cards.test.ts` covering:

- 401 without session for every endpoint.
- 403 for viewer where applicable.
- 404 for missing card / goal space / node board.
- 200 with documented response shape for the happy paths.
- 422 for invalid `risk_level` / `priority` / `target_state` / `reason`.
- 409 STATE_CONFLICT for terminal-card block / wrong-state unblock.
- 409 CONFIRMATION_REQUIRED for unblock when a pending confirmation exists.
- Idempotency on `assign` with same `assigned_to`.
- Audit + realtime capture assertions per lifecycle write (using the F2-04 `expectAuditCall` shape).
- Realtime event constants snapshot.

**REFACTOR** — extract helpers if they are repeated three or more times.

## T13. Verification

- `pnpm --filter @keplar/web test -- __tests__/api/cards.test.ts` — green.
- `pnpm --filter @keplar/web test -- __tests__/state-machine/card.test.ts __tests__/authorization/card.test.ts` — green (no F-002 / F-003 regression).
- `pnpm --filter @keplar/web test` — full web suite stays green.
- `pnpm check` — typecheck + lint + test + build + format:check pass with environment warnings only.
- `git diff --check` — clean.

## T14. Delivery artifacts

- `apps/web/.harness/changes/20260619-phase2-card-api/implementation/notes.md` — files changed, reuse summary, deviations, risks, verification.
- `apps/web/.harness/changes/20260619-phase2-card-api/testing/results.md` — test diff and verification matrix.
- `apps/web/.harness/changes/20260619-phase2-card-api/delivery/summary.md` — feature summary + commit message suggestion.
- `apps/web/.harness/changes/20260619-phase2-card-api/handoff.md` — F2-06 / F2-08 handoff with realtime event names + audit entity type constants.

## T15. Update `feature_list.json` + `sprint_progress.md`

- Mark `F2-05` `implementation_status: completed`, `test_status: passed`, `done_status: completed`.
- Update sprint progress phase table: Implementation / Testing / Delivery → Complete.

## Sequencing Rules

- One task at a time. Do not start T(N+1) until T(N) is GREEN + REFACTOR + tests stay green.
- Tests are RED-first — write the failing test, watch it fail, then implement.
- If a deviation from `spec.md` is needed, document it in `implementation/notes.md` immediately and stop if it requires returning to Phase 1 / Phase 2.