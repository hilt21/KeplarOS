# Implementation Notes

Change ID: `20260619-phase2-goal-space-api`
Status: implementation_complete

## Summary

Implemented F2-03 Goal Space API within the approved scope. The change adds the seven documented goal space lifecycle endpoints, the shared `actor.ts` helper that closes the F2-02 follow-up, the goal space repository, the transactional service layer, and the route handlers. Every lifecycle write is wrapped in `runWithAudit` and produces a `goal_space.<event>` realtime event with the goal space's real id.

The implementation stays within the F2-03 design choice: it reuses the existing goal space state machine (`assertGoalSpaceTransition`), the authorization helpers (`canReadGoalSpace` / `canManageGoalSpace`), the audit transaction wrapper, and the F2-02 session actor resolution.

## Realtime Event Type Names (for F2-08)

The following `realtime_events.type` values are now in use and must remain stable so F2-08 SSE filtering can rely on them:

| Type | Triggered by |
|------|--------------|
| `goal_space.created` | `POST /api/v1/goal-spaces` |
| `goal_space.updated` | `PATCH /api/v1/goal-spaces/:id` |
| `goal_space.started` | `POST /api/v1/goal-spaces/:id/start` |
| `goal_space.completed` | `POST /api/v1/goal-spaces/:id/complete` |
| `goal_space.cancelled` | `POST /api/v1/goal-spaces/:id/cancel` |

All events share `resourceType: "goal_space"` and `resourceId: <goal_space.id>`. F2-08 should filter on the `type` field.

## Files Changed

- `apps/web/src/lib/api/actor.ts` (new) — `requireActor` / `requireInitiator` helpers; closes the F2-02 follow-up.
- `apps/web/src/lib/api/errors.ts` (modified) — added `STATE_CONFLICT` (409), `CONFIRMATION_REQUIRED` (409), `VALIDATION_ERROR` (422) to the API error code enum and status map. Kept `CONFLICT` out of the enum (not used by F2-03).
- `apps/web/src/lib/db/repositories/goal-spaces.ts` (new) — focused query/write helpers including `getGoalSpaceWithMembers` (single-call row + members), `countNodeBoardsForGoalSpace`, `countCardsForGoalSpace`, `readCompletePreconditions`, and `readCancelSummary`.
- `apps/web/src/lib/services/goal-spaces.ts` (new) — transactional services for create / list / detail / update / start / complete / cancel.
- `apps/web/src/app/api/v1/goal-spaces/route.ts` (new) — `POST` create, `GET` list.
- `apps/web/src/app/api/v1/goal-spaces/[id]/route.ts` (new) — `GET` detail, `PATCH` update.
- `apps/web/src/app/api/v1/goal-spaces/[id]/start/route.ts` (new) — `POST` start.
- `apps/web/src/app/api/v1/goal-spaces/[id]/complete/route.ts` (new) — `POST` complete.
- `apps/web/src/app/api/v1/goal-spaces/[id]/cancel/route.ts` (new) — `POST` cancel.
- `apps/web/__tests__/api/goal-spaces.test.ts` (new) — TDD coverage for all seven endpoints plus the documented authorization, state-transition, and error-code matrix.

## Feature Status Updates

| Feature ID | Status | Notes |
|-----------|--------|-------|
| F2-03 | implemented | All seven endpoints plus the actor helper. |

## Deviations From Plan

- Deviation: `cancel` and `complete` precondition checks happen outside the `runWithAudit` transaction (queries run on the production `db` before the transaction starts). `better-sqlite3` serializes write transactions in a single process, so the documented runtime is safe; a future migration to Postgres will need to push the preconditions inside the same transaction.
  Approval: Documented in `sprint_progress.md` and `review/findings.md` as a non-blocking risk.

- Deviation: The `GoalSpaceRow` type in the repository mirrors the schema's `Record<string, unknown>[]` typing for `constraints` / `acceptanceCriteria`. The service's `toListItem` converts these to the documented `string[]` / `AcceptanceCriterion[]` response shapes. This is the minimum change to satisfy the schema-vs-spec type mismatch without changing migrations.
  Approval: Documented as a follow-up; future phases can tighten the schema types to match the spec directly.

- Deviation: F2-02 follow-up closure moved into a new `apps/web/src/lib/api/actor.ts` rather than editing `apps/web/src/lib/api/request.ts`. The two helpers (`requireActor` / `requireInitiator`) are thin wrappers that reuse `parseCurrentActor`; F2-02 routes remain unchanged.
  Approval: Explicitly chosen during F2-03 review (`.harness/changes/20260619-phase2-goal-space-api/review/findings.md`).

## Risks And Follow-Ups

- Risk: The N+1 query pattern in `listGoalSpacesService` (one `countNodeBoardsForGoalSpace` + one `countCardsForGoalSpace` per listed row). For a single goal space this is fine; F2-04 or later UI work that lists many goal spaces should switch to a grouped aggregate.
  Mitigation: Documented in the review findings. The tests pin the current behavior.

- Risk: `runWithAudit` writes the audit + realtime event with the goal space id from the audit context. F2-03 pre-generates the UUID via `randomUUID()` so the first write carries the real id. A future refactor of `runWithAudit` to accept a context resolver that reads the inserted id from the tx would remove the pre-generation step.
  Mitigation: Documented in the service comment.

- Risk: The cancel and complete precondition checks happen outside the audit transaction (see Deviations). A multi-process deployment would need them inside the transaction.
  Mitigation: Documented; the documented Phase 2 runtime is single-process.

- Residual environment warning: `pnpm` still emits Node engine warnings because the local runtime is `v25.2.1`; the package's `.nvmrc` pins Node `20.10.0`.

## Verification During Implementation

- Command/check: `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts`
  Result: RED failed before implementation for missing route / service / repository / actor files; GREEN passed after implementation (27 tests, all green).

- Command/check: `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts __tests__/state-machine/goal-space.test.ts __tests__/audit/run-with-audit.test.ts __tests__/authorization/goal-space.test.ts`
  Result: All targeted tests pass.

- Command/check: `pnpm check` (typecheck + lint + test + build + format:check)
  Result: Passed with environment warnings only.

- Command/check: `git diff --check`
  Result: Passed (no patch hygiene issues).

## Sprint Progress Update

Implementation is complete. F2-03 closes the F2-02 follow-up (shared actor helper) and pins the realtime event type names for F2-08. F2-04 Node Board / Member API can resume the main line.
