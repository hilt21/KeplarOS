# Implementation Notes

Change ID: `20260619-phase2-node-board-api`
Status: implementation_complete

## Files Changed

### New

- `apps/web/src/lib/db/repositories/node-boards.ts` — query / write helpers (`createNodeBoard`, `updateNodeBoard`, `insertNodeBoardMember`, `reactivateNodeBoardMember`, `softRemoveNodeBoardMember`, `getNodeBoardById`, `findActiveMember`, `findRemovedMember`, `listActiveMembersForBoard`, `listActiveMembersForBoards`, `listNodeBoardsForGoalSpace`, `getGoalSpaceContextForBoard`, `getNodeBoardWithContext`) plus the `NODE_BOARD_STATUS_VALUES` enum.
- `apps/web/src/lib/services/node-boards.ts` — transactional services for the 6 endpoints, the `NODE_BOARD_REALTIME_EVENTS` constant map, and the `NODE_BOARD_AUDIT_ENTITY_TYPE` / `NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE` constants for F2-08.
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route.ts` — `GET` (list) and `POST` (create).
- `apps/web/src/app/api/v1/node-boards/[id]/route.ts` — `GET` (detail) and `PATCH` (update).
- `apps/web/src/app/api/v1/node-boards/[id]/members/route.ts` — `POST` (add member).
- `apps/web/src/app/api/v1/node-boards/[id]/members/[userId]/route.ts` — `DELETE` (soft remove).
- `apps/web/__tests__/api/node-boards.test.ts` — TDD contract test file (37 tests).

### Modified

- None. F2-04 introduces only new files. No existing F2-02 / F2-03 / F-003 / F-004 files were modified.

## Implementation Summary

The implementation followed strict TDD (RED → GREEN → REFACTOR):

1. **RED** — wrote 37 failing contract tests for the 6 documented endpoints, the membership matrix, the audit + realtime writes, and the realtime event constant snapshot.
2. **GREEN** — implemented the repository helpers, then the service layer, then the 6 route handlers in the order listed in `tasks.md`. Resolved mock-chain gaps (the route test harness queues results in the exact order the service runs queries; the F2-04 service makes 3 context selects per board-level call).
3. **REFACTOR** — ran `prettier --write` on the 5 new files, then `pnpm check` (typecheck + lint + 451 tests + build + format:check) and `git diff --check`.

### Reuse Notes

- `requireActor` / `requireInitiator` from F2-02's `apps/web/src/lib/api/actor.ts` is used by every F2-04 route. No new auth helper was introduced.
- `canReadNodeBoard` / `canManageNodeBoard` / `canManageNodeBoardMembers` from F-003's `apps/web/src/lib/authorization/node-board.ts` is used by the service. No new authorization helper was introduced.
- `runWithAudit` from F-004's `apps/web/src/lib/audit/run-with-audit.ts` wraps every lifecycle write. No new transaction wrapper was introduced.
- `getGoalSpaceWithMembers` from F2-03's repository is used by the list endpoint for the goal-space read check.
- `parsePositiveInteger` / `parsePagination` from F2-02's `apps/web/src/lib/api/pagination.ts` was not needed (the F2-04 list endpoint does not paginate).
- `apiOk` / `apiCreated` / `apiNoContent` / `apiError` from F2-01's `apps/web/src/lib/api/response.ts` is used by every F2-04 route.

## Realtime Event Type Names (F2-08 handoff)

`realtime_events.type` values now in use by F2-04:

- `node_board.created`
- `node_board.updated`
- `node_board_member.added`
- `node_board_member.removed`

All share `resourceType: "node_board"` for board events and `resourceType: "node_board_member"` for member events. `goalSpaceId` is the parent goal space's id (required for SSE permission filtering).

These are exported as constants from `apps/web/src/lib/services/node-boards.ts`:

```ts
export const NODE_BOARD_REALTIME_EVENTS = {
  created: "node_board.created",
  updated: "node_board.updated",
  memberAdded: "node_board_member.added",
  memberRemoved: "node_board_member.removed",
} as const;
```

A snapshot test in `node-boards.test.ts` pins these names so F2-08 cannot silently drift.

## Audit Entity Types (F2-08 handoff)

`audit_entries.entity_type` values now in use by F2-04:

- `node_board` (matches the existing `ENTITY_TYPE_VALUES` enum literal union in `apps/web/db/schema.ts § 2.9`)
- `node_board_member` (also matches the existing enum)

Both are exported as constants:

```ts
export const NODE_BOARD_AUDIT_ENTITY_TYPE = "node_board" as const;
export const NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE = "node_board_member" as const;
```

## Deviations from Plan

- The original `request_analysis/tasks.md` listed the in-memory test file under `__tests__/api/__helpers__/`; this directory was not created. The F2-03 mock harness pattern was reused inline in `node-boards.test.ts` to keep the change surface small and consistent with F2-03.
- The repository's `getGoalSpaceContextForBoard` was initially implemented with a sentinel subselect; this was removed during GREEN because the test harness queueing convention expects one `.select().from()` per query. The final implementation is a direct `select().from(goalSpaces)` plus the distinct members query — 2 queries, no sentinel.
- The list endpoint returns the full set for a goal space (no pagination). The review's open question "Should the list endpoint paginate?" was resolved in favor of no pagination (boards are bounded per goal space).
- The `PATCH` route allows updates on a board in any status (`active` / `completed` / `archived`). The review's open question "Should PATCH on `completed` or `archived` return 409?" was resolved in favor of staying open; the contract test pins this as 200.

## Risks and Follow-Ups

- The `addNodeBoardMember` re-activation path (previously removed → re-add) is implemented but not covered by a contract test. A regression test in F2-05 will pin it.
- The list endpoint does N+1 member lookups for multi-board goal spaces. F2-09 (UI) should monitor and switch to a grouped aggregate if any goal space exceeds ~20 boards.
- `NODE_BOARD_AUDIT_ENTITY_TYPE` and `NODE_BOARD_MEMBER_AUDIT_ENTITY_TYPE` are not in the documented `ENTITY_TYPE_VALUES` enum in the original spec; they are added in F2-04 and the schema enum literal union already supports both values. F2-08 SSE filtering must accept these as valid `resourceType` strings.
- The `members` field in `NodeBoardResponse` is computed on every read; for boards with many members, F2-09 should switch to a paginated member endpoint.
- The `node_boards.key` partial unique index (`idx_node_boards_goal_space_key_active`) is the source of the `STATE_CONFLICT 409` path on duplicate create. The repository does not pre-check; Drizzle's UNIQUE error is mapped to `ApiRequestError("STATE_CONFLICT", ...)` in the service. F2-08 / F2-09 should not assume the error message format.

## Verification Performed

```sh
pnpm --filter @keplar/web test -- __tests__/api/node-boards.test.ts
# 37 / 37 passed
pnpm --filter @keplar/web test
# 30 files, 451 / 451 passed
pnpm check
# typecheck + lint + 451 tests + build + format:check passed
# (one pre-existing F2-03 unused-import warning; no new F2-04 warnings)
git diff --check
# passed (clean)
```

## Recommended Commit Message

```text
feat(api): add node board and member endpoints

Implements F2-04: GET/POST goal-space node-boards, GET/PATCH node-boards,
POST/DELETE members. Reuses canReadNodeBoard / canManageNodeBoard /
canManageNodeBoardMembers and runWithAudit. Pinned the node_board.* and
node_board_member.* realtime event type names in NODE_BOARD_REALTIME_EVENTS
for F2-08 SSE filtering.
```
