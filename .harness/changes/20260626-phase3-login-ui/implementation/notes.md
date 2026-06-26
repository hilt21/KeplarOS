# Implementation Notes

Change ID: `20260626-phase3-login-ui`
Status: completed

## Files Changed

- `apps/web/src/__tests__/ui/login-form.test.tsx`
- `apps/web/src/components/login-form.tsx`
- `apps/web/src/app/login/page.tsx`
- `.harness/changes/20260626-phase3-login-ui/**`

## Implementation Summary

- Added a RED-first login form test covering successful login routing and API error rendering.
- Added `LoginForm` as a client component.
  - Posts `{ email, password }` to `/api/v1/auth/login`.
  - Uses `method: "POST"` and `credentials: "include"`.
  - Calls `router.refresh()` then `router.push("/goal-spaces")` after a successful envelope.
  - Renders API failure messages from `envelope.error.message`.
  - Renders `Unable to sign in.` for thrown or network errors.
- Added `/login` as a server page.
  - Reads `keplar_session` with `cookies()`.
  - Validates the cookie through existing `getSessionActor(request)`.
  - Redirects valid sessions to `/goal-spaces`.
  - Renders the compact login form for anonymous users.
- Kept styling utilitarian and dashboard-oriented, using CSS custom property token references and no hardcoded hex colors.

## Scope Notes

- P3-01 only adds login UI over the existing `/api/v1/auth/login` endpoint.
- No new auth backend.
- No SSO.
- No role changes.
- No DB changes.
- No API changes.
- No P3-02+ behavior.

## Deviations

- None.

## Remaining Risks

- Current local Node is `v25.2.1`; `apps/web` declares `>=20.10.0 <21.0.0`.
- Vitest emits a sandbox WebSocket `EPERM` warning before completing successfully.
- Lint still reports 14 pre-existing warnings in unrelated files.
