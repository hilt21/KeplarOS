# Request Analysis Spec

Change ID: `20260626-phase3-browser-first-e2e`
Status: pending_human_approval

## Request Summary

Implement P3-04 Browser-First E2E by rewriting `apps/web/e2e/phase2-board.spec.ts` so the happy-path test drives login, goal-space creation, and node-board creation through the existing browser UIs (P3-01 / P3-02 / P3-03) instead of pre-creating those rows through direct API calls in `beforeAll`. Card creation, execute, audit, and SSE assertions continue to use the existing command palette as the user would.

This feature only modifies the Playwright spec and the seeded-user helper. It does not change product code, API, DB, schema, or the existing `global-setup.ts`.

## Assumptions

- The `e2e-password` plaintext matches `e2e-password`. `seedUser()` will use the production `hashPassword("e2e-password")` from `apps/web/src/lib/auth/password.ts` so `verifyPassword` accepts the form login.
- The login UI built in P3-01 exists at `/login` with label `Email`, label `Password`, and button `Sign in`, and on success navigates to `/goal-spaces`.
- The goal-space creation form from P3-02 exists on `/goal-spaces` with labels `Goal name` and `Description`, and button `Create goal space`.
- The node-board creation form from P3-03 exists in the `boards.length === 0` branch of the goal-space detail page with labels `Board key` and `Board name`, and button `Create node board`.
- The existing command palette `/create-card <title>` and `/execute <cardId>` continue to work as in F2-10.
- Existing P3-00 / P3-01 / P3-02 / P3-03 commits are owned by other work and must not be reverted or reformatted.

## Scope

### In Scope

- Modify `apps/web/e2e/phase2-board.spec.ts`:
  - Replace `createSessionCookieValue` and `injectSessionCookie` with a browser-driven login flow via the `/login` page.
  - Replace `apiCreateGoalSpace` usage in `beforeAll` with browser form actions on `/goal-spaces`.
  - Replace `apiCreateNodeBoard` usage in `beforeAll` with browser form actions on the goal-space detail page's empty-board branch.
  - Update `seedUser` to insert a real scrypt hash for `e2e-password` (via the existing `hashPassword` helper) instead of the `e2e-dummy-hash` placeholder.
  - Remove `apiCreateCard` and `refs.cardId` (the test now creates its own card via the command palette and obtains its id from the create-card API response, not from `beforeAll`).
  - Keep the command-palette card creation, execute, audit timeline, and SSE-update assertions.
- Modify only if required by spec: `apps/web/e2e/global-setup.ts` — most likely unchanged (still only applies migrations).
- Create required harness artifacts under `.harness/changes/20260626-phase3-browser-first-e2e/`.

### Out of Scope

- No backend, API, DB, schema, or migration changes.
- No product-side UI changes (login form, goal-space form, node-board form, board view, command palette, audit sidebar, SSE hook all stay as they are from P3-01/02/03 + F2-09/10).
- No new P3-04 Playwright helper module unless absolutely needed (the goal is minimal diff).
- No P3-05 realtime reliability hardening, P3-06 DB invariants, or P3-07 delivery docs.
- No commits until explicitly requested.

## Affected Areas

- E2E: `apps/web/e2e/phase2-board.spec.ts` is the single file rewritten.
- E2E setup: `apps/web/e2e/global-setup.ts` reviewed but expected unchanged.
- Auth: imports the existing `hashPassword` helper to seed a real password hash. No change to `src/lib/auth/*` itself.
- Product code: none.

## Acceptance Criteria

- [ ] `apps/web/e2e/phase2-board.spec.ts` no longer calls `apiCreateGoalSpace` or `apiCreateNodeBoard`.
- [ ] `beforeAll` no longer pre-creates a goal space or a node board.
- [ ] `beforeAll` no longer pre-creates a card; the test creates its own card via the command palette.
- [ ] `seedUser` writes a real scrypt hash for `e2e-password` produced by `hashPassword("e2e-password")` from `apps/web/src/lib/auth/password.ts`.
- [ ] The test visits `/login`, fills `Email` with `SEEDED_USER_EMAIL`, fills `Password` with `e2e-password`, clicks `Sign in`, and waits for `/\/goal-spaces$/`.
- [ ] The test fills `Goal name` with a deterministic string (e.g., `P3 browser beta`), fills `Description`, clicks `Create goal space`, waits for a link matching the goal name, and clicks through to the detail page.
- [ ] The test fills `Board key` with `MAIN`, fills `Board name`, clicks `Create node board`, and waits for `getByTestId("lane-backlog")` to be visible.
- [ ] The test issues `/create-card E2E verification card` via the command palette and waits for a button matching the title.
- [ ] The test obtains the created card's id (via the intercepted `POST /api/v1/goal-spaces/{id}/cards` response) and uses it for `/execute <cardId>`.
- [ ] The test asserts an audit row (`ai_role_started|ai_role_completed|ai_role_failed|// idle`) appears without manual refresh.
- [ ] The test asserts `getByTestId("lane-backlog")` remains visible after the execute round-trip.
- [ ] `afterAll` cancels the goal space using its goalSpaceId obtained from the UI-created goal space.
- [ ] `apps/web/e2e/global-setup.ts` is unchanged (still applies migrations only).
- [ ] `pnpm --filter @keplar/web typecheck` exits 0.
- [ ] `pnpm --filter @keplar/web lint` exits 0 (no new errors; pre-existing warnings unchanged).
- [ ] `pnpm --filter @keplar/web format:check` exits 0 (after `prettier --write` on the modified spec if needed).
- [ ] `pnpm --filter @keplar/web e2e` exits 0 with `1 passed` for the rewritten spec.

## Risks

- Risk: `pnpm e2e` requires a running dev server (`pnpm dev`) and is sensitive to environment timing; the existing 60s `test.setTimeout` and 15s `toBeVisible` timeouts in the F2-10 spec are reused.
  Mitigation: Reuse existing timeout strategy. If new flakiness appears, document and address with focused retries — do not blanket-increase timeouts.
- Risk: Login form submission involves a POST + `router.refresh()` + `router.push("/goal-spaces")` round-trip; Playwright may navigate before `router.refresh()` settles.
  Mitigation: Wait for `URL` match `/goal-spaces$/` (this is what P3-01 already does in its test).
- Risk: Goal-space creation's `router.refresh()` + `<CreateGoalSpaceForm />` reset interplay: the form resets itself before `router.refresh()` re-fetches the server-rendered list.
  Mitigation: Wait for the new goal-space link to be visible, matching P3-02's existing pattern.
- Risk: Node-board form is mounted via `EmptyState.action`; after successful submit `router.refresh()` may unmount the empty branch and remount with the populated `NodeBoardView`.
  Mitigation: Wait for `getByTestId("lane-backlog")` visibility, which is what the existing F2-10 test already asserts.
- Risk: The "obtain card id for `/execute`" question has no canonical answer in the current UI.
  Mitigation: Use `page.waitForResponse(...)` to intercept the `POST /api/v1/goal-spaces/{id}/cards` response after `/create-card` — no UI change required. Document the choice in `implementation/notes.md`.
- Risk: `seedUser` must become async to `await hashPassword(...)`.
  Mitigation: Make `seedUser` and `beforeAll` async; `beforeAll` already accepts `async`.
- Risk: `e2e-password` constant lives in the spec; the test must stay self-contained.
  Mitigation: Define `E2E_PASSWORD = "e2e-password"` as a module-level constant next to `SEEDED_USER_EMAIL`.
- Risk: Playwright `page.waitForResponse` requires a URL pattern; capture the exact path to avoid matching the wrong request.
  Mitigation: Match `/\/api\/v1\/goal-spaces\/[^/]+\/cards$/` (POST).

## Open Questions

- None. The card-id resolution uses the network-response interception approach (no UI change required).

## Approval Gate

The user explicitly requested "开始P3-04 用TDD开发". Per the Application Owner Runtime, this change folder is delivered as Phase 1 Request Analysis only and STOPs for explicit human approval before Phase 3 Implementation begins.