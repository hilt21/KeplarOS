# Request Analysis Spec

Change ID: `20260619-phase2-node-board-api`
Status: request_analysis

## Request Summary

Implement the Node Board and Member REST API surface documented in
`docs/specs/interface_spec.md § 3.8` and the Phase 2 plan (`Task F2-04: Node
Board And Member API`). This delivers the next six endpoints on the
`/api/v1` route tree, with membership-boundary enforcement, lifecycle
audit, and realtime event emission. The work also closes the F2-04
deliverable: a board under a goal space can be created, listed, read,
updated, and have its members added or removed, all with the same thin
route → service → repository shape established by F2-02 and F2-03.

## Assumptions

- `requireActor` / `requireInitiator` from `apps/web/src/lib/api/actor.ts`
  are reused as-is — they are now the single source of truth for
  session/role extraction. F2-04 introduces no new auth plumbing.
- The Phase 1 Drizzle schema (`apps/web/db/schema.ts § 2.3–2.4`) is the
  source of truth for `node_boards` and `node_board_members`. No
  migrations are added in F2-04; we read and write what the schema
  already defines.
- Lifecycle writes (create board, update board, add/remove member) are
  wrapped in `runWithAudit` so the business change, audit entry, and
  realtime event share a single `better-sqlite3` transaction. The
  documented audit requirements (`docs/specs/authorization_matrix.md § 6`)
  require this.
- The Phase 1 authorization helpers (`canReadNodeBoard`,
  `canManageNodeBoard`, `canManageNodeBoardMembers` in
  `apps/web/src/lib/authorization/node-board.ts`) already implement the
  spec. F2-04 invokes them but does not modify them.
- `node_boards` and `node_board_members` rows are treated as
  soft-deleted by `deleted_at` / `removed_at`. Reads filter on these
  columns; writes respect them.
- `node_boards.goal_space_id` is required and ties each board to exactly
  one goal space. The membership-boundary tests already in
  `__tests__/authorization/node-board.test.ts` (per AC-3.4/AC-3.5) cover
  the cross-goal-space defense.
- Realtime event types follow the `node_board.created` /
  `node_board.updated` / `node_board_member.added` /
  `node_board_member.removed` naming convention, all sharing
  `resourceType: "node_board"` (and `node_board_member` for member
  events). F2-08 SSE filtering will read these names.
- The current `actor.ts` shared helper is the project-standard way to
  resolve the authenticated actor; we do not invent a parallel path.

## Scope

### In Scope

- `GET  /api/v1/goal-spaces/:goalSpaceId/node-boards` — list boards
  visible to the actor (initiator sees all, members see those they
  belong to).
- `POST /api/v1/goal-spaces/:goalSpaceId/node-boards` — create a board
  under the goal space (initiator only). Accepts an optional seed
  `members[]` list and writes one audit + one realtime event.
- `GET    /api/v1/node-boards/:id` — read a board the actor can access.
- `PATCH  /api/v1/node-boards/:id` — update `name`, `description`, or
  `status` (initiator only).
- `POST   /api/v1/node-boards/:id/members` — add a member (initiator
  only). Writes audit + realtime.
- `DELETE /api/v1/node-boards/:id/members/:userId` — soft-remove a
  member (initiator only). Sets `removed_at`, writes audit + realtime.
- Repository helpers: `createNodeBoard`, `updateNodeBoard`,
  `addNodeBoardMember`, `softRemoveNodeBoardMember`,
  `getNodeBoardById`, `getNodeBoardWithMembers`,
  `listNodeBoardsForGoalSpace` (with role-based filtering), and a
  `NodeBoardContext` builder for authorization.
- Service functions for each endpoint that combine auth + state
  invariants + audit + realtime.
- New `NodeBoardResponse` and `NodeBoardMemberResponse` types that
  match `docs/specs/interface_spec.md § 3.8`.
- Contract tests covering the full membership matrix (initiator, member,
  non-member, cross goal space) and lifecycle write paths.
- TDD discipline: failing tests first, then minimal implementation, then
  refactor.

### Out of Scope

- Card API (F2-05), confirmation API (F2-06), execution API (F2-07),
  SSE endpoint (F2-08), Web UI (F2-09). These depend on F2-04 and will
  reuse the same shared helpers.
- Card-level reads (a board detail does not include cards in F2-04;
  that belongs to F2-05).
- `display_order` reordering endpoint, bulk member import, role
  hierarchy beyond the documented `owner` / `member` / `viewer` set.
- Real-time push delivery (F2-08). F2-04 only writes
  `realtime_events` rows.
- Cross-goal-space board move or duplicate. Boards are pinned to one
  goal space by `goal_space_id`.
- `node_boards.context` rich payload (UI-only metadata). F2-04 accepts
  and returns no extra context field beyond what the spec documents.
- Migration changes. No schema or migration updates.
- Refactor of `actor.ts` or any F2-02 / F2-03 code.
- New error codes. We reuse the existing `INVALID_JSON`,
  `INVALID_FIELD`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
  `STATE_CONFLICT`, `INTERNAL_ERROR` set from `apps/web/src/lib/api/errors.ts`.

## Affected Areas

- API:
  - 6 new route handlers under `apps/web/src/app/api/v1/`.
  - Service layer in `apps/web/src/lib/services/node-boards.ts`.
  - Repository helpers in `apps/web/src/lib/db/repositories/node-boards.ts`.
- Data model: none (read/write only; no schema changes).
- Authorization: reuse `canReadNodeBoard` / `canManageNodeBoard` /
  `canManageNodeBoardMembers` from F-003.
- UI/UX: none — API only.
- Tests: `apps/web/__tests__/api/node-boards.test.ts` (new, RED-first);
  re-uses the existing `__tests__/api/route-test-harness.ts` and
  `__tests__/__helpers__/sqlite.ts` for in-memory integration.
- Docs: no public doc changes in F2-04. Implementation notes will pin
  the realtime event type names and any deviation from the plan.

## Acceptance Criteria

- [ ] `GET /api/v1/goal-spaces/:goalSpaceId/node-boards` returns
      `200` with a `NodeBoardListResponse` (items + total) — the
      initiator sees all boards in the goal space; non-initiator
      actors only see boards where they are a member.
- [ ] `GET /api/v1/goal-spaces/:goalSpaceId/node-boards` returns
      `401` without a session and `403` if the actor has no access to
      the goal space.
- [ ] `POST /api/v1/goal-spaces/:goalSpaceId/node-boards` returns
      `201` with the documented `NodeBoardResponse` for an initiator,
      `403` for a non-initiator, `400` when `key` or `name` is missing
      or non-string, and `409` when `key` already exists in the goal
      space (partial unique index).
- [ ] `GET /api/v1/node-boards/:id` returns `200` with
      `NodeBoardResponse` when the actor can read the board, `404`
      when the board does not exist, and `403` for a non-member
      non-initiator.
- [ ] `PATCH /api/v1/node-boards/:id` returns `200` with the updated
      `NodeBoardResponse` for the initiator, `403` for non-initiator,
      `404` for missing board, and `422` `VALIDATION_ERROR` for an
      invalid `status` value.
- [ ] `POST /api/v1/node-boards/:id/members` returns `201` with the
      added `NodeBoardMemberResponse` for the initiator, `400` for
      missing `user_id` or `role`, `403` for non-initiator, `404` for
      missing board, and `409` `STATE_CONFLICT` when the user is
      already an active member.
- [ ] `DELETE /api/v1/node-boards/:id/members/:userId` returns `204`
      for the initiator, `403` for non-initiator, `404` for missing
      board or member, and is idempotent on a member that is already
      removed.
- [ ] Every lifecycle write (create, update, add member, remove
      member) writes exactly one `audit_entries` row and one
      `realtime_events` row inside a single `runWithAudit` transaction.
      The audit + realtime event share the goal space id and use
      `resource_type` matching the entity (`node_board` /
      `node_board_member`).
- [ ] `apps/web/src/lib/api/actor.ts` is used by every F2-04 route
      (no F2-02 / F2-03 helper duplication).
- [ ] `pnpm --filter @keplar/web test -- __tests__/api/node-boards.test.ts
      __tests__/authorization/node-board.test.ts` passes.
- [ ] `pnpm check` passes (typecheck + lint + test + build +
      format:check), with environment warnings only.
- [ ] `git diff --check` passes.
- [ ] No files outside the F2-04 file set or unrelated prior changes
      are modified.

## Risks

- Risk: Re-running the in-memory test harness to validate the F2-04
  `runWithAudit` writes may surface the same mock-chain gaps the F2-03
  tests already had to fill.
  Mitigation: Reuse the F2-03 mock patterns (chainable `.from().where().all()`,
  `selectDistinct`, `tx.insert().values().run()` no-op for the audit
  and realtime inserts). Document any new gap in
  `implementation/notes.md`.

- Risk: `canReadNodeBoard` for the goal-space list endpoint must
  distinguish "initiator sees all" from "non-initiator sees their
  member boards". The service must read goal-space membership via
  `getNodeBoardWithMembers` and pass it to the authorization context
  the same way F2-03 did.
  Mitigation: Reuse the F2-03 `getGoalSpaceWithMembers` + per-board
  membership query pattern; do not invent a new context resolver.

- Risk: `node_boards.key` has a partial unique index per goal space
  (`idx_node_boards_goal_space_key_active`). A race could surface as
  an unhandled UNIQUE constraint error from Drizzle.
  Mitigation: Map the Drizzle error to `STATE_CONFLICT` 409 with a
  descriptive message; add a contract test for the duplicate-key path.

- Risk: `node_board_members` has its own partial unique index
  (`idx_node_board_members_board_user_active`) that blocks duplicate
  active memberships. Same constraint pattern as above.
  Mitigation: Map the error to `STATE_CONFLICT` 409; add a test.

- Risk: Soft-deleting a member must be reversible (re-adding the same
  user). Naively, the `idx_node_board_members_board_user_active` unique
  index prevents re-adding because the soft-deleted row is still
  present.
  Mitigation: Before insert, look up an existing member row (active or
  removed). If the row is removed, reactivate it in the same
  transaction; otherwise, insert. Document this in
  `implementation/notes.md`.

- Risk: The `delete` endpoint is documented as "soft remove" per spec
  § 3.8 DELETE behavior. A naive implementation that issues a
  `DELETE FROM` would break the index contract.
  Mitigation: `softRemoveNodeBoardMember` updates `removed_at` only;
  add a regression test that asserts the row still exists.

## Open Questions

- None blocking. All endpoints are derived directly from the
  documented contract. The four "soft delete vs hard delete" and
  "duplicate key mapping" decisions are recorded under Risks with the
  chosen mitigation.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
