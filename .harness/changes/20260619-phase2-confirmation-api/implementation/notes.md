# Implementation Notes

Change ID: `20260619-phase2-confirmation-api`
Status: implementation_complete

## Files Changed

### New

- `apps/web/src/lib/db/repositories/confirmations.ts` — query/write helpers (`getConfirmationById`, `getConfirmationContext`, `listConfirmationsForActor`, `updateConfirmationDecision`) plus the `ConfirmationRow`, `ConfirmationListRow`, `ConfirmationContextRow`, `DecisionUpdateInput` types.
- `apps/web/src/lib/services/confirmations.ts` — 2 transactional services + `HUMAN_CONFIRMATION_REALTIME_EVENTS` constant map + `HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE` and `HUMAN_CONFIRMATION_REALTIME_RESOURCE_TYPE` constants for F2-08.
- `apps/web/src/app/api/v1/confirmations/route.ts` — `GET` (list accessible confirmations).
- `apps/web/src/app/api/v1/confirmations/[id]/decide/route.ts` — `POST` (approve or reject).
- `apps/web/__tests__/api/confirmations.test.ts` — TDD contract test file (14 tests).

### Modified

- None. F2-06 introduces only new files. No F2-02 / F2-03 / F2-04 / F2-05 / F-002 / F-003 / F-004 files were modified.

## Implementation Summary

The implementation followed strict TDD (RED → GREEN → REFACTOR):

1. **RED** — wrote 14 failing contract tests for the 2 documented endpoints, the membership matrix, the audit + realtime + state_transitions writes, the § 5 mandatory gate (already-decided, non-initiator), the terminal-state defensive guard, and the realtime event constant snapshot.
2. **GREEN** — implemented the repository helpers (one joined query for `getConfirmationContext`, paginated list with single SQL join), the service layer (2 services with `runWithAudit`), and the 2 route handlers. Resolved mock-chain gaps as in F2-05.
3. **REFACTOR** — ran `prettier --write` on the 5 new files, then ran typecheck + lint + 499 tests + format:check and `git diff --check`.

### Reuse Notes

- `requireActor` from F2-02's `apps/web/src/lib/api/actor.ts` is used by every F2-06 route.
- `canDecideConfirmation` from F-003's `apps/web/src/lib/authorization/confirmation.ts` is used by the decide service. The helper already encodes two invariants: (1) only the goal-space initiator can decide; (2) only `status === 'pending'` confirmations are decidable.
- `runWithAudit` from F-004's `apps/web/src/lib/audit/run-with-audit.ts` wraps every decision write.
- `parsePagination` from F2-02's `apps/web/src/lib/api/pagination.ts` is used by the list endpoint.
- `insertStateTransition`, `updateCardState` from F2-05's repository are reused for the decision write's card side-effects.
- `isTerminalState`, `isValidState` from F-002's state-machine module are used by the decide service for the defensive guards.

## Deviations from Plan

### Human decision bypass of state-machine tuple restriction

**Decision:** The decide service uses `isValidState(target_state)` to validate the approve target, NOT `assertTransition`.

**Reasoning:** The F-002 `CARD_TRANSITIONS` table contains only one `(X, Y, human_confirm)` tuple: `(review, done)`. If F2-06 enforced `assertTransition`, then approving a confirmation with `target_state = 'todo'` (or any non-`done` state) would fail with `IllegalTransitionError`. This contradicts the interface spec § 6.2 literal text: "确认通过后,卡片流转到确认记录中的 `target_state`" — the target is honored regardless of the F-002 (from, to, trigger) tuple.

The deviation is documented in the service JSDoc and `review/findings.md` R-fix F2. The practical effect: human approvals are explicitly more permissive than AI transitions, which matches the design intent (humans can override the state machine).

### Defensive terminal-state guard (review F2)

**Decision:** The decide service checks `isTerminalState(cardState)` before any state transition.

**Reasoning:** `assertTransition` already short-circuits to false for terminal `from` states, but the F-06 review F2 wants explicit pre-check that produces a clear 409 message. The check returns `STATE_CONFLICT` if the card is in `done` or `cancelled`.

### Defensive card-deleted guard (review R5)

**Decision:** `getConfirmationContext` returns `null` when the card or goal space has a non-null `deleted_at`.

**Reasoning:** Soft-deleted cards have `deleted_at` set; their `state` may still be queried. Returning `null` from `getConfirmationContext` produces a clean 404 NOT_FOUND from the service.

### Audit action verbs

**Decision:** Audit `action` is `'approve'` / `'reject'` (verbs), not `'approved'` / `'rejected'` (nouns matching the `outcome` field).

**Reasoning:** Past-tense verbs are consistent with F2-05's audit conventions (`block`, `unblock`, `assign`, `create`, `update`). The realtime `type` uses the present-tense nouns (`human_confirmation.approved` / `human_confirmation.rejected`) per the documented realtime event naming convention.

## Risks and Follow-Ups

- **R4**: `audit_entries.entity_type = 'confirm'` vs `realtime_events.resource_type = 'confirmation'` — existing schema inconsistency preserved. Documented for F2-08.
- **R5**: Defensive card-deleted guard returns 404. Real production behavior: soft-deleted cards can't be decided. Documented.
- **R7**: `decidedAt` and `resolvedAt` are set to the same timestamp on approve/reject. Documented.
- **R10**: Partial unique index `idx_human_confirmations_card_pending` enforces at most one `pending` confirmation per card. F2-07 must respect this when creating confirmations.
- **R11**: No `DELETE /confirmations/:id` endpoint in F2-06. Cancellation flows through F2-07 (and possibly a future `cancel` confirmation action).

## Verification Performed

```sh
pnpm --filter @keplar/web test -- __tests__/api/confirmations.test.ts
# 14 / 14 passed
pnpm --filter @keplar/web test -- __tests__/authorization/confirmation.test.ts
# 9 / 9 passed (no F-003 regression)
pnpm --filter @keplar/web test
# 32 files, 499 / 499 passed
pnpm --filter @keplar/web typecheck
# 0 errors
pnpm --filter @keplar/web format:check
# clean
git diff --check
# clean
```

## Recommended Commit Message

```text
feat(api): add human confirmation endpoints

Implements F2-06: GET /confirmations (list accessible by actor role)
and POST /confirmations/:id/decide (initiator-only approve/reject).
Reuses canDecideConfirmation (F-003, with the § 5 mandatory gate),
isValidState / isTerminalState (F-002, with a documented deviation
that human approvals bypass the (from, to, trigger) tuple restriction
per interface_spec.md § 6.2 literal text), and runWithAudit. Pinned
human_confirmation.approved / human_confirmation.rejected in
HUMAN_CONFIRMATION_REALTIME_EVENTS for F2-08 SSE filtering. Audit
uses entity_type 'confirm' (per existing schema enum); realtime
uses resource_type 'confirmation' (per existing schema enum).
```