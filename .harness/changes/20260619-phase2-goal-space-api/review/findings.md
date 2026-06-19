# Review Findings

Change ID: `20260619-phase2-goal-space-api`
Status: review

## Recommendation

Proceed.

The F2-03 request analysis cleanly maps the seven documented endpoints to the existing goal space state machine, authorization helpers, `runWithAudit` transaction wrapper, and F2-02 session actor resolution. The scope is bounded, the open questions are non-blocking, and the explicit F2-02 follow-up (shared actor helper) is closed inside the same feature.

## Blocking Findings

- None.

## Non-Blocking Risks

- Risk: `complete` preconditions (`hasPendingConfirmation`, `hasBlockedCard`, `allCardsDoneOrCancelled`) require queries inside the same transaction as the lifecycle write to avoid a race.
  Suggested mitigation: Run the precondition queries inside `runWithAudit`'s transaction; `better-sqlite3`'s serialization plus the existing `goal_space_id` / `node_board_id` indexes make this safe in the documented runtime.

- Risk: The repository counts (`node_board_counts`, `card_counts`) might do N+1 round trips if the service loads counts lazily.
  Suggested mitigation: Use `count(*)` aggregates in the same query path that fetches the goal space list/detail; tests must cover the populated branch.

- Risk: Realtime event type names are free-text, and the F2-08 SSE feature will filter on them. If F2-03 ships with one set and F2-08 expects another, SSE filtering will silently drop events.
  Suggested mitigation: The spec already pins the names (`goal_space.created`, `goal_space.updated`, `goal_space.started`, `goal_space.completed`, `goal_space.cancelled`); record them again in `implementation/notes.md` so F2-08 can read a single source of truth.

- Risk: The shared `actor.ts` helper could become a magnet for ad-hoc helpers and grow beyond the F2-02 follow-up.
  Suggested mitigation: Keep `actor.ts` strictly to `requireActor` and `requireInitiator`. F2-02 routes stay unchanged; if a future feature needs more, return to Phase 1.

- Risk: `cancel` does not cascade into `agent_executions` or `human_confirmations` in F2-03. The authorization matrix § 5 implies cancel is a terminating operation that should clear related state, but cards/executions belong to F2-05 / F2-07.
  Suggested mitigation: Mark this in `implementation/notes.md` as an explicit F2-03 boundary; F2-05 / F2-07 must consume the goal space cancel event from realtime and reconcile their state.

## Missing Tests

- Gap: The complete precondition matrix is documented (CONFIRMATION_REQUIRED / STATE_CONFLICT / VALIDATION_ERROR) but the test plan only mentions "cover the precondition matrix" once.
  Suggested test: Three explicit tests in `goal-spaces.test.ts`, one per precondition, asserting the documented error code, status, and that no audit / realtime row is written on failure.

- Gap: Authorization boundaries across roles (initiator / chain_user / viewer) for each route.
  Suggested test: For each lifecycle route, add a "non-initiator returns 403" test using the route test harness, plus a "non-member cannot read detail returns 403" test.

- Gap: List filter by `status` and pagination metadata.
  Suggested test: Cover at least `?status=active`, `?page=2&limit=5`, and a default request; assert `total`, `page`, `limit`, and the filtered count.

- Gap: PATCH on a non-draft goal space must return 409.
  Suggested test: Move the goal space to `active` via `start` first, then PATCH, and assert 409.

- Gap: Cancel reason validation.
  Suggested test: Empty string, whitespace-only, and missing key all return 400.

- Gap: Count helpers should exclude soft-deleted rows.
  Suggested test: Insert a goal space with a soft-deleted node board and card, then assert counts ignore the soft-deleted rows.

## Open Questions

- Question: Should `complete` also require that no `agent_executions` are still running?
  Resolution: Stays out of scope for F2-03. The team can amend in a later change if the matrix is updated.

- Question: Should cancel cascade into `agent_executions` / `human_confirmations` in F2-03?
  Resolution: F2-03 cancel only writes the goal space status, audit, and realtime. F2-05 / F2-07 must subscribe to the realtime event to reconcile.

- Question: Should the counts include soft-deleted rows?
  Resolution: Exclude soft-deleted (`deleted_at IS NOT NULL`) rows. Tests should pin this.

## Reviewed Artifacts

- `.harness/changes/20260619-phase2-goal-space-api/request_analysis/spec.md`
- `.harness/changes/20260619-phase2-goal-space-api/request_analysis/tasks.md`
- `.harness/changes/20260619-phase2-goal-space-api/request_analysis/feature_list.json`
- `.harness/changes/20260619-phase2-goal-space-api/sprint_progress.md`

## Sprint Progress Update

Review is complete with recommendation to proceed. F2-03 implementation will:

1. Land `actor.ts` (requireActor / requireInitiator) and a small actor-helper test first.
2. Write failing API contract tests for all seven endpoints.
3. Implement repository, then service, then routes in the order listed in `tasks.md`.
4. Run the full Web verification suite and `git diff --check`.
5. Record realtime event type names in `implementation/notes.md` for F2-08.
