# Handoff

Change ID: `20260619-phase2-execution-api`
Status: delivered

## Current State

F2-07 Deterministic AI Lane Executor API is complete and verified.

Delivered files:

- `apps/web/src/lib/execution/roles.ts`
- `apps/web/src/lib/execution/fixture-executor.ts`
- `apps/web/src/lib/db/repositories/executions.ts`
- `apps/web/src/lib/services/executions.ts`
- `apps/web/src/app/api/v1/cards/[id]/execute/route.ts`
- `apps/web/src/app/api/v1/execute/[taskId]/route.ts`
- `apps/web/__tests__/api/executions.test.ts`

No existing F2-02 / F2-03 / F2-04 / F2-05 / F2-06 / F-002 / F-003 / F-004 files were modified.

## Important Evidence

- Targeted F2-07 tests pass (12 new + 84 F-002 + 21 F-003 = 117 related tests; full web suite at 511).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## Remaining Environment Caveats

- The machine is still on Node `v25.2.1`; exact Node `20.10.0` parity has not yet been demonstrated.
- `pnpm check` (which includes `pnpm build`) was not run end-to-end; F2-10 E2E phase will exercise the full check.

## Realtime Event Type Names (handed off to F2-08)

`realtime_events.type` values now in use by F2-07:

- `agent_execution.queued`
- `agent_execution.completed`
- `agent_execution.failed`
- `agent_execution.needs_confirmation`

`resourceType` is `"agent_execution"` for all execution events. `goalSpaceId` is the parent goal space's id (required for SSE permission filtering). `resourceId` is the agent_executions row id (`task_id`).

These constants are exported from `apps/web/src/lib/services/executions.ts` as `AGENT_EXECUTION_REALTIME_EVENTS`. F2-08 should import them rather than hard-coding the strings — a snapshot test in `executions.test.ts` will catch any drift.

## Audit Entity Type (handed off to F2-08)

`audit_entries.entity_type` value now in use by F2-07:

- `agent_execution` (matches the existing `ENTITY_TYPE_VALUES` enum literal union in `apps/web/db/schema.ts § 2.9`)

Exported as a constant: `AGENT_EXECUTION_AUDIT_ENTITY_TYPE = "agent_execution" as const` from `apps/web/src/lib/services/executions.ts`.

## Role Registry (handed off to F2-09)

The 6 documented AI roles are exported from `apps/web/src/lib/execution/roles.ts`:

```typescript
export const AGENT_ROLES = [
  "Backlog Refiner",
  "Todo Orchestrator",
  "Dev Crafter",
  "Review Guard",
  "Done Reporter",
  "Blocked Resolver",
] as const;
```

F2-09 UI should consume `AGENT_ROLE_VALUES` for the role selector in the "Execute" button UI.

## Confirmation Interaction (handed off to F2-09)

When `Review Guard` outputs `needs_confirmation`, F2-07 creates a `human_confirmations` row with:

- `trigger_type: 'high_risk' | 'low_confidence' | 'external_write'` (per the role's logic)
- `target_state: 'done' | 'review' | ...` (per the role's transition)
- `expiresAt: now + 24h`

The card's state is NOT changed by F2-07 — the state change is deferred to F2-06's approval endpoint.

F2-09 UI should:
- Display the "Awaiting confirmation" state when the execution status is `needs_confirmation`.
- Link to the F2-06 confirmation list endpoint (`GET /confirmations?status=pending`).
- When the initiator approves (via F2-06), the card transitions to `target_state` and the realtime event `human_confirmation.approved` fires.

## Recommended Next Step

Resume the main Phase 2 line at **F2-08 (SSE Dashboard Endpoint)**. F2-08 should:

- Read `AGENT_EXECUTION_REALTIME_EVENTS` from F2-07's service module.
- Read `HUMAN_CONFIRMATION_REALTIME_EVENTS` from F2-06's service module.
- Read `CARD_REALTIME_EVENTS` from F2-05's service module.
- Read `NODE_BOARD_REALTIME_EVENTS` from F2-04's service module.
- Read `GOAL_SPACE_REALTIME_EVENTS` from F2-03's service module.
- Filter SSE streams by per-actor accessibility (initiator sees all; chain_user / viewer see only their goal spaces / cards).
- Support `Last-Event-ID` replay.

The realtime event type names listed above are the single source of truth for F2-08 SSE filtering.