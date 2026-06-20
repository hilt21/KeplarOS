# Handoff

Change ID: `20260619-phase2-card-api`
Status: delivered

## Current State

F2-05 Card and Transition API is complete and verified.

Delivered files:

- `apps/web/src/lib/db/repositories/cards.ts`
- `apps/web/src/lib/services/cards.ts`
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/cards/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/assign/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/block/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/unblock/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/transitions/route.ts`
- `apps/web/__tests__/api/cards.test.ts`

No existing F2-02 / F2-03 / F2-04 / F-002 / F-003 / F-004 files were modified.

## Important Evidence

- Targeted F2-05 tests pass (34 new tests + 84 F-002 + 21 F-003 = 139 related tests; full web suite at 485).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web lint` — 0 errors, 5 pre-existing warnings (F2-03 / F2-04 test files only).
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.
- The shared `actor.ts` helper is reused by every F2-05 route — no F2-02 / F2-03 / F2-04 helper duplication.

## Remaining Environment Caveats

- The machine is still on Node `v25.2.1`; exact Node `20.10.0` parity has not yet been demonstrated.
- `pnpm` engine warnings remain until the local Node runtime matches `.nvmrc`.
- Vitest emits a WebSocket `EPERM` warning in this environment, but tests still pass.
- `pnpm check` (which includes `pnpm build`) was not run end-to-end in this change; equivalent lighter verifications passed. F2-10 E2E phase will exercise the full check.

## Realtime Event Type Names (handed off to F2-08)

`realtime_events.type` values now in use by F2-05:

- `card.created`
- `card.updated`
- `card.assigned`
- `card.blocked`
- `card.unblocked`

`resourceType` is `"card"` for all card events. `goalSpaceId` is the parent goal space's id (required for SSE permission filtering). `resourceId` is the card id.

These constants are exported from `apps/web/src/lib/services/cards.ts` as `CARD_REALTIME_EVENTS`. F2-08 should import them rather than hard-coding the strings — a snapshot test in `cards.test.ts` will catch any drift.

## Audit Entity Type (handed off to F2-08)

`audit_entries.entity_type` value now in use by F2-05:

- `card` (matches the existing `ENTITY_TYPE_VALUES` enum literal union in `apps/web/db/schema.ts § 2.9`)

Exported as a constant: `CARD_AUDIT_ENTITY_TYPE = "card" as const` from `apps/web/src/lib/services/cards.ts`.

## State Transitions (handed off to F2-08)

`state_transitions` rows are now written for block + unblock operations. Key fields:

- `cardId` — the card id (FK to `cards.id`).
- `entityType` — `"card"`.
- `entityId` — the card id (matches `cardId` for card-level transitions).
- `fromState` — the prior state (null on create; `null` not used in F2-05 paths).
- `toState` — the new state.
- `trigger` — `"review_failed"` for block (deviation from F2-05 review F3 fallback path; see `implementation/notes.md`), `"blocked_resolved"` for unblock.
- `actor` — `"human"` for all F2-05-issued transitions.
- `actorName` — currently `actor.id` (free text per `apps/web/db/schema.ts § 2.8`).

## Recommended Next Step

Resume the main Phase 2 line at **F2-06 (Human Confirmation API)**. F2-06 should:

- Reuse `requireActor` / `requireInitiator` from `apps/web/src/lib/api/actor.ts`.
- Reuse `canDecideConfirmation` (already implemented in `apps/web/src/lib/authorization/confirmation.ts`).
- Consume `card.blocked` and `card.unblocked` realtime events from `CARD_REALTIME_EVENTS` to keep the confirmation list fresh.
- On `approve`: move the card to `target_state` (per F-002 `human_confirm` trigger).
- On `reject`: move the card to `blocked` via the existing `human_reject` trigger (per F-002).
- Reuse the `runWithAudit` wrapper for the decision write.
- Export `HUMAN_CONFIRMATION_REALTIME_EVENTS` and `HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE` from `services/confirmations.ts` for F2-08 SSE filtering.

The realtime event type names listed above are the single source of truth for F2-08 SSE filtering.