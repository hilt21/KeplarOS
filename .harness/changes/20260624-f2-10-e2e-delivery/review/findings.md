# F2-10 Review — Findings

Reviewer: self (Application Owner pre-implementation review).
Date: 2026-06-24.

## Verdict

**Approved (2026-06-24). F1 closed: Option A selected.**

The Phase 1 spec, tasks, and feature_list are consistent and the implementation plan is tractable. The blocker is closed by adding a small exported signing helper to `lib/auth/session.ts`; the implementation tasks now include T0 to do this. Risks are acceptable for the scope.

## Blocking findings

### F1 — Session cookie signing helper is undefined — CLOSED (Option A, 2026-06-24)

The Phase 1 spec states the E2E test will sign a session cookie using the dev session secret so it can inject it via `context.addCookies`. The current codebase has `apps/web/src/lib/auth/session.ts` with `createSession(userId)` and `getSessionActor(request)`, but **there is no exported helper that signs an arbitrary `{sub, exp}` payload into the cookie value format**. `createSession` builds a payload internally; it cannot be reused for the test setup because the seeded `actor` payload format (`{ id, role }`) is a different shape from the session payload (`{ sub, exp }`).

**Resolution (Option A)**: Export `signSessionValue(payload: { sub: string; exp: number }): string` from `apps/web/src/lib/auth/session.ts`. Implementation:

```ts
export function signSessionValue(payload: { sub: string; exp: number }): string {
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);
  return `${SESSION_VERSION}.${encodedPayload}.${signature}`;
}
```

The function reuses the existing internal `encodePayload` and `signPayload` helpers. It is **only** useful when paired with `getSessionActor`, which already calls `verifySessionValue` on the cookie. The function is safe to export — the secret is read from `process.env.KEPLAR_SESSION_SECRET` (which falls back to the dev secret in non-production), and a forged signature won't verify.

The E2E test imports `signSessionValue` directly, builds `{ sub: seededInitiatorId, exp: <now + 30min> }`, calls it once in `beforeAll`, and injects the result via `context.addCookies`.

**New task**: T0 added to `tasks.md` (export `signSessionValue`; add a small unit test for it). T0 must land before T1.

## Non-blocking risks

### R1 — Playwright binary install in CI

`pnpm exec playwright install --with-deps chromium` requires apt-get on Linux runners; macOS-arm and Windows runners need different flags. The web-ci workflow currently only runs on `ubuntu-latest`, so this is a non-issue today. If a macOS-arm matrix is added later, the install step will need a per-OS branch.

**Mitigation**: keep CI on ubuntu-latest for now. Document the constraint in `handoff.md`.

### R2 — E2E runtime vs CI timeout

`pnpm dev` cold start + `pnpm e2e` could push CI past the existing `timeout-minutes: 15`. The plan's F2-10 exit gate requires `pnpm check` + `pnpm smoke` + `pnpm e2e`, all in the same job.

**Mitigation**: keep the E2E spec to a single happy-path test (per the plan). The unit + integration tests already cover the matrix. Bump CI timeout to 20 minutes if needed; surface this in `handoff.md`.

### R3 — SSE assertion flakiness on slow CI

`expect(locator).toBeVisible({ timeout: 10_000 })` is more reliable than hard sleeps but still timing-sensitive under load. The fixture executor's deterministic outcome timing isn't formally guaranteed; if the SSE event arrives late, the test fails.

**Mitigation**: scope the SSE assertion to "any new audit timeline row appears within 10s" — don't assert specific state transitions or specific row counts. The plan already implies this soft shape.

## Open questions

### Q1 — Test database isolation

The smoke test uses the real Drizzle schema against the in-process `better-sqlite3` instance. The Playwright E2E test runs against a real `pnpm dev` server, which also uses `better-sqlite3`. If both run in parallel against the same DB file, they may collide.

**Recommendation**: Playwright `webServer` already serializes E2E runs (single chromium project, `fullyParallel: false`). The dev server's DB is a separate process from the vitest process. They CAN collide if both write to the same DB file. For now, the test creates its own goal space (named with a timestamp suffix) and asserts only on that goal space's UI, so collision is contained. Document this in `handoff.md` as a future-proofing note.

**Resolution**: explicit test data scoping. No follow-up code required for F2-10.

### Q2 — Should we add a `--ui` script alias?

The plan lists `e2e:ui: "playwright test --ui"` but the web workspace already has `dev`, `build`, `start`. Whether to add the alias is a tooling preference; it costs nothing.

**Resolution**: add it. It matches the plan verbatim and provides a developer-friendly entry point.

### Q3 — `pnpm smoke` vs the existing `pnpm test`

The plan introduces `pnpm smoke` as a separate script that runs only `__tests__/smoke.test.ts`. The existing `pnpm test` runs ALL vitest tests including `smoke.test.ts`. They overlap.

**Recommendation**: keep both. `pnpm test` = full vitest run; `pnpm smoke` = smoke-only fast feedback loop. Document in the test matrix and the delivery summary that the two are complementary, not redundant.

**Resolution**: proceed as planned.

## Acceptance criteria review

| AC | Verdict | Notes |
|----|---------|-------|
| AC-1 | OK | Standard config; matches existing CI pattern |
| AC-2 | OK | Test shape is clear; command-palette selectors need to be precise — see review note in tasks T5 |
| AC-3 | OK | |
| AC-4 | OK | |
| AC-5 | OK | Matches existing ubuntu-latest workflow |
| AC-6 | OK | |
| AC-7 | OK | 566-test baseline must be preserved; new tests are additive |
| AC-8 | OK | Smoke test already exists |
| AC-9 | OK | Documented fallback path for unavailable env |
| AC-10 | OK | Standard delivery artifacts |

## Open implementation notes

- **Selectors**: the F2-09 command palette is rendered through `CommandInput`. The test should select the input via `page.getByRole('textbox')` or a stable `data-testid` if one exists. If neither is stable, T5 must add a `data-testid="command-input"` to `CommandInput` for testability.
- **Cookie domain**: `localhost` for Playwright; `webServer.url` retries handle dev-server readiness.
- **Test data isolation**: goal space name uses `F2-10 E2E ${Date.now()}`; node board and card derive their display_ids from the goal space id.
- **Acceptable test scope**: the E2E test asserts the OBSERVABLE UI behavior (list shows goal space, lanes render, command echo + result, audit row appears, SSE updates without reload). It does not assert specific state transitions or confirmation outcomes because the fixture executor's output is not formally guaranteed.

## Verdict summary

- **F1 must close before Phase 3**: choose Option A / B / C above. Recommend C.
- **R1–R3 are acceptable** for the scope; document mitigations in delivery artifacts.
- **Q1–Q3 resolved** as documented above.

The spec is approved as written, subject to F1 closure.