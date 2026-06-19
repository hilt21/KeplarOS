# Handoff

Change ID: `20260619-phase2-goal-space-api`
Status: delivered

## Current State

F2-03 Goal Space API is complete and verified.

Delivered files:

- `apps/web/src/lib/api/actor.ts`
- `apps/web/src/lib/api/errors.ts` (modified — new error codes)
- `apps/web/src/lib/db/repositories/goal-spaces.ts`
- `apps/web/src/lib/services/goal-spaces.ts`
- `apps/web/src/app/api/v1/goal-spaces/route.ts`
- `apps/web/src/app/api/v1/goal-spaces/[id]/route.ts`
- `apps/web/src/app/api/v1/goal-spaces/[id]/start/route.ts`
- `apps/web/src/app/api/v1/goal-spaces/[id]/complete/route.ts`
- `apps/web/src/app/api/v1/goal-spaces/[id]/cancel/route.ts`
- `apps/web/__tests__/api/goal-spaces.test.ts`

## Important Evidence

- Targeted goal space / state machine / audit / authorization tests pass (414 total in the web package, 27 new in `goal-spaces.test.ts`).
- `pnpm check` passes (typecheck + lint + test + build + format:check) with environment warnings only.
- `git diff --check` passes.
- The shared `actor.ts` helper closes the F2-02 follow-up without modifying any F2-02 routes or middleware.

## Remaining Environment Caveats

- The machine is still on Node `v25.2.1`; exact Node `20.10.0` parity has not yet been demonstrated.
- `pnpm` engine warnings remain until the local Node runtime matches `.nvmrc`.
- Vitest emits a WebSocket `EPERM` warning in this environment, but tests still pass.

## Realtime Event Type Names (handed off to F2-08)

`realtime_events.type` values now in use:

- `goal_space.created`
- `goal_space.updated`
- `goal_space.started`
- `goal_space.completed`
- `goal_space.cancelled`

All share `resourceType: "goal_space"`.

## Recommended Next Step

Resume the main Phase 2 line at F2-04 Node Board / Member API. Reuse `requireActor` / `requireInitiator` from `apps/web/src/lib/api/actor.ts` and the `runWithAudit` / `canReadNodeBoard` / `canMutateNodeBoard` helpers instead of inventing a new auth path.
