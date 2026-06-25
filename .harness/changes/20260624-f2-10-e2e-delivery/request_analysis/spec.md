# F2-10 E2E, Smoke, and Delivery Docs — Request Analysis

## Goal

Close out the Phase 2 Web Collaboration Beta by adding an end-to-end verification path, updating CI to run it, and refreshing the test matrix / phase scope docs. Per the F2-10 plan in [docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md](../../../../docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md).

## Scope (in)

| Item | Description |
|------|-------------|
| Playwright config | `apps/web/playwright.config.ts` — chromium only, single project, webServer = `pnpm dev` on port 3000, baseURL `http://localhost:3000`. Reuse the seeded test session via cookie injection (Playwright's `context.addCookies`). |
| Playwright E2E spec | `apps/web/e2e/phase2-board.spec.ts` — single happy-path test that walks the documented workflow (login → create goal space → create node board → create card → execute Backlog Refiner → decide confirmation → verify card state or blocked reason → audit trail → SSE-driven UI update without manual refresh). |
| Scripts | Add `e2e`, `e2e:ui`, `smoke` to `apps/web/package.json`; forward `e2e` and `smoke` from root `package.json`. |
| CI update | `.github/workflows/web-ci.yml` — add `pnpm smoke` + `pnpm e2e` after `pnpm check`. Add `pnpm exec playwright install --with-deps chromium` step. Allow the new steps to be skipped on CI failure with a documented reason when Playwright isn't available. |
| Docs | `docs/architecture/test_matrix.md` — add explicit mention of `pnpm e2e` and `pnpm smoke` in the verification gates list. |
| Delivery | `delivery/summary.md` + `handoff.md`. |

## Out of scope (explicit)

| Item | Reason |
|------|--------|
| **A full `createGoalSpace` UI page** | The plan calls for creating a goal space from the UI. The F2-09 shell exposes only `createCard` and `executeCard` via the command palette; goal spaces are created via the `/api/v1/goal-spaces` POST endpoint only. Adding a goal-space-creation UI is a Phase 2 feature expansion that requires its own request-analysis pass. |
| **A `createNodeBoard` UI** | Same — no UI exists. The plan's E2E path needs it; for F2-10 we will call the existing `/api/v1/goal-spaces/:goalSpaceId/node-boards` POST directly from the test setup (using the seeded test session), bypassing the UI for these two preconditions. The UI flow is documented as a Phase 3 / post-Phase-2 follow-up. |
| **A `/login` page** | The (app)/layout.tsx redirects to `/login` when no session is present, but no `/login` route exists. The E2E test will inject the seeded session cookie via `context.addCookies` rather than exercising a login form. Adding the login page is a Phase 2 follow-up; the test still exercises the authenticated path end-to-end. |
| **Multi-browser matrix (chromium + firefox + webkit)** | The plan says "single happy path" for SSE to limit CI flakiness. We stay on chromium. |
| **Performance / load test program** | Explicitly out of Phase 2 scope per the F2-10 plan. |
| **Real external MCP / ACP / A2A / GitHub writes** | Out of Phase 2 scope; the fixture executor is deterministic and side-effect-limited. |

## UI flows available for the E2E test

The F2-09 Web UI exposes these mutation paths via the bottom command palette (slash commands):

| Slash command | API call | Status in F2-09 |
|---------------|----------|-----------------|
| `/create-card <title>` | `POST /api/v1/goal-spaces/:id/cards` | wired |
| `/execute <card_id>` | `POST /api/v1/cards/:id/execute` | wired |
| `/list-cards [state]` | `GET /api/v1/goal-spaces/:id/cards` | wired |
| `/transition <card_id> <state>` | (state machine owns) | info message, no API |
| `/block <card_id> [reason]` | `POST /api/v1/cards/:id/block` | wired |
| `/unblock <card_id>` | `POST /api/v1/cards/:id/unblock` | wired |
| `/approve <confirmation_id>` | `POST /api/v1/confirmations/:id/decide` | wired |
| `/reject <confirmation_id>` | `POST /api/v1/confirmations/:id/decide` | wired |
| `/cancel` | `POST /api/v1/goal-spaces/:id/cancel` | wired |
| `/complete` | `POST /api/v1/goal-spaces/:id/complete` | wired |
| `/help` | (UI only) | wired |

The E2E test will drive the create-card, execute, approve, and observe-realtime-update paths through this command palette. Goal-space and node-board creation happen via direct API calls in `test.beforeAll` (server-side setup, authenticated with the seeded session). The decision to bypass the missing UI for those two steps is documented under "Out of scope" above.

## Acceptance criteria

F2-10 is done when ALL of the following are true:

- [ ] AC-1: `apps/web/playwright.config.ts` exists, targets chromium only, sets `baseURL: 'http://localhost:3000'`, configures `webServer` to launch `pnpm dev` when not already running.
- [ ] AC-2: `apps/web/e2e/phase2-board.spec.ts` exists, with a single `test(...)` block that:
  - [ ] sets a session cookie via `context.addCookies` (no UI login)
  - [ ] `beforeAll`: POSTs `/api/v1/goal-spaces` to create a goal space, POSTs `/api/v1/goal-spaces/:id/node-boards` to create a board, POSTs `/api/v1/cards` to create one card (so we don't depend on missing UI for the precondition)
  - [ ] visits `/goal-spaces` and asserts the seeded goal space appears in the list
  - [ ] navigates to `/goal-spaces/:id` and asserts the board header and card row are visible
  - [ ] types `/create-card Implement F2-10 verification` in the command palette, presses Enter, and asserts a new card row appears
  - [ ] types `/execute <cardId>` and asserts an in-flight row appears in the right sidebar
  - [ ] if a pending confirmation appears (Backlog Refiner → needs_confirmation path), types `/approve <confirmationId>` and asserts the confirmation is removed
  - [ ] asserts the right-sidebar Audit timeline shows the execution events
  - [ ] asserts a new card row appears (or a state change) without manual page reload (SSE-driven)
- [ ] AC-3: `apps/web/package.json` has `e2e: "playwright test"`, `e2e:ui: "playwright test --ui"`, `smoke: "vitest run __tests__/smoke.test.ts"`.
- [ ] AC-4: root `package.json` forwards `e2e` and `smoke` to the web workspace.
- [ ] AC-5: `.github/workflows/web-ci.yml` runs `pnpm smoke` and `pnpm e2e` after `pnpm check`, with a `pnpm exec playwright install --with-deps chromium` step.
- [ ] AC-6: `docs/architecture/test_matrix.md` is updated to mention `pnpm e2e` and `pnpm smoke` in the verification gates list.
- [ ] AC-7: `pnpm check` still passes (typecheck + lint + unit + build + format:check). The existing 566 tests remain green; the Playwright spec is additive.
- [ ] AC-8: `pnpm smoke` passes (the existing smoke test in `__tests__/smoke.test.ts`).
- [ ] AC-9: `pnpm e2e` passes locally; if a CI environment is unavailable in this session, the unavailability is documented with reason + risk in `testing/results.md`.
- [ ] AC-10: `delivery/summary.md` and `handoff.md` are written.

## Verification matrix

| Acceptance criterion | How verified | Required artifact |
|----------------------|--------------|-------------------|
| AC-1 | `pnpm exec playwright test --list` lists the project | `apps/web/playwright.config.ts` |
| AC-2 | `pnpm e2e` exits 0 | `apps/web/e2e/phase2-board.spec.ts` + recorded run |
| AC-3, AC-4 | `cat apps/web/package.json` shows scripts; `cat package.json` shows forwarding | files |
| AC-5 | `cat .github/workflows/web-ci.yml` shows the new steps | file |
| AC-6 | `grep -n "pnpm e2e\|pnpm smoke" docs/architecture/test_matrix.md` matches | file |
| AC-7 | `pnpm check` exits 0 | test run |
| AC-8 | `pnpm smoke` exits 0 | test run |
| AC-9 | `pnpm e2e` exits 0 in this session, or unavailability is recorded | `testing/results.md` |
| AC-10 | both files present in `delivery/` | files |

## Risks

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | **Playwright not installed** | Add `@playwright/test` to devDependencies; `pnpm install --frozen-lockfile` in CI will fetch it; local run requires `pnpm exec playwright install chromium`. |
| R2 | **SSE in jsdom is mocked**, but in Playwright real EventSource drives the UI. The dev server must be reachable; `webServer.url` retries handle startup latency. | Set `webServer.timeout: 120_000` and `use.expect.timeout: 10_000`. |
| R3 | **Determinism of the fixture executor** depends on the seeded test data and the fixture's seeded RNG. The plan's E2E test should not assume a particular role's outcome beyond "an execution completes"; the test asserts that the SSE-driven UI update arrives, not the specific transition. | The test wraps role outcomes in a "waitFor either /approve appeared or card moved" pattern. |
| R4 | **CI browser install may be slow / fail on macOS-arm runners**. The plan explicitly allows skipping with documented reason. | Allow the `e2e` step to record unavailable status when Playwright isn't available; never silently skip. |
| R5 | **Existing 566-test suite + new Playwright dep** may push CI runtime past the 15-minute default. | Keep E2E to a single happy-path test; rely on unit tests for matrix coverage. If CI runtime becomes a problem, surface it for human review in `handoff.md`. |
| R6 | **Real seed data variance**. The fixture executor creates execution rows asynchronously; we must wait for the SSE event to land before asserting UI state. | Use Playwright's `expect(locator).toBeVisible({ timeout: 10_000 })` instead of hard sleeps. |

## Reuse summary

- `apps/web/__tests__/smoke.test.ts` — already exists and is the smoke target.
- `apps/web/__tests__/api/route-test-harness.ts` — `withTestSession(actor)` builds the session header; the Playwright setup builds the same `keplar_session` cookie value by serializing the actor + signing via the same secret. (For the local Playwright run we'll mirror the dev-session signing in a small helper, NOT depend on the running dev server's `getSessionActor`.)
- `apps/web/src/lib/realtime/useSseStream.ts` — the EventSource URL is `/api/v1/sse?goal_space_id=...`; the E2E test asserts that the UI updates after a backend POST without manual refresh, which is exactly what this hook subscribes to.

## Phase scope (what we are NOT doing)

- Goal-space creation UI
- Node-board creation UI
- Login page UI
- Multi-browser Playwright matrix
- Performance / load tests
- Production deployment
- Rust / Tauri / Kubernetes