# Request Analysis Tasks

Change ID: `20260619-phase2-node-board-api`
Status: request_analysis

## Implementation Tasks

- [ ] T1. Create `apps/web/src/lib/db/repositories/node-boards.ts`
      with read/write helpers:
      `createNodeBoard`, `updateNodeBoard`, `getNodeBoardById`,
      `getNodeBoardWithMembers`, `listNodeBoardsForGoalSpace`,
      `findActiveMember`, `reactivateMember`, `addNodeBoardMember`,
      `softRemoveNodeBoardMember`, `buildNodeBoardContext`.
      Verify: `pnpm --filter @keplar/web tsc --noEmit` reports no new errors.

- [ ] T2. Create `apps/web/src/lib/services/node-boards.ts` exposing:
      `listNodeBoardsForGoalSpaceService`,
      `createNodeBoardService`,
      `getNodeBoardDetailService`,
      `updateNodeBoardService`,
      `addNodeBoardMemberService`,
      `removeNodeBoardMemberService`.
      Each service combines auth + state checks + `runWithAudit`.
      Verify: `pnpm --filter @keplar/web tsc --noEmit` reports no new errors.

- [ ] T3. Create `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/node-boards/route.ts`
      with `GET` (list) and `POST` (create).
      Verify: route returns 401 without session, 403 for non-initiator, 201 on create.

- [ ] T4. Create `apps/web/src/app/api/v1/node-boards/[id]/route.ts` with
      `GET` (detail) and `PATCH` (update).
      Verify: route returns 200 on read, 200 on update, 403 for non-initiator, 404 for missing.

- [ ] T5. Create `apps/web/src/app/api/v1/node-boards/[id]/members/route.ts`
      with `POST` (add member). Member id routing is under
      `[id]/members/[userId]/route.ts` (T6).
      Verify: 201 on add, 403 for non-initiator, 400 on missing user_id, 409 on duplicate.

- [ ] T6. Create `apps/web/src/app/api/v1/node-boards/[id]/members/[userId]/route.ts`
      with `DELETE` (soft remove). Returns 204 on success.
      Verify: 204 on remove, 403 for non-initiator, 404 for missing user, idempotent re-remove.

- [ ] T7. Verify that no F2-02 / F2-03 files are modified. Use
      `git diff --name-only HEAD -- apps/web/src/lib/api/actor.ts
      apps/web/src/lib/api/errors.ts apps/web/src/lib/auth/session.ts
      apps/web/src/middleware.ts apps/web/src/lib/api/response.ts
      apps/web/src/lib/api/request.ts apps/web/src/lib/api/pagination.ts
      apps/web/src/lib/audit/run-with-audit.ts apps/web/src/lib/authorization/*.{ts}
      apps/web/src/lib/state-machine/goal-space.ts
      apps/web/src/lib/services/goal-spaces.ts
      apps/web/src/lib/db/repositories/goal-spaces.ts
      apps/web/src/app/api/v1/goal-spaces/**` and confirm the list is
      empty.

## Test Tasks

- [ ] U1. Write the F2-04 contract test file:
      `apps/web/__tests__/api/node-boards.test.ts`. RED-first.
      Cover:
      - List: 401 unauth, 200 paginated for initiator, 200 filtered for member,
        403 for non-member non-initiator, 200 empty when actor has no access.
      - Create: 401 unauth, 403 non-initiator, 400 missing key/name, 201 happy path
        with seed members, 409 duplicate key in same goal space.
      - Detail: 200 readable, 404 missing, 403 non-member.
      - Update: 200 initiator updates name/description/status, 403 non-initiator,
        422 invalid status, 404 missing.
      - Add member: 201 happy path, 400 missing user_id/role, 403 non-initiator,
        404 missing board, 409 duplicate member, 200 re-adding a previously
        removed member.
      - Remove member: 204 happy path, 403 non-initiator, 404 missing user,
        204 idempotent re-remove, 204 removing a user from a different board
        is a 404.
      - Audit + realtime per lifecycle: assert `runWithAudit` is invoked
        with `entityType: "node_board"` / `entityType: "node_board_member"`,
        `type: "node_board.created" | "node_board.updated" |
        "node_board_member.added" | "node_board_member.removed"`,
        and `resourceType` matching the entity.
      Verify: `pnpm --filter @keplar/web test -- __tests__/api/node-boards.test.ts`
      fails with module-not-found errors (RED) before implementation lands.

- [ ] U2. Re-run the F2-04 contract tests after T1–T6 to confirm
      green. Verify: `pnpm --filter @keplar/web test --
      __tests__/api/node-boards.test.ts __tests__/authorization/node-board.test.ts`
      passes with zero failures.

- [ ] U3. Re-run the full web test suite to ensure no F2-02 / F2-03
      regression. Verify:
      `pnpm --filter @keplar/web test` passes with the same or higher
      count (we are adding tests, not removing any).

- [ ] U4. Add a realtime event-name snapshot test (or a constant
      export in the service module) so F2-08 can read the
      `node_board.*` / `node_board_member.*` event names from one
      place. Verify: the test reads the exported constants and pins
      the names.

## Documentation Tasks

- [ ] D1. Write `implementation/notes.md` with: files changed, the
      realtime event type names handed off to F2-08, deviations from
      the plan (notably the soft-delete re-activation logic), risks
      surfaced during implementation, and verification commands run.
      Verify: file exists, lists every modified file, names every
      realtime event type.

- [ ] D2. Write `testing/results.md` with: test diff summary, the
      commands actually run, the verification matrix table, and the
      feature's pass/fail status.
      Verify: file exists, contains a verification matrix with all
      required rows.

- [ ] D3. Write `delivery/summary.md` with: change summary, files
      changed, verification performed, known risks, follow-ups for
      F2-05+ / F2-08, and the recommended commit message.
      Verify: file exists.

- [ ] D4. Write `handoff.md` pointing to F2-05 (Card and Transition
      API) and F2-08 (SSE endpoint) with the realtime event type
      names explicitly listed.
      Verify: file exists and lists every F2-04 event type.

## Sequencing

1. T1 → U1 (RED).
2. T2–T6 + U1.1 (GREEN).
3. U2, U3, U4.
4. T7, D1, D2, D3, D4.
5. Update `feature_list.json` and `sprint_progress.md` to reflect
   `implementation_status: "completed"` and `test_status: "passed"`.
6. Stop. Do not commit unless the human asks for a commit.

## Dependencies

- `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`
- `docs/specs/interface_spec.md § 3.8`
- `docs/specs/authorization_matrix.md § 3, § 4, § 6`
- `apps/web/db/schema.ts § 2.3–2.4` (no schema change required)
- `apps/web/src/lib/authorization/node-board.ts` (reused as-is)
- `apps/web/src/lib/audit/run-with-audit.ts` (reused as-is)
- `apps/web/src/lib/api/actor.ts` (reused as-is)
- `apps/web/src/lib/api/errors.ts`, `response.ts`, `request.ts`,
  `pagination.ts` (reused as-is)
- `apps/web/__tests__/api/route-test-harness.ts` (reused as-is)
- `apps/web/__tests__/__helpers__/sqlite.ts` (reused as-is)
- F2-02 / F2-03 baselines (for pattern alignment)

## Stop Condition

Stop after writing request analysis artifacts and wait for human
approval.
