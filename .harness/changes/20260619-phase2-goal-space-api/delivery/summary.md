# Delivery Summary

Change ID: `20260619-phase2-goal-space-api`
Status: delivered

## Change Summary

F2-03 Goal Space API is complete. The change adds the seven documented goal space lifecycle REST endpoints to the Web Collaboration Beta, plus a shared `actor.ts` helper that closes the F2-02 follow-up.

## Files Changed

### New

- `apps/web/src/lib/api/actor.ts` — `requireActor` / `requireInitiator` helpers.
- `apps/web/src/lib/db/repositories/goal-spaces.ts` — query / write helpers (`createGoalSpace`, `updateGoalSpace`, `startGoalSpace`, `completeGoalSpace`, `cancelGoalSpace`, `getGoalSpaceById`, `getGoalSpaceWithMembers`, `listGoalSpaces`, `countNodeBoardsForGoalSpace`, `countCardsForGoalSpace`, `readCompletePreconditions`, `readCancelSummary`).
- `apps/web/src/lib/services/goal-spaces.ts` — transactional services for create / list / detail / update / start / complete / cancel.
- `apps/web/src/app/api/v1/goal-spaces/route.ts` — `POST` create, `GET` list.
- `apps/web/src/app/api/v1/goal-spaces/[id]/route.ts` — `GET` detail, `PATCH` update.
- `apps/web/src/app/api/v1/goal-spaces/[id]/start/route.ts` — `POST` start.
- `apps/web/src/app/api/v1/goal-spaces/[id]/complete/route.ts` — `POST` complete.
- `apps/web/src/app/api/v1/goal-spaces/[id]/cancel/route.ts` — `POST` cancel.
- `apps/web/__tests__/api/goal-spaces.test.ts` — TDD coverage (27 tests).

### Modified

- `apps/web/src/lib/api/errors.ts` — added `STATE_CONFLICT` (409), `CONFIRMATION_REQUIRED` (409), `VALIDATION_ERROR` (422).

## Verification Performed

- `pnpm --filter @keplar/web test -- __tests__/api/goal-spaces.test.ts __tests__/state-machine/goal-space.test.ts __tests__/audit/run-with-audit.test.ts __tests__/authorization/goal-space.test.ts` — passed.
- `pnpm check` (typecheck + lint + test + build + format:check) — passed with environment warnings only.
- `git diff --check` — passed.

## Known Risks

- `pnpm` emits Node engine warnings because the local runtime is `v25.2.1`; the package's `.nvmrc` pins Node `20.10.0`.
- `list` service uses N+1 counts for node boards and cards. F2-04 / F2-09 UI work should switch to a grouped aggregate if the list grows.
- `cancel` / `complete` precondition checks happen outside the `runWithAudit` transaction. Single-process runtime is safe; a Postgres migration would need them inside.

## Follow-Ups

- F2-04 should pick up the main line at Node Board / Member API.
- F2-08 SSE filtering must read the `goal_space.*` event type names from `implementation/notes.md`.
- F2-10 Playwright E2E should cover the goal space create / start / complete / cancel happy paths.
- A future refactor of `runWithAudit` to accept a context resolver would let F2-03 drop the pre-generated UUID step.

## Recommended Commit Message

```text
feat(api): add goal space lifecycle endpoints

Implements F2-03: POST/GET/PATCH/goal-spaces plus
start/complete/cancel subroutes. Reuses the goal space state machine,
authorization helpers, runWithAudit transaction, and F2-02 session
actor resolution. Adds a shared actor.ts helper (requireActor /
requireInitiator) that closes the F2-02 follow-up and pins the
goal_space.* realtime event type names for F2-08.
```
