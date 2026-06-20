# Delivery Summary

Change ID: `20260619-phase2-card-api`
Status: delivered

## Change Summary

F2-05 Card and Transition API is complete. The change adds the seven documented card endpoints (`docs/specs/interface_spec.md § 4`) plus the transitions history endpoint (`§ 5.1`) to the Web Collaboration Beta. Every lifecycle write is wrapped in `runWithAudit` so the business change, audit entry, realtime event, and (for state-changing writes) the `state_transitions` row share a single `better-sqlite3` transaction. Pending human confirmations block the documented `unblock` mutation and return `409 CONFIRMATION_REQUIRED` via the F-003 `canMutateCard('unblock')` gate.

The work reuses the F2-02 actor helper, F-003 authorization helpers, F-002 state-machine module, F2-03 goal-space repository, F2-04 node-board repository, and F-004 `runWithAudit` transaction wrapper. **No new auth, authorization, audit, state-machine, or transaction primitives were introduced.**

## Files Changed

### New

- `apps/web/src/lib/db/repositories/cards.ts` — query / write helpers plus the `CardRow`, `CreateCardInput`, `UpdateCardInput`, `ListCardsQuery`, `CardContextRow` types.
- `apps/web/src/lib/services/cards.ts` — transactional services for the 8 endpoints, the `CARD_REALTIME_EVENTS` constant map, and the `CARD_AUDIT_ENTITY_TYPE` constant for F2-08.
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/cards/route.ts` — `GET` (list) + `POST` (create).
- `apps/web/src/app/api/v1/cards/[id]/route.ts` — `GET` (detail) + `PATCH` (update metadata).
- `apps/web/src/app/api/v1/cards/[id]/assign/route.ts` — `POST` (assign).
- `apps/web/src/app/api/v1/cards/[id]/block/route.ts` — `POST` (block).
- `apps/web/src/app/api/v1/cards/[id]/unblock/route.ts` — `POST` (unblock).
- `apps/web/src/app/api/v1/cards/[id]/transitions/route.ts` — `GET` (transition history).
- `apps/web/__tests__/api/cards.test.ts` — TDD contract tests (34 tests).

### Modified

- None. F2-05 introduces only new files.

## Verification Performed

- `pnpm --filter @keplar/web test -- __tests__/api/cards.test.ts` — 34 / 34 passed.
- `pnpm --filter @keplar/web test -- __tests__/state-machine/card.test.ts __tests__/authorization/card.test.ts` — 84 + 21 = 105 / 105 passed (no F-002 / F-003 regression).
- `pnpm --filter @keplar/web test` — 31 files, 485 / 485 passed (baseline 451 + new 34).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web lint` — 0 errors, 5 pre-existing warnings (F2-03 / F2-04 test files only).
- `pnpm --filter @keplar/web format:check` — clean ("All matched files use Prettier code style!").
- `git diff --check` — clean.

## Known Deviations

- **Manual block trigger** (review F3 fallback path): F2-05 reuses the existing `review_failed` trigger with `actor: 'human'` rather than introducing a new `manual_block` trigger. The state machine change is deferred until the human explicitly resolves Q1 (review/findings.md).
- **`IllegalTransitionError` mapping** (review F1): 409 `STATE_CONFLICT`, not 422 `VALIDATION_ERROR`. The error's `code` field is `STATE_CONFLICT` (per `apps/web/src/lib/state-machine/errors.ts:21`), and the error-code map maps it to 409.

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