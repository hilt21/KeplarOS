# Request Analysis Spec

Change ID: `20260626-phase3-login-ui`
Status: approved_for_implementation

## Request Summary

P3-01 adds a compact session login UI for KEPLAR. The UI posts credentials to the existing `POST /api/v1/auth/login` endpoint, relies on that endpoint to set the HttpOnly `keplar_session` cookie, and redirects authenticated users into `/goal-spaces`.

This change is only a UI layer over the existing login API and session cookie behavior.

## Assumptions

- The existing `POST /api/v1/auth/login` contract is authoritative: request `{ email, password }`; success envelope with user and `expires_at`; failure envelope with `error.code` and `error.message`.
- The existing `getSessionActor(request)` helper remains the source of truth for validating `keplar_session`.
- The login UI should use the current dark enterprise dashboard design system and CSS custom property tokens.
- Explicit human approval to implement is present in the P3-01 request.

## Scope

### In Scope

- Create `apps/web/src/components/login-form.tsx` as a client component.
- Create `apps/web/src/app/login/page.tsx` as a server component that redirects valid sessions to `/goal-spaces`.
- Create focused UI tests in `apps/web/src/__tests__/ui/login-form.test.tsx`.
- Create and maintain harness artifacts for this change.

### Out of Scope

- No new auth backend.
- No SSO.
- No role changes.
- No database changes.
- No API contract changes.
- No changes to P3-00 formatting or harness work.
- No P3-02 or later scope.

## Affected Areas

- API: Existing `/api/v1/auth/login` endpoint consumed only; no endpoint changes planned.
- Data model: Not affected.
- Authorization: Existing session validation reused on `/login` server page.
- UI/UX: Adds utilitarian login screen and compact dashboard-style form.
- Tests: Adds login form UI tests.
- Docs: Adds harness artifacts under this change folder.

## Acceptance Criteria

- [ ] Successful submit posts JSON credentials to `/api/v1/auth/login` with `method: "POST"` and `credentials: "include"`.
- [ ] Successful submit calls `router.refresh()` and then `router.push("/goal-spaces")`.
- [ ] API failure envelope renders `envelope.error.message` and does not push.
- [ ] Thrown or network error renders `Unable to sign in.`.
- [ ] Labels are accessible as `Email` and `Password`; idle button text is `Sign in`.
- [ ] `/login` redirects valid sessions to `/goal-spaces`.
- [ ] `/login` renders a compact design-system-compliant login page for anonymous users.
- [ ] No hardcoded hex colors are introduced.

## Risks

- Risk: Current local Node is `v25.2.1`, while `apps/web` requires `>=20.10.0 <21.0.0`.
  Mitigation: Record warning in testing results and do not mark it as a P3-01 failure unless commands fail.
- Risk: Vitest can report a sandbox WebSocket `EPERM` warning while still running tests.
  Mitigation: Record warning and rely on command exit status.
- Risk: Existing unrelated working tree edits from P3-00 could be overwritten accidentally.
  Mitigation: Keep edits within the declared write scope.

## Open Questions

- None. The request explicitly approves implementation and defines the target route, endpoint, and verification commands.

## Approval Gate

Human approval to proceed is included in the P3-01 implementation request.
