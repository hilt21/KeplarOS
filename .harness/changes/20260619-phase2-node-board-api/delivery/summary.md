# Delivery Summary

Change ID: `20260619-phase2-node-board-api`
Status: delivered

## Change Summary

F2-04 Node Board and Member API is complete. The change adds the six documented node board and member REST endpoints to the Web Collaboration Beta, with membership-boundary enforcement, lifecycle audit, and realtime event emission. The work reuses the F2-02 actor helper, the F-003 authorization helpers, the F2-03 service / repository patterns, and the F-004 `runWithAudit` transaction wrapper. No new auth, authorization, audit, or transaction primitives were introduced.

## Files Changed

### New

- `apps/web/src/lib/db/repositories/node-boards.ts` — query / write helpers plus the `NODE_BOARD_STATUS_VALUES` enum.
- `apps/web/src/lib/services/node-boards.ts` — transactional services for the 6 endpoints, the `NODE_BOARD_REALTIME_EVENTS` constant map, and the audit entity type constants.
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route.ts` — `GET` (list) and `POST` (create).
- `apps/web/src/app/api/v1/node-boards/[id]/route.ts` — `GET` (detail) and `PATCH` (update).
- `apps/web/src/app/api/v1/node-boards/[id]/members/route.ts` — `POST` (add member).
- `apps/web/src/app/api/v1/node-boards/[id]/members/[userId]/route.ts` — `DELETE` (soft remove).
- `apps/web/__tests__/api/node-boards.test.ts` — TDD contract tests (37 tests).

### Modified

- None. F2-04 introduces only new files. No F2-02 / F2-03 / F-003 / F-004 files were modified.

## Verification Performed

- `pnpm --filter @keplar/web test -- __tests__/api/node-boards.test.ts` — passed (37 / 37).
- `pnpm --filter @keplar/web test -- __tests__/authorization/node-board.test.ts` — passed (8 / 8, F-003 unchanged).
- `pnpm --filter @keplar/web test` — passed (30 files, 451 / 451).
- `pnpm check` (typecheck + lint + test + build + format:check) — passed with environment warnings only.
- `git diff --check` — passed (clean).

## Known Risks

- `pnpm` emits Node engine warnings because the local runtime is `v25.2.1`; the package's `.nvmrc` pins Node `20.10.0`.
- The list endpoint does N+1 member lookups for multi-board goal spaces. F2-09 (UI) should switch to a grouped aggregate if a goal space exceeds ~20 boards.
- `addNodeBoardMember` re-activation is implemented but the contract test does not explicitly cover the "remove then re-add same user" round trip. F2-05 should add the regression test.
- The `node_boards.key` partial unique index is the source of the `STATE_CONFLICT 409` on duplicate create. The repository does not pre-check; the service maps Drizzle's UNIQUE error to `ApiRequestError("STATE_CONFLICT", ...)`.
- PATCH on a board in any status (`active` / `completed` / `archived`) returns 200. The review's open question was resolved in favor of staying open; F2-05+ can amend the spec.

## Follow-Ups

- F2-05 (Card API) should add a "previously removed member is re-added" regression test for the re-activation path.
- F2-05 (Card API) should consume `NODE_BOARD_REALTIME_EVENTS.memberAdded` to seed default card assignees.
- F2-08 (SSE) should import `NODE_BOARD_REALTIME_EVENTS` and `NODE_BOARD_AUDIT_ENTITY_TYPE` from `apps/web/src/lib/services/node-boards.ts` for filtering; the snapshot test will protect against drift.
- F2-09 (Web UI) should add a Playwright happy-path test for node board create + member add + member remove.
- F2-10 (E2E) should run the full Web verification suite under a real Node `20.10.0` runtime when the local environment is corrected.

## Recommended Commit Message

```text
feat(api): add node board and member endpoints

Implements F2-04: GET/POST goal-space node-boards, GET/PATCH node-boards,
POST/DELETE members. Reuses canReadNodeBoard / canManageNodeBoard /
canManageNodeBoardMembers and runWithAudit. Pinned the node_board.* and
node_board_member.* realtime event type names in NODE_BOARD_REALTIME_EVENTS
for F2-08 SSE filtering.
```
