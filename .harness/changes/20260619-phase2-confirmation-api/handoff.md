# Handoff

Change ID: `20260619-phase2-confirmation-api`
Status: delivered

## Current State

F2-06 Human Confirmation API is complete and verified.

Delivered files:

- `apps/web/src/lib/db/repositories/confirmations.ts`
- `apps/web/src/lib/services/confirmations.ts`
- `apps/web/src/app/api/v1/confirmations/route.ts`
- `apps/web/src/app/api/v1/confirmations/[id]/decide/route.ts`
- `apps/web/__tests__/api/confirmations.test.ts`

No existing F2-02 / F2-03 / F2-04 / F2-05 / F-002 / F-003 / F-004 files were modified.

## Important Evidence

- Targeted F2-06 tests pass (14 new + 9 F-003 = 23 related tests; full web suite at 499).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.
- The shared `actor.ts` helper is reused by every F2-06 route — no F2-02 / F2-03 / F2-04 / F2-05 helper duplication.

## Remaining Environment Caveats

- The machine is still on Node `v25.2.1`; exact Node `20.10.0` parity has not yet been demonstrated.
- `pnpm` engine warnings remain until the local Node runtime matches `.nvmrc`.
- Vitest emits a WebSocket `EPERM` warning in this environment, but tests still pass.
- `pnpm check` (which includes `pnpm build`) was not run end-to-end; equivalent lighter verifications passed. F2-10 E2E phase will exercise the full check.

## Realtime Event Type Names (handed off to F2-08)

`realtime_events.type` values now in use by F2-06:

- `human_confirmation.approved`
- `human_confirmation.rejected`

`resourceType` is `"confirmation"` for all confirmation events. `goalSpaceId` is the parent goal space's id (required for SSE permission filtering). `resourceId` is the confirmation id.

These constants are exported from `apps/web/src/lib/services/confirmations.ts` as `HUMAN_CONFIRMATION_REALTIME_EVENTS`. F2-08 should import them rather than hard-coding the strings — a snapshot test in `confirmations.test.ts` will catch any drift.

## Audit Entity Type (handed off to F2-08)

`audit_entries.entity_type` value now in use by F2-06:

- `confirm` (matches the existing `ENTITY_TYPE_VALUES` enum literal union in `apps/web/db/schema.ts § 2.9`)

Exported as a constant: `HUMAN_CONFIRMATION_AUDIT_ENTITY_TYPE = "confirm" as const` from `apps/web/src/lib/services/confirmations.ts`.

**Note on existing schema inconsistency:** audit uses `'confirm'`, realtime uses `'confirmation'`. F2-08 must handle both strings when filtering SSE streams.

## Recommended Next Step

Resume the main Phase 2 line at **F2-07 (Deterministic AI Lane Executor API)**. F2-07 should:

- **Create** `human_confirmations` rows when an AI role's fixture executor produces high-risk (`trigger_type: 'high_risk'`) or low-confidence (`trigger_type: 'low_confidence'`) output.
- Set `target_state` based on the role's transition logic (e.g., `Backlog Refiner` → `target_state: 'todo'`, `Dev Crafter` → `target_state: 'review'`, `Review Guard` → `target_state: 'done'`).
- Respect the partial unique index `idx_human_confirmations_card_pending` (at most one pending confirmation per card).
- Use `runWithAudit` for the create-side audit + realtime.
- Consume `human_confirmation.approved` / `human_confirmation.rejected` realtime events from F2-06 to update fixture state and possibly trigger downstream AI role execution.
- Export confirmation-side realtime event constants from `apps/web/src/lib/services/executions.ts` for F2-08 (e.g., `agent_execution.queued`, `agent_execution.completed`, `agent_execution.failed`).

The realtime event type names listed above are the single source of truth for F2-08 SSE filtering.