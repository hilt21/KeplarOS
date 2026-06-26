# Request Analysis Tasks

Change ID: `20260626-phase3-login-ui`
Status: approved_for_implementation

## Implementation Tasks

- [ ] Add `LoginForm` client component.
  - Verify: Form uses accessible `Email` and `Password` labels, idle submit text `Sign in`, JSON POST to `/api/v1/auth/login`, `credentials: "include"`, and success/error handling.
- [ ] Add `/login` server page.
  - Verify: Valid `keplar_session` redirects to `/goal-spaces`; anonymous users see the login form.
- [ ] Keep styling compact and design-system aligned.
  - Verify: Uses Tailwind arbitrary CSS token references and no hardcoded hex.

## Test Tasks

- [ ] Add RED-first login form tests.
  - Verify: Success calls fetch, `router.refresh()`, and `router.push("/goal-spaces")`; API failure renders message and does not push.
- [ ] Run requested verification.
  - Verify: Record exact command outcomes in `testing/results.md`.

## Documentation Tasks

- [ ] Create required harness artifacts.
  - Verify: Artifacts state P3-01 only adds login UI over existing `/api/v1/auth/login`; no new auth backend, SSO, role, DB, or API changes.

## Sequencing

1. Step: Create request analysis and review artifacts.
   Verify: Required files exist under `.harness/changes/20260626-phase3-login-ui/`.
2. Step: Add RED-first test and run focused test command before implementation.
   Verify: Focused test fails because `LoginForm` does not exist yet.
3. Step: Implement `LoginForm` and `/login` page.
   Verify: Focused test passes and typecheck/lint/format/diff checks run.
4. Step: Update implementation, testing, delivery, and handoff artifacts.
   Verify: `feature_list.json` and `sprint_progress.md` truthfully reflect final status and concerns.

## Dependencies

- Existing `POST /api/v1/auth/login` route.
- Existing `getSessionActor(request)` helper.
- Existing Next.js `cookies()` and `redirect()` APIs.
- Existing Vitest + React Testing Library setup.

## Stop Condition

Implementation is explicitly approved in the user request. Stop after delivery artifacts and final report; do not commit.
