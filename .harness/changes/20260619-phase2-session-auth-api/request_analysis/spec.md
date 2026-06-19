# Request Analysis Spec

Change ID: `20260619-phase2-session-auth-api`
Status: request_analysis

## Request Summary

Continue the main Phase 2 line at F2-02 Session Auth API from `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`. This feature should introduce login, logout, and current-user API endpoints for the Web Collaboration Beta, along with the session helper surface needed for later route-level auth checks.

The implementation must build on the F2-01 API helper layer without crossing into goal space, board, card, or UI features. It should use the existing password hashing module and the `auth_credentials` table, and it should replace the F2-01 test-only current actor path with a real authenticated-session path for `/api/v1` auth flows.

## Assumptions

- F2-01 is complete and available as the API helper foundation.
- Password verification should reuse `apps/web/src/lib/auth/password.ts`.
- Credential lookup and failed-login bookkeeping should use the existing `auth_credentials` table.
- The current `sessions` table is a run-session model, not a login-session model, so it must not be silently repurposed as user auth storage.
- This feature should stay within the planned F2-02 file set unless a design decision forces a scope amendment.

## Scope

### In Scope

- Create `apps/web/src/lib/auth/session.ts`.
- Create `apps/web/src/app/api/v1/auth/login/route.ts`.
- Create `apps/web/src/app/api/v1/auth/logout/route.ts`.
- Create `apps/web/src/app/api/v1/auth/me/route.ts`.
- Create `apps/web/__tests__/api/auth.test.ts`.
- Modify `apps/web/src/lib/api/request.ts` so shared current-actor extraction uses real session resolution and only falls back to the test header in test runtime.
- Modify `apps/web/src/middleware.ts` only as needed for authenticated API behavior and cookie policy.
- Replace F2-01 test-only current actor usage for auth routes with real current-user resolution.
- Support the interface-spec auth flows:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
- Set and clear an HttpOnly session cookie with the documented expiry semantics.
- Return `expires_at` from login and align auth session TTL to the documented 30-minute contract.
- Update users' `last_login_at` and auth failure counters/lockout fields as needed by the selected auth flow.

### Out of Scope

- Implementing goal space, board, card, confirmation, execution, or SSE routes.
- Adding a brand-new persistent auth session table unless explicitly approved as a scope amendment.
- UI login forms or app pages.
- Database schema or migration changes unless explicitly approved as a scope amendment.
- Changing the baseline harness/runtime beyond auth-specific needs in middleware.

## Affected Areas

- API: `apps/web/src/app/api/v1/auth/*`, `apps/web/src/lib/auth/session.ts`, `apps/web/src/lib/api/request.ts`.
- Data model: existing `users` and `auth_credentials` tables only, unless scope is amended.
- Authorization: current actor extraction for auth endpoints and subsequent route protection.
- UI/UX: none.
- Tests: `apps/web/__tests__/api/auth.test.ts`, existing middleware/auth tests as needed.
- Docs: none required by default unless implementation forces a contract clarification.

## Acceptance Criteria

- [ ] `POST /api/v1/auth/login` returns 200 and sets an HttpOnly session cookie for valid credentials.
- [ ] `POST /api/v1/auth/login` returns 401 for invalid credentials.
- [ ] `GET /api/v1/auth/me` returns the current user when a valid session cookie is present.
- [ ] `POST /api/v1/auth/logout` clears the session cookie.
- [ ] Protected `/api/v1` routes return 401 without a valid authenticated session, using the chosen current-actor resolution path.
- [ ] `POST /api/v1/auth/login` includes `expires_at` and the auth session cookie uses the documented 30-minute expiry.
- [ ] `apps/web/src/lib/auth/session.ts` provides `createSession`, `getSessionActor`, and `clearSessionCookie`.
- [ ] `apps/web/src/lib/api/request.ts` resolves current actor from the authenticated session path and keeps the test header path only as a test-only fallback.
- [ ] Auth behavior uses `auth_credentials` and does not silently repurpose run-session `sessions` rows as login sessions.
- [ ] `pnpm --filter @keplar/web test -- __tests__/api/auth.test.ts __tests__/middleware.test.ts __tests__/auth/password.test.ts` passes.
- [ ] `pnpm check` passes or environment-only warnings are explicitly recorded.
- [ ] No unrelated prior-change files are modified.

## Risks

- Risk: There is no dedicated auth session table in the current schema.
  Mitigation: Treat session storage strategy as an explicit design decision. If a dedicated table is required, pause for a scope amendment instead of silently inventing it.

- Risk: Current middleware hardens all cookies to `SameSite=Strict`, but F2-02 plans `SameSite=Lax` for session cookies.
  Mitigation: Make the cookie-policy decision explicit during review. If `Lax` is required for auth session cookies, middleware must allow that intentionally rather than overriding it accidentally.

- Risk: Current actor extraction could drift between auth routes and later protected routes.
  Mitigation: Keep `getSessionActor()` as the single auth-resolution entry point and have `parseCurrentActor()` defer to it once F2-02 lands, or clearly phase the transition.

- Risk: Dirty workspace state from prior delivered changes could bleed into F2-02.
  Mitigation: Keep the write set limited to auth/session files, `auth.test.ts`, and minimal `middleware.ts` changes.

## Open Questions

- Session storage decision:
  - Option A: signed/encrypted stateless session cookie with no DB-backed auth session table in F2-02.
  - Option B: introduce persistent auth session storage, which would require a scope amendment because no such table exists today.

- Cookie policy decision:
  - Option A: keep current middleware default strictness for most cookies, but explicitly preserve `SameSite=Lax` for the auth session cookie.
  - Option B: standardize on `SameSite=Strict` for auth too, which would diverge from the current F2-02 plan and should be called out explicitly.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
