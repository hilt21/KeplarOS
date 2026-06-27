# Review Findings

Change ID: `20260626-phase3-browser-first-e2e`
Phase: 2 — Review
Reviewer: Application Owner (self-review)
Status: no_blocking_findings

## Scope Verification

The request analysis artifacts match Phase 3 plan task P3-04 verbatim:

- Single file changed: `apps/web/e2e/phase2-board.spec.ts`.
- `global-setup.ts` unchanged.
- No product-side code, API, DB, schema, migration, or authorization changes.

## Pre-Implementation Inspection Findings

- **Finding 1 (informational):** The existing F2-10 spec imports `signSessionValue` from `../src/lib/auth/session` to mint the `keplar_session` cookie directly. P3-04 removes this because the spec now drives login through the `/login` UI. The `signSessionValue` import and `createSessionCookieValue` helper are dropped.
- **Finding 2 (informational):** `seedUser` writes a `'e2e-dummy-hash'` placeholder that the F2-10 spec never validates (since it injects the cookie directly). P3-04 must use `hashPassword("e2e-password")` from `../src/lib/auth/password` so that the login form's POST to `/api/v1/auth/login` succeeds via the real `verifyPassword`.
- **Finding 3 (informational):** The `apiCreateCard` precreated card is referenced as `refs.cardId` for the `/execute` step. After P3-04 the card is created via the command palette; the card id must be obtained from the POST response. `page.waitForResponse(...)` matching `/\/api\/v1\/goal-spaces\/[^/]+\/cards$/` with `method: "POST"` is the cleanest capture mechanism — no UI change required.
- **Finding 4 (informational):** The F2-10 `afterAll` used the carried `cookieValue` to call `/api/v1/goal-spaces/${id}/cancel`. With no carried cookie in P3-04, `afterAll` must mint a fresh session by POSTing to `/api/v1/auth/login` with the seeded credentials and parsing `Set-Cookie` for the `keplar_session` value before the cancel call.
- **Finding 5 (informational):** `hashPassword` uses Node `crypto.scrypt` with `N=32768, r=8, p=1, maxmem=64MiB`. This is well within Playwright's default Node memory budget but takes ~50–150ms per call; calling it once in `beforeAll` is acceptable.

## Risks Re-checked

- **Risk:** Dev server warm-up must still happen because Next.js compiles routes on first hit.
  **Mitigation:** Keep the existing warm-up loop in `beforeAll` (already proven in F2-10).
- **Risk:** Login submit triggers `router.refresh()` + `router.push("/goal-spaces")`. The push is what flips `URL` to `/goal-spaces`.
  **Mitigation:** Wait for `URL` match `/goal-spaces$/` (matches P3-01 test pattern).
- **Risk:** `/create-card` command may resolve to the seeded card from `global-setup`-time data if any prior test left state. P3-04 dev DB starts clean (WAL + FK in `global-setup`, no precreates); the only seeded entity is the user.
  **Mitigation:** The new test does not precreate a card. The first `/create-card` invocation produces the test's card deterministically.

## Blocking Findings

- None.

## Decision

Proceed to Phase 3 Implementation: rewrite `apps/web/e2e/phase2-board.spec.ts` per the spec.