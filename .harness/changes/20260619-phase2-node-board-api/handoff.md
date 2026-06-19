# Handoff

Change ID: `20260619-phase2-node-board-api`
Status: delivered

## Current State

F2-04 Node Board and Member API is complete and verified.

Delivered files:

- `apps/web/src/lib/db/repositories/node-boards.ts`
- `apps/web/src/lib/services/node-boards.ts`
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route.ts`
- `apps/web/src/app/api/v1/node-boards/[id]/route.ts`
- `apps/web/src/app/api/v1/node-boards/[id]/members/route.ts`
- `apps/web/src/app/api/v1/node-boards/[id]/members/[userId]/route.ts`
- `apps/web/__tests__/api/node-boards.test.ts`

No existing F2-02 / F2-03 / F-003 / F-004 files were modified.

## Important Evidence

- Targeted node board / authorization tests pass (37 new + 8 F-003 = 45; full web suite at 451).
- `pnpm check` passes (typecheck + lint + test + build + format:check) with environment warnings only.
- `git diff --check` passes.
- The shared `actor.ts` helper is reused by every F2-04 route — no F2-02 / F2-03 helper duplication.

## Remaining Environment Caveats

- The machine is still on Node `v25.2.1`; exact Node `20.10.0` parity has not yet been demonstrated.
- `pnpm` engine warnings remain until the local Node runtime matches `.nvmrc`.
- Vitest emits a WebSocket `EPERM` warning in this environment, but tests still pass.

## Realtime Event Type Names (handed off to F2-08)

`realtime_events.type` values now in use:

- `node_board.created`
- `node_board.updated`
- `node_board_member.added`
- `node_board_member.removed`

`resourceType` is `"node_board"` for board events and `"node_board_member"` for member events. `goalSpaceId` is the parent goal space's id (required for SSE permission filtering).

These constants are exported from `apps/web/src/lib/services/node-boards.ts` as `NODE_BOARD_REALTIME_EVENTS`. F2-08 should import them rather than hard-coding the strings — a snapshot test in `node-boards.test.ts` will catch any drift.

## Audit Entity Types (handed off to F2-08)

`audit_entries.entity_type` values now in use by F2-04:

- `node_board`
- `node_board_member`

Both values are already in the `ENTITY_TYPE_VALUES` enum literal union (`apps/web/db/schema.ts § 2.9`), so the schema accepts them without a migration.

## Recommended Next Step

Resume the main Phase 2 line at F2-05 (Card and Transition API). F2-05 should:

- Reuse `requireActor` / `requireInitiator` from `apps/web/src/lib/api/actor.ts`.
- Reuse `canReadCard` / `canMutateCard` (already implemented in `apps/web/src/lib/authorization/card.ts`).
- Reuse the F2-04 `listActiveMembersForBoards` to bootstrap default card assignees if desired.
- Consume the `node_board_member.added` realtime event to optionally re-link cards to a newly added member.

The realtime event type names listed above are the single source of truth for F2-08 SSE filtering.
