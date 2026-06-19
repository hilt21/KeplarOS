# Review Findings

Change ID: `20260619-phase2-node-board-api`
Status: review

## Recommendation

Proceed.

The F2-04 request analysis maps the six documented endpoints in `docs/specs/interface_spec.md § 3.8` to the existing `node_boards` / `node_board_members` schema, the F-003 authorization helpers (`canReadNodeBoard` / `canManageNodeBoard` / `canManageNodeBoardMembers`), the F2-02 actor helper (`requireActor` / `requireInitiator`), and the F-004 `runWithAudit` transaction wrapper. The scope is bounded, the open questions are non-blocking, and the documented risks (partial unique index, soft-delete re-activation, N+1 list) all have explicit mitigations.

## Blocking Findings

- None.

## Non-Blocking Risks

- Risk: `node_boards.key` has a partial unique index per goal space (`idx_node_boards_goal_space_key_active`). A duplicate-key insert raises a Drizzle UNIQUE error. The spec asks for `409 STATE_CONFLICT`, but Drizzle's default error has no typed shape; the service must map it explicitly.
  Suggested mitigation: The repository's `createNodeBoard` should rely on the database constraint and let the service catch the unique-violation error and re-throw as `ApiRequestError("STATE_CONFLICT", ...)`. The test must cover this branch.

- Risk: `node_board_members` has the same partial unique index (`idx_node_board_members_board_user_active`). Same constraint pattern as above.
  Suggested mitigation: `addNodeBoardMember` must look up an existing member (active or removed) before inserting. If a removed row exists, the service must `reactivateMember` (set `removed_at: null`, update `role`, `invitedBy`, `joinedAt`) instead of inserting. The contract test must cover the re-activation branch and assert no second `node_board_members` row is created.

- Risk: The list endpoint filter for non-initiator actors ("see only boards the actor is a member of") requires a join through `node_board_members`. The repository must use `selectDistinct` (already used in F2-03) to avoid duplicate boards in the result.
  Suggested mitigation: Reuse the F2-03 `selectDistinct` mock pattern in the test harness; add a regression test that asserts a non-initiator actor with membership in two boards receives two distinct rows, not duplicates.

- Risk: Audit and realtime event naming: F2-08 SSE filtering will read the event type names. F2-04 introduces `node_board.created` / `node_board.updated` / `node_board_member.added` / `node_board_member.removed`. They are not in the original interface_spec.md table (§ 8 lists only `card_state_changed`, `goal_space_updated`, etc.), so this is a Phase 2 plan decision rather than a spec-given set.
  Suggested mitigation: Pin the names again in `implementation/notes.md` and the F2-04 handoff document. Add a snapshot test that asserts the exact strings; F2-08 should read the constants from the service module rather than a hard-coded list.

- Risk: The list endpoint for the initiator sees all boards, but the spec authorization matrix says "initiator 返回全部节点". The repository should not apply the membership filter when `actor.role === "initiator"`; it should return the full board list scoped to the goal space. The non-initiator branch must apply the membership filter.
  Suggested mitigation: Branch the SQL in the repository by `actor.role`. Add a contract test that asserts a non-initiator actor who is a member of one board receives exactly that board, not the full set.

- Risk: `PATCH` includes a `status` field with values `active` / `completed` / `archived` (per `docs/specs/interface_spec.md § 3.8`). A wrong value must return `422 VALIDATION_ERROR` rather than `400 INVALID_FIELD` to keep the semantic consistent with the documented "business validation failure" status. The spec uses `INVALID_REQUEST` (400) for general bad input, but `VALIDATION_ERROR` (422) is what the existing error-code map already covers.
  Suggested mitigation: Use `VALIDATION_ERROR` (422) for status validation. The test must assert the status code and code. If the team prefers `INVALID_FIELD` (400), note the deviation in `implementation/notes.md`.

- Risk: The goal space read context for the list endpoint must include the goal space row (for access check) and the goal space's node board membership ids. F2-03 has `getGoalSpaceWithMembers`; F2-04 must use that, not a parallel helper.
  Suggested mitigation: The list service calls `getGoalSpaceWithMembers` first to check `canReadGoalSpace` before listing boards. The repository then queries boards scoped to the goal space. Tests assert that a non-member chain_user on the goal space gets `403` for the list endpoint, not an empty list.

- Risk: The `delete` endpoint must be soft-remove. The implementation must update `removed_at` and must not issue a `DELETE FROM`. A naive `db.delete(nodeBoardMembers).where(...)` would break the partial unique index contract.
  Suggested mitigation: Repository exposes `softRemoveNodeBoardMember` (UPDATE only). Add a regression test that asserts the row is still present in the database with a non-null `removed_at` after the call.

- Risk: The `delete` endpoint's idempotency depends on the "removed_at IS NULL" filter. A second call should be a no-op (204) without re-writing `removed_at`. The repository's soft-remove must either update the row idempotently or return a sentinel for "already removed".
  Suggested mitigation: The repository's soft-remove updates the row regardless (it sets `removed_at` even if already set). The route returns 204 in both cases. Test must assert two consecutive DELETEs both return 204.

## Missing Tests

- Gap: Cross-goal-space defense for board-level routes.
  Suggested test: An initiator of goal space A attempts to read/update board in goal space B and must receive 404 (not 403) per the `canReadNodeBoard` / `canManageNodeBoard` design that compares `ctx.goalSpaceInitiatorId`. The F-003 unit test covers the helper, but a route-level test is missing.

- Gap: Audit + realtime per lifecycle write.
  Suggested test: For each of `createNodeBoard`, `updateNodeBoard`, `addNodeBoardMember`, `softRemoveNodeBoardMember`, assert the `runWithAudit` audit context has the correct `entityType`, `type`, `resourceType`, and `goalSpaceId`. Tests must also assert the `runWithAudit` is wrapped in a transaction.

- Gap: `node_boards.goal_space_id` filter for the list endpoint.
  Suggested test: Two goal spaces each with one board. List endpoint for goal space A must not include goal space B's board.

- Gap: Soft-delete + re-activate round trip.
  Suggested test: Add a member, remove the member, re-add the same member. Assert: (a) the row count in `node_board_members` is still 1; (b) the row's `removed_at` is null after re-add; (c) the response shape matches `NodeBoardMemberResponse`.

- Gap: `status` validation on PATCH.
  Suggested test: Send `status: "deleted"` (invalid value) — assert `422 VALIDATION_ERROR` and no audit/realtime write.

- Gap: `key` validation on POST.
  Suggested test: Missing `key`, empty `key`, non-string `key`, whitespace-only `key`. Assert 400 for all.

- Gap: PATCH on an archived board.
  Suggested test: Move a board to `archived` via PATCH, then PATCH again with a new name. The documented spec does not forbid updating an archived board, so the implementation should allow it. The test should pin this contract (likely 200). If the team chooses to forbid, document the deviation in `implementation/notes.md` and the test must assert 409.

- Gap: Realtime event type snapshot.
  Suggested test: A small test that imports the constants from the service module and asserts the documented event type strings. This protects F2-08 from silent regressions.

## Open Questions

- Question: Should PATCH on a `completed` or `archived` board return 409 (terminal-state lock), or stay open so the initiator can fix metadata?
  Resolution: Stays open in F2-04. The `node_boards.status` set is `active` / `completed` / `archived`, and the spec does not list a transition table. PATCH on any status returns 200. The test pins this. F2-05+ can amend the spec if needed.

- Question: Should the create endpoint accept a seed `members[]` and create `node_board_members` rows in the same transaction?
  Resolution: The spec says `CreateNodeBoardRequest.members?` is optional. F2-04 supports it: when present, the service writes the board and inserts member rows inside the same `runWithAudit` transaction. If absent, the board is created with no members.

- Question: Should the list endpoint paginate, or always return the full set for a goal space?
  Resolution: Always return the full set for a goal space. Boards are bounded per goal space (typically < 20). If pagination becomes necessary, the team can amend the spec.

- Question: Should the detail response include `cards`?
  Resolution: No. The Phase 1 spec is silent; F2-05 owns cards. The detail response mirrors the documented `NodeBoardResponse` shape.

## Reviewed Artifacts

- `.harness/changes/20260619-phase2-node-board-api/request_analysis/spec.md`
- `.harness/changes/20260619-phase2-node-board-api/request_analysis/tasks.md`
- `.harness/changes/20260619-phase2-node-board-api/request_analysis/feature_list.json`
- `.harness/changes/20260619-phase2-node-board-api/sprint_progress.md`

## Sprint Progress Update

Review is complete with recommendation to proceed. F2-04 implementation will:

1. Land the repository helpers first (T1) with the soft-delete re-activation logic in place.
2. Write the failing API contract tests (U1).
3. Implement the service layer (T2) and route handlers (T3–T6) in the order listed in `tasks.md`.
4. Run the full Web verification suite and `git diff --check`.
5. Record realtime event type names in `implementation/notes.md` and `handoff.md` for F2-08.
6. Add a constant export for the realtime event type names and a snapshot test to lock them down for F2-08.
