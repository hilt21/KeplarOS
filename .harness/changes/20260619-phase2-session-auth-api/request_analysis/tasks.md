# Request Analysis Tasks

Change ID: `20260619-phase2-session-auth-api`
Status: request_analysis

## Implementation Tasks

- [ ] Write failing auth API tests in `apps/web/__tests__/api/auth.test.ts`.
  - Verify: targeted auth API tests fail before implementation.

- [ ] Implement `apps/web/src/lib/auth/session.ts`.
  - Verify: auth tests can create, read, and clear session state according to the chosen design.

- [ ] Implement `apps/web/src/app/api/v1/auth/login/route.ts`.
  - Verify: valid credentials set a session cookie; invalid credentials return 401.

- [ ] Implement `apps/web/src/app/api/v1/auth/logout/route.ts`.
  - Verify: logout clears the session cookie.

- [ ] Implement `apps/web/src/app/api/v1/auth/me/route.ts`.
  - Verify: valid session returns current user; missing/invalid session returns 401.

- [ ] Modify `apps/web/src/lib/api/request.ts` so `parseCurrentActor()` resolves from real session actor extraction and uses the test header only as a test-only fallback.
  - Verify: shared actor extraction no longer depends on the test header in non-test runtime.

- [ ] Modify `apps/web/src/middleware.ts` only as needed for session-cookie behavior and protected `/api/v1` auth checks.
  - Verify: middleware tests and auth tests pass without regressing CSRF/origin logic.

## Test Tasks

- [ ] RED: run auth API tests before implementation.
  - Verify: `pnpm --filter @keplar/web test -- __tests__/api/auth.test.ts`

- [ ] GREEN: rerun auth API tests after implementation.
  - Verify: `pnpm --filter @keplar/web test -- __tests__/api/auth.test.ts __tests__/middleware.test.ts __tests__/auth/password.test.ts`

- [ ] Add negative stateless-session coverage for tampered, expired, missing-user cookies, and critical cookie-policy behavior.
  - Verify: targeted auth tests cover the chosen stateless session failure modes.

- [ ] Run full Web verification.
  - Verify: `pnpm check`

- [ ] Run diff hygiene checks.
  - Verify: `git diff --check`

## Documentation Tasks

- [ ] Keep session design explicit and limited to the chosen F2-02 path.
  - Verify: implementation does not silently repurpose run-session `sessions` rows.

- [ ] Keep cookie semantics explicit.
  - Verify: auth cookie behavior matches the approved decision between `SameSite=Lax` and current middleware strictness.

## Sequencing

1. Step: Resolve session-storage and cookie-policy assumptions for F2-02.
   Verify: implementation path is explicit in review/implementation notes.
2. Step: Write failing auth API tests.
   Verify: targeted test run fails for the right reason.
3. Step: Implement session primitives and auth routes.
   Verify: targeted auth tests pass.
4. Step: Update shared current-actor extraction and adjust middleware only as needed.
   Verify: auth and middleware tests pass together.
5. Step: Run `pnpm check`.
   Verify: full Web verification passes or environment warnings are recorded.
6. Step: Record results and follow-ups.
   Verify: testing/results.md and sprint_progress.md are updated during later phases.

## Dependencies

- `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`
- `docs/specs/interface_spec.md`
- `apps/web/src/lib/auth/password.ts`
- `apps/web/src/lib/api/request.ts`
- `apps/web/src/lib/api/response.ts`
- `apps/web/src/lib/authorization/types.ts`
- `apps/web/db/schema.ts`
- `apps/web/db/migrations/0011_auth_credentials.sql`
- `apps/web/src/middleware.ts`

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
