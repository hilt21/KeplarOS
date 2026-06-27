# Request Analysis Tasks

Change ID: `20260626-phase3-browser-first-e2e`
Status: pending_human_approval

## Implementation Tasks

- [ ] Rewrite `seedUser` to use `hashPassword("e2e-password")` from `apps/web/src/lib/auth/password.ts` instead of the `'e2e-dummy-hash'` placeholder.
  - Verify: `seedUser` is async; inserts a scrypt-format hash; `verifyPassword` would accept `e2e-password` for the seeded row.
- [ ] Drop direct session-cookie injection (`createSessionCookieValue`, `injectSessionCookie`) from the spec.
  - Verify: `cookieValue` and the `injectSessionCookie(context)` call are removed from the test body.
- [ ] Drop `apiCreateGoalSpace`, `apiCreateNodeBoard`, and `apiCreateCard` from `beforeAll`.
  - Verify: `beforeAll` only seeds the user and warms up the dev server.
- [ ] Drive login via the `/login` UI in the test.
  - Verify: page navigates to `/login`, fills `Email` and `Password`, clicks `Sign in`, waits for `URL` match `/goal-spaces$`.
- [ ] Drive goal-space creation via the `/goal-spaces` UI in the test.
  - Verify: fills `Goal name` with `P3 browser beta`, fills `Description`, clicks `Create goal space`, waits for a link matching `P3 browser beta`, clicks through to the detail page.
- [ ] Drive node-board creation via the goal-space detail page's empty-board form in the test.
  - Verify: fills `Board key` with `MAIN`, fills `Board name`, clicks `Create node board`, waits for `getByTestId("lane-backlog")` to be visible.
- [ ] Keep the command-palette card creation, execute, audit timeline, and SSE-update assertions.
  - Verify: `/create-card E2E verification card` succeeds; card id is captured via `page.waitForResponse(...)`; `/execute <cardId>` produces an audit row; `lane-backlog` remains visible.
- [ ] Update `afterAll` to cancel the UI-created goal space.
  - Verify: `afterAll` calls `/api/v1/goal-spaces/${goalSpaceId}/cancel` with the id obtained from the UI flow.

## Test Tasks

- [ ] Run the rewritten spec under `pnpm --filter @keplar/web e2e`.
  - Verify: 1 passed in the spec run.
- [ ] Run `pnpm --filter @keplar/web typecheck` and `lint`.
  - Verify: both exit 0; no new lint warnings introduced.

## Documentation Tasks

- [ ] Create and maintain required harness artifacts.
  - Verify: `request_analysis/{spec.md,tasks.md,feature_list.json}`, `sprint_progress.md`, `review/findings.md`, `implementation/notes.md`, `testing/results.md`, `delivery/summary.md`, `handoff.md`.

## Sequencing

1. Step: Create request analysis and review artifacts.
   Verify: artifacts exist under the P3-04 change folder.
2. Step: Verify the existing P3-01/P3-02/P3-03 forms are available by running their focused unit tests.
   Verify: login-form, create-goal-space-form, create-node-board-form focused tests all pass.
3. Step: Rewrite `phase2-board.spec.ts`.
   Verify: spec file compiles; typecheck/lint pass.
4. Step: Run `pnpm e2e` against the running dev server.
   Verify: 1 passed; capture command output in `testing/results.md`.
5. Step: Prepare delivery and handoff artifacts.
   Verify: final status, files, risks, and command outcomes are recorded.

## Dependencies

- Existing `/login` page and `LoginForm` from P3-01.
- Existing `CreateGoalSpaceForm` on `/goal-spaces` from P3-02.
- Existing `CreateNodeBoardForm` mounted in `EmptyState.action` from P3-03.
- Existing `hashPassword` and `verifyPassword` helpers in `apps/web/src/lib/auth/password.ts`.
- Existing dev server warm-up loop in the F2-10 spec.
- Running `pnpm dev` instance on `127.0.0.1:3000`.

## Stop Condition

Stop after Phase 1 Request Analysis artifacts are written. Wait for explicit human approval (e.g., "approved", "执行", "继续实现") before starting Phase 3 Implementation. Do not commit.