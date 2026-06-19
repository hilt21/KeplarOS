# Request Analysis Spec

Change ID: `20260619-phase2-goal-space-api`
Status: request_analysis

## Request Summary

Continue the main Phase 2 line at F2-03 Goal Space API from `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`. This feature introduces the goal space lifecycle REST API for the Web Collaboration Beta, on top of the existing goal space state machine (`apps/web/src/lib/state-machine/goal-space.ts`), authorization (`canReadGoalSpace` / `canManageGoalSpace`), audit transaction helper (`runWithAudit`), and F2-02 session actor resolution.

The feature must expose the seven documented goal space endpoints, enforce the documented status transitions, write `audit_entries` and `realtime_events` through `runWithAudit`, and return the response shapes defined in `docs/specs/interface_spec.md § 3`. It must not cross into node boards, cards, confirmations, executions, SSE, or UI.

## Assumptions

- F2-02 Session Auth API is complete and `getSessionActor()` returns a real `Actor` (id, role) for authenticated requests.
- The goal space state machine, authorization, audit, and realtime event helpers are unchanged and can be reused as-is.
- F2-02 left an explicit follow-up: "F2-03 may want a shared authenticated-route helper so routes do not duplicate the `getSessionActor() -> user lookup` pattern." F2-03 must introduce a thin shared helper (e.g. `requireInitiator`, `requireActor`) instead of duplicating the resolution pattern in every route handler.
- Goal space list/detail responses include `node_board_counts` and `card_counts` per `docs/specs/interface_spec.md § 3.1`. Counts are derived from existing tables; no new aggregate tables or migrations are required for F2-03.
- The F2-01 test-only actor header fallback in `parseCurrentActor()` remains the route test path; F2-03 must not widen that surface.
- Tests can use the in-memory SQLite + Drizzle + full migration loader from `apps/web/__tests__/__helpers__/sqlite.ts`, but service-level tests may also mock `getDb` to match the F2-02 style and keep the API contract test fast.

## Scope

### In Scope

- Create `apps/web/src/lib/db/repositories/goal-spaces.ts` with focused query/write helpers:
  - `createGoalSpace(input, actor, tx)` — INSERT a draft goal space with the actor as `initiator_id`.
  - `listGoalSpaces(query, actor, db)` — paginated list filtered by `status` and visible to the actor.
  - `getGoalSpaceDetail(id, actor, db)` — single goal space with counts.
  - `updateGoalSpace(id, input, actor, tx)` — PATCH metadata (name, description, constraints, acceptance_criteria) on a `draft` goal space owned by the actor.
  - `getGoalSpaceContext(id, actor, db)` — helper that returns the `GoalSpaceContext` needed by `canReadGoalSpace` / `canManageGoalSpace`.
  - `countCardsForGoalSpace(id, db)` / `countNodeBoardsForGoalSpace(id, db)` — count helpers used by detail/list responses.
- Create `apps/web/src/lib/services/goal-spaces.ts` with transactional application services:
  - `createGoalSpaceService(input, actor, db)` — wraps `createGoalSpace` in `runWithAudit` with `entityType: 'goal_space'`, `action: 'create'`, `realtime type: 'goal_space.created'`.
  - `startGoalSpaceService(id, actor, db)` — calls `assertGoalSpaceTransition('draft', 'active')`, sets `started_at` / `status: 'active'`, writes audit + realtime.
  - `completeGoalSpaceService(id, actor, db)` — gathers complete preconditions (`hasPendingConfirmation`, `hasBlockedCard`, `allCardsDoneOrCancelled`) and calls `assertGoalSpaceTransition('active', 'completed')`, sets `completed_at` / `status: 'completed'`, writes audit + realtime.
  - `cancelGoalSpaceService(id, actor, db, reason)` — calls `assertGoalSpaceTransition(from, 'cancelled')`, sets `cancelled_at` / `cancel_reason` / `status: 'cancelled'`, writes audit + realtime.
  - `updateGoalSpaceService(id, input, actor, db)` — applies metadata updates to a `draft` goal space the actor owns.
- Create a thin shared actor helper module under `apps/web/src/lib/api/actor.ts` exporting `requireActor(request)` (delegates to `getSessionActor` + 401 mapping) and `requireInitiator(request)` (delegates to `requireActor` + 403 mapping) so future routes can compose them. This addresses the F2-02 follow-up.
- Create the documented route handlers:
  - `apps/web/src/app/api/v1/goal-spaces/route.ts` — `POST` create (201), `GET` list (200).
  - `apps/web/src/app/api/v1/goal-spaces/[id]/route.ts` — `GET` detail (200), `PATCH` update (200).
  - `apps/web/src/app/api/v1/goal-spaces/[id]/start/route.ts` — `POST` (200).
  - `apps/web/src/app/api/v1/goal-spaces/[id]/complete/route.ts` — `POST` (200).
  - `apps/web/src/app/api/v1/goal-spaces/[id]/cancel/route.ts` — `POST` (200).
- Create `apps/web/__tests__/api/goal-spaces.test.ts` with API contract coverage for all seven endpoints including the documented authorization, response envelope, status transitions, and audit + realtime event creation.
- All lifecycle writes must use `runWithAudit` with `entityType: 'goal_space'`, `entityId: <goal_space.id>`, `actor: 'human'`, and a `realtime type` of either `goal_space.created`, `goal_space.started`, `goal_space.completed`, `goal_space.cancelled`, or `goal_space.updated`.

### Out of Scope

- Node board, member, card, confirmation, execution, or SSE routes.
- Adding a new aggregate / analytics table for `node_board_counts` or `card_counts`.
- Server-side `start` validation that creates real cards (per `interface_spec.md § 3.5` `cards_generated` field). F2-03 may return `cards_generated: 0` or the current count without implementing template-driven card generation; card creation belongs to a later feature (F2-05).
- Authentication or session storage changes.
- UI or app pages.
- Migration or schema changes; F2-03 uses the existing `goal_spaces`, `node_boards`, `cards`, `users`, `audit_entries`, and `realtime_events` tables.
- Refactoring F2-01 helpers or F2-02 middleware beyond the small `actor.ts` follow-up.

## Affected Areas

- API: `apps/web/src/app/api/v1/goal-spaces/**`, `apps/web/src/lib/services/goal-spaces.ts`, `apps/web/src/lib/db/repositories/goal-spaces.ts`, `apps/web/src/lib/api/actor.ts`.
- Data model: existing `goal_spaces`, `node_boards`, `cards`, `audit_entries`, `realtime_events` only.
- Authorization: `canReadGoalSpace` / `canManageGoalSpace` reuse; no new permission functions.
- UI/UX: none.
- Tests: `apps/web/__tests__/api/goal-spaces.test.ts`; existing `__tests__/state-machine/goal-space.test.ts`, `__tests__/authorization/goal-space.test.ts`, `__tests__/audit/run-with-audit.test.ts` must continue to pass.
- Docs: none required unless implementation reveals a contract gap.

## Acceptance Criteria

- [ ] `POST /api/v1/goal-spaces` returns 201 with the documented `GoalSpaceResponse` and the requester is recorded as `initiator_id`.
- [ ] `POST /api/v1/goal-spaces` returns 401 when no authenticated session is present.
- [ ] `GET /api/v1/goal-spaces` returns 200 with `GoalSpaceListResponse` and respects `status`, `page`, `limit` query parameters.
- [ ] `GET /api/v1/goal-spaces` only returns goal spaces the actor can read (initiator sees own, chain_user/viewer see only goal spaces they have a node-board membership in).
- [ ] `GET /api/v1/goal-spaces/:id` returns 200 with `GoalSpaceDetailResponse` for a readable goal space.
- [ ] `GET /api/v1/goal-spaces/:id` returns 404 for a missing goal space and 403 for an unreadable goal space.
- [ ] `PATCH /api/v1/goal-spaces/:id` returns 200 with the updated `GoalSpaceResponse` and is restricted to the goal space initiator and only on a `draft` goal space.
- [ ] `PATCH /api/v1/goal-spaces/:id` returns 409 when the goal space is not `draft`.
- [ ] `POST /api/v1/goal-spaces/:id/start` returns 200 with the documented `StartGoalSpaceResponse` and only succeeds from `draft`.
- [ ] `POST /api/v1/goal-spaces/:id/start` returns 409 when the goal space is in any other state.
- [ ] `POST /api/v1/goal-spaces/:id/complete` returns 200 with the documented `CompleteGoalSpaceResponse` and only succeeds from `active` with all preconditions met.
- [ ] `POST /api/v1/goal-spaces/:id/complete` returns 409 with `CONFIRMATION_REQUIRED` when there is a pending confirmation, 409 with `STATE_CONFLICT` when any card is blocked, and 422 / 409 with `VALIDATION_ERROR` when not all cards are done or cancelled.
- [ ] `POST /api/v1/goal-spaces/:id/cancel` returns 200 with the documented `CancelGoalSpaceResponse` and only succeeds from `draft` or `active` with a non-empty reason.
- [ ] `POST /api/v1/goal-spaces/:id/cancel` returns 400 when `reason` is missing or empty.
- [ ] `POST /api/v1/goal-spaces/:id/cancel` returns 409 when the goal space is already `completed` or `cancelled`.
- [ ] Every lifecycle write persists exactly one `audit_entries` row and one `realtime_events` row inside a single transaction; failure rolls back the lifecycle write.
- [ ] `apps/web/src/lib/api/actor.ts` exposes `requireActor` and `requireInitiator` and at least one F2-03 route uses each helper to keep the F2-02 follow-up closed.
- [ ] `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts __tests__/state-machine/goal-space.test.ts __tests__/audit/run-with-audit.test.ts` passes.
- [ ] `pnpm check` passes or environment-only warnings are explicitly recorded.
- [ ] `git diff --check` passes.
- [ ] No files outside the F2-03 file set or unrelated prior changes are modified.

## Risks

- Risk: `getGoalSpaceDetail` and `listGoalSpaces` could do N+1 counting of node boards and cards.
  Mitigation: Use `count(*)` aggregate queries and read them as a single round trip; cover the case in tests if needed.

- Risk: `complete` preconditions require `hasPendingConfirmation`, `hasBlockedCard`, and `allCardsDoneOrCancelled`. The service must query these in the same transaction to avoid races.
  Mitigation: Run preconditions inside the `runWithAudit` transaction, with `FOR UPDATE` semantics implied by `better-sqlite3` serialization, and surface the missing keys in the error body when blocked.

- Risk: The F2-02 follow-up helper (`actor.ts`) is small but touches multiple routes. If poorly scoped, it can destabilize F2-02.
  Mitigation: Keep `actor.ts` strictly additive — no changes to `request.ts` or `session.ts` — and reuse it only in F2-03 routes; F2-02 routes stay as-is.

- Risk: The F2-02 review flagged `parseCurrentActor` as test-only fallback. Routes that still need to support F2-01-style test headers must use the test harness, not the test header in production routes.
  Mitigation: F2-03 tests use the documented test harness; production routes rely on real session resolution via `requireActor` / `requireInitiator`.

- Risk: `realtime_events.type` is a free-text field, so the team must commit to a documented type naming pattern now to keep F2-08 SSE filtering consistent.
  Mitigation: Lock the F2-03 realtime type names in this spec (`goal_space.created`, `goal_space.started`, `goal_space.completed`, `goal_space.cancelled`, `goal_space.updated`) and surface them in `implementation/notes.md` for F2-08 to consume.

## Open Questions

- Should the F2-03 cancel flow also flip related `agent_executions` to `cancelled` and reject pending `human_confirmations`? The authorization matrix § 5 implies yes for cancel.
  Proposed decision: F2-03 cancel only writes the goal space status change + audit + realtime, and records the documented `summary` counts. Cascading the child state belongs to F2-05 (cards) and F2-07 (executions); F2-03 will not silently reach into those tables. Escalate if a scope amendment is required.

- Should `complete` enforce that no `agent_executions` are still running?
  Proposed decision: Add the check to the precondition list now only if the team wants the rule in the matrix; otherwise leave it to a future hardening change. Mark this as out of scope for F2-03 unless explicitly approved.

- Should the `node_board_counts` and `card_counts` include soft-deleted rows?
  Proposed decision: Exclude soft-deleted (`deleted_at IS NOT NULL`) rows. Tests should pin this behavior.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
