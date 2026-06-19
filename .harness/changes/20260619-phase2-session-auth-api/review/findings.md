# Review Findings

Change ID: `20260619-phase2-session-auth-api`
Status: review

## Recommendation

Proceed.

## Blocking Findings

- None.

## Non-Blocking Risks

- Risk: The repo has no dedicated persistent auth-session table, and `sessions` is explicitly modeled as a run-session table.
  Suggested mitigation: Keep F2-02 on a stateless signed session-cookie path rather than silently repurposing `sessions`.

- Risk: Current middleware rewrites all cookies to `SameSite=Strict`, while F2-02 planning text expects auth sessions to use `SameSite=Lax`.
  Suggested mitigation: Adjust middleware narrowly so explicitly set `SameSite=Lax` on the auth session cookie is preserved, while existing hardening remains intact for other cookies.

- Risk: `parseCurrentActor()` is currently test-only and must not remain the production path after F2-02.
  Suggested mitigation: Introduce `getSessionActor()` in `apps/web/src/lib/auth/session.ts` and have auth routes and later protected routes converge on that path.

## Missing Tests

- Gap: The request analysis does not yet spell out failed-login and lockout behavior assertions.
  Suggested test: Cover incrementing `failed_login_attempts`, returning 401 for bad credentials, and honoring `locked_until` if the implementation touches lockout behavior.

- Gap: Cookie-policy interaction with middleware is implicit.
  Suggested test: Add an auth API or middleware assertion proving the auth session cookie keeps the intended `SameSite` setting instead of being overwritten.

## Open Questions

- Session storage decision:
  Resolved for F2-02 implementation assumption: use a stateless signed session cookie backed by existing user/auth credential reads, not the run-session table.

- Cookie policy decision:
  Resolved for F2-02 implementation assumption: preserve `SameSite=Lax` for the auth session cookie while keeping current middleware hardening for other cookies.

## Reviewed Artifacts

- `.harness/changes/20260619-phase2-session-auth-api/request_analysis/spec.md`
- `.harness/changes/20260619-phase2-session-auth-api/request_analysis/tasks.md`
- `.harness/changes/20260619-phase2-session-auth-api/request_analysis/feature_list.json`
- `.harness/changes/20260619-phase2-session-auth-api/sprint_progress.md`

## Sprint Progress Update

Review is complete with recommendation to proceed. F2-02 will assume a stateless signed auth-session cookie and a targeted middleware exception for the auth cookie's `SameSite=Lax` policy.
