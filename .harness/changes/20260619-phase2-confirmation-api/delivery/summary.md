# Delivery Summary

Change ID: `20260619-phase2-confirmation-api`
Status: delivered

## Change Summary

F2-06 Human Confirmation API is complete. The change adds the two documented confirmation endpoints (`docs/specs/interface_spec.md § 6`): `GET /confirmations` for listing accessible confirmations and `POST /confirmations/:id/decide` for the goal-space initiator to approve or reject a pending confirmation. Approval moves the card to the confirmation's `target_state`; rejection moves the card to `blocked` with the reject reason recorded on the confirmation. Every decision write is wrapped in `runWithAudit` so the confirmation status update, audit entry, realtime event, and (for state-changing decisions) the card update + `state_transitions` row share a single `better-sqlite3` transaction.

The work reuses the F2-02 actor helper, F-002 state-machine, F-003 authorization helpers, F2-05 card repository, and F-004 `runWithAudit` transaction wrapper. **No new auth, authorization, audit, state-machine, or transaction primitives were introduced.**

## Files Changed

### New

- `apps/web/src/lib/db/repositories/confirmations.ts` — query/write helpers plus the `ConfirmationRow`, `ConfirmationListRow`, `ConfirmationContextRow`, `DecisionUpdateInput` types.
- `apps/web/src/lib/services/confirmations.ts` — 2 transactional services + `HUMAN_CONFIRMATION_REALTIME_EVENTS`, `HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE`, `HUMAN_CONFIRMATION_REALTIME_RESOURCE_TYPE` constants.
- `apps/web/src/app/api/v1/confirmations/route.ts` — `GET` (list).
- `apps/web/src/app/api/v1/confirmations/[id]/decide/route.ts` — `POST` (decide).
- `apps/web/__tests__/api/confirmations.test.ts` — TDD contract tests (14 tests).

### Modified

- None. F2-06 introduces only new files.

## Verification Performed

- `pnpm --filter @keplar/web test -- __tests__/api/confirmations.test.ts` — 14 / 14 passed.
- `pnpm --filter @keplar/web test -- __tests__/authorization/confirmation.test.ts` — 9 / 9 passed (no F-003 regression).
- `pnpm --filter @keplar/web test` — 32 files, 499 / 499 passed (baseline 485 + new 14).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## Known Deviations

- **Human decision bypass of state-machine tuple restriction**: the decide service uses `isValidState(target_state)` instead of `assertTransition`. Only `(review, done, human_confirm)` is in `CARD_TRANSITIONS`; the spec § 6.2 literal text says "卡片流转到确认记录中的 `target_state`", so human approvals can target any non-terminal state. Documented in `implementation/notes.md`.
- **`'confirm'` audit entity type vs `'confirmation'` realtime resource type**: existing F-001 schema inconsistency preserved (audit uses `'confirm'`, realtime uses `'confirmation'`).
- **Defensive terminal-state guard**: returns 409 STATE_CONFLICT if the card is in `done` / `cancelled`, even though such cards should never have a pending confirmation in practice.

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