# Implementation Notes

Change ID: `20260619-phase2-card-api`
Status: implementation_complete

## Files Changed

### New

- `apps/web/src/lib/db/repositories/cards.ts` — query/write helpers (`getCardById`, `getCardContext`, `createCard`, `updateCard`, `updateCardState`, `insertStateTransition`, `nextCardDisplayId`, `listCardsForGoalSpace`, `listTransitionsForCard`, `listConfirmationsForCard`, `listAuditTrailForCard`) plus the `CardRow`, `CreateCardInput`, `UpdateCardInput`, `ListCardsQuery`, `CardContextRow` types.
- `apps/web/src/lib/services/cards.ts` — transactional services for the 8 endpoints, the `CARD_REALTIME_EVENTS` constant map, and the `CARD_AUDIT_ENTITY_TYPE` constant for F2-08.
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/cards/route.ts` — `GET` (list) and `POST` (create).
- `apps/web/src/app/api/v1/cards/[id]/route.ts` — `GET` (detail) and `PATCH` (update metadata).
- `apps/web/src/app/api/v1/cards/[id]/assign/route.ts` — `POST` (assign).
- `apps/web/src/app/api/v1/cards/[id]/block/route.ts` — `POST` (block).
- `apps/web/src/app/api/v1/cards/[id]/unblock/route.ts` — `POST` (unblock).
- `apps/web/src/app/api/v1/cards/[id]/transitions/route.ts` — `GET` (transition history).
- `apps/web/__tests__/api/cards.test.ts` — TDD contract test file (34 tests).

### Modified

- None. F2-05 introduces only new files. No F2-02 / F2-03 / F2-04 / F-002 / F-003 / F-004 files were modified.

## Implementation Summary

The implementation followed strict TDD (RED → GREEN → REFACTOR):

1. **RED** — wrote 34 failing contract tests for the 8 documented endpoints, the membership matrix, the audit + realtime + state_transitions writes, the CONFIRMATION_REQUIRED gate, the terminal-state block guard, and the realtime event constant snapshot.
2. **GREEN** — implemented the repository helpers (one read path for the card authorization context that loads card + members + goal space + pending-confirmation count in 4 queries), the service layer (8 transactional services with `runWithAudit`), and the 7 route handlers. Resolved mock-chain gaps (the route test harness queues results in the exact order the service runs queries; the F2-05 service makes 3-4 context selects per card-level call).
3. **REFACTOR** — ran `prettier --write` on the 9 new files, then ran the verification commands (typecheck + lint + 485 tests + format:check) and `git diff --check`.

### Reuse Notes

- `requireActor` from F2-02's `apps/web/src/lib/api/actor.ts` is used by every F2-05 route. No new auth helper was introduced.
- `canReadCard` / `canMutateCard` from F-003's `apps/web/src/lib/authorization/card.ts` is used by every F2-05 service. The `canMutateCard('unblock')` result already encodes the § 5 mandatory gate (returns false when `hasPendingConfirmation=true`); the service catches this and emits `409 CONFIRMATION_REQUIRED` when the gate fires.
- `runWithAudit` from F-004's `apps/web/src/lib/audit/run-with-audit.ts` wraps every lifecycle write. No new transaction wrapper was introduced.
- `getGoalSpaceWithMembers` from F2-03's repository is used by the list endpoint for the goal-space read check.
- `isTerminalState` from F-002's `apps/web/src/lib/state-machine/card.ts` is used by the block service to guard against blocking terminal cards.
- `apiOk` / `apiCreated` / `apiNoContent` / `apiError` from F2-01's `apps/web/src/lib/api/response.ts` is used by every F2-05 route.

## Deviations from Plan

### Manual block trigger (review F3 fallback)

**Decision:** Reuse the existing `review_failed` trigger with an overridden `actor: 'human'` rather than introducing a new `manual_block` trigger.

**Reasoning:** The review recommended either path; the human approved without specifying which path. The fallback path is non-disruptive — it does not modify F-002's state machine, does not break the F-002 test count assertion (26 tuples), and is reversible by changing one constant in `blockCardService`.

**Trade-off:** The `state_transitions` row for a manual block will have `trigger: 'review_failed'` instead of `trigger: 'manual_block'`. F2-08 SSE filtering sees only the realtime event type (`card.blocked`), which is unchanged. Future maintainers should be aware that the `trigger` column on `state_transitions` does not semantically distinguish "human-initiated block" from "AI-initiated review_failed block". This is a documented deviation; resolving it requires either:
1. Adding `manual_block` to `TRANSITION_TRIGGERS` and `CARD_TRANSITIONS` in F-002 (recommended path, deferred).
2. Adding a column to `state_transitions` for human-vs-AI distinction (out of scope; schema change).

### Card detail endpoint inline reads

**Decision:** `GET /cards/:id` reads `transitions`, `confirmations`, and `audit_trail` (last 50) inline rather than via separate endpoints.

**Reasoning:** The interface spec § 4.3 specifies `CardDetailResponse extends CardResponse` with `transitions`, `confirmations`, `audit_trail`. The detail endpoint executes the same 3 reads the transitions endpoint uses plus a card lookup.

**Trade-off:** The audit_trail is capped at 50 rows (R7 in `review/findings.md`). F2-09 UI should surface the truncation. The transitions endpoint (`GET /cards/:id/transitions`) returns the full history.

### `IllegalTransitionError` mapping (review F1)

**Decision:** `IllegalTransitionError` thrown by `assertTransition` is mapped to `STATE_CONFLICT` (409), not `VALIDATION_ERROR` (422).

**Reasoning:** `IllegalTransitionError.code === 'STATE_CONFLICT'` (per `apps/web/src/lib/state-machine/errors.ts:21`). The error-code map in `apps/web/src/lib/api/errors.ts:15` maps `STATE_CONFLICT` to 409. This is consistent with how F2-03's `cancelGoalSpace` already handles `IllegalTransitionError`. My initial spec text said 422; the review F1 correction aligned the spec with the project's source of truth.

### Priority validation (review F2)

**Decision:** Accept any integer for `priority`. Reject only non-integer or non-number values with `INVALID_FIELD` (400).

**Reasoning:** The interface spec § 1.2 says only "priority 使用整数,数值越大优先级越高" — no explicit range. My initial spec text said "0–4"; the review F2 correction removed the upper bound.

## Risks and Follow-Ups

- **R1** (display_id race). Race-free in S2 because better-sqlite3 is single-threaded. F2-10 E2E will exercise real-DB; S4+ on Postgres may need a sequence.
- **R3** (assign authz). Uses `canMutateCard(actor, 'update', ctx)` per the documented pattern. Pin with a contract test.
- **R4** (realtime names). `card.assigned` is a new event type not in interface_spec.md § 8. F2-08 SSE should read the constants from `services/cards.ts`.
- **R5** (actor_name free text). Pass `actor.id` as `actor_name` (current `Actor` type only carries `id` + `role`). S4+ should join `users.name`.
- **R6** (tags LIKE). Per F-001 SQLite adaptation. S4+ on Postgres should use a JSONB operator.
- **R7** (audit_trail cap 50). Documented. F2-09 UI should surface the truncation.
- **R12** (assign idempotency). Implemented and tested — second assign with same `assigned_to` returns 200 without writing audit_entries / realtime_events.
- **R13** (authz context loaded server-side). Implemented — `getCardContext` performs 4 queries per call. The repository never trusts caller-supplied context.

## Verification Performed

```sh
pnpm --filter @keplar/web test -- __tests__/api/cards.test.ts
# 34 / 34 passed
pnpm --filter @keplar/web test -- __tests__/state-machine/card.test.ts __tests__/authorization/card.test.ts
# 84 + 21 = 105 / 105 passed (no F-002 / F-003 regression)
pnpm --filter @keplar/web test
# 31 files, 485 / 485 passed
pnpm --filter @keplar/web typecheck
# 0 errors
pnpm --filter @keplar/web lint
# 0 errors, 5 pre-existing warnings (F2-03 / F2-04 test files only)
pnpm --filter @keplar/web format:check
# clean
git diff --check
# clean
```

## Recommended Commit Message

```text
feat(api): add card and transition endpoints

Implements F2-05: GET/POST goal-space cards, GET/PATCH cards,
POST/assign, POST/block, POST/unblock, GET/transitions.
Reuses canReadCard / canMutateCard (with § 5 mandatory gate),
assertTransition (with manual-block trigger deviation documented),
and runWithAudit. Pinned card.created / card.updated /
card.assigned / card.blocked / card.unblocked in
CARD_REALTIME_EVENTS for F2-08 SSE filtering.
```