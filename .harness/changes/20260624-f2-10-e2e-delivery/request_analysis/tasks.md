# F2-10 Tasks (TDD-sequenced)

Each task lists: deliverable, verification command, blocking next task.

## T0 — Export `signSessionValue` from `lib/auth/session.ts` (F1 closure)

- [ ] Add `export function signSessionValue(payload: { sub: string; exp: number }): string` to `apps/web/src/lib/auth/session.ts`. Reuse the existing internal `encodePayload` and `signPayload` helpers. Output format: `${SESSION_VERSION}.${encodedPayload}.${signature}`.
- [ ] Write a small unit test at `apps/web/__tests__/auth/session-sign.test.ts`:
  - `signSessionValue({ sub: 'user-1', exp: <future> })` round-trips through `verifySessionValue` to the same payload.
  - Tampering with the signature makes `verifySessionValue` return null.
- [ ] Verify: `pnpm --filter @keplar/web test -- __tests__/auth/session-sign.test.ts` exits 0.
- [ ] Verify: `pnpm typecheck` exits 0 (no existing call sites break).

## T1 — Install Playwright dependency

- [ ] Add `@playwright/test` to `apps/web/package.json` devDependencies.
- [ ] Run `pnpm install`.
- [ ] Verify: `pnpm exec playwright --version` exits 0 and prints a version.

## T2 — Add scripts to apps/web/package.json

- [ ] Add:
  - `e2e: "playwright test"`
  - `e2e:ui: "playwright test --ui"`
  - `smoke: "vitest run __tests__/smoke.test.ts"`
- [ ] Verify: `cat apps/web/package.json | grep -E '"(e2e|e2e:ui|smoke)"'`.

## T3 — Forward scripts from root package.json

- [ ] Add `e2e: "pnpm --filter @keplar/web e2e"` and `smoke: "pnpm --filter @keplar/web smoke"` to root `package.json`.
- [ ] Verify: `cat package.json | grep -E '"(e2e|smoke)"'`.

## T4 — Write Playwright config (RED-first)

- [ ] Create `apps/web/playwright.config.ts`:
  - `testDir: 'e2e'`
  - `fullyParallel: false` (single test)
  - `retries: process.env.CI ? 1 : 0`
  - `webServer: { command: 'pnpm dev', port: 3000, reuseExistingServer: !process.env.CI, timeout: 120_000 }`
  - `use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' }`
  - `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`
- [ ] Verify: `pnpm exec playwright test --list` exits 0.

## T5 — Write the E2E beta path (RED-first)

- [ ] Create `apps/web/e2e/phase2-board.spec.ts`. The test:
  - `beforeAll`: signs a session cookie using the dev session secret + a seeded initiator; POSTs to create goal space, node board, and card; uses the API wrappers (`fetch` with `credentials: 'include'`).
  - `test('phase 2 board happy path', async ({ page, context }) => { ... })`:
    - `context.addCookies([{ name: 'keplar_session', value: signedCookie, domain: 'localhost', path: '/' }])`
    - `await page.goto('/goal-spaces')` → expect goal space link visible
    - `await page.getByRole('link', { name: /Ship F2-10/ }).click()` → expect `lane-backlog` testid visible
    - `await page.getByRole('combobox').fill('/create-card Implement F2-10 verification')` → press Enter → expect new `CardRow` with display_id visible
    - `await page.getByRole('combobox').fill(`/execute ${cardId}`)` → press Enter → expect either an in-flight row OR an audit entry within 10s
    - if a pending confirmation appears: `/approve <confirmationId>` → expect confirmation removed from right sidebar
    - assert audit timeline has at least one row for the executed role
- [ ] Verify: `pnpm e2e` exits 0; if it fails, document in `testing/results.md` with the captured screenshot / trace path.

## T6 — Update CI workflow

- [ ] Add to `.github/workflows/web-ci.yml`:
  - `pnpm exec playwright install --with-deps chromium` (after `pnpm install`)
  - `pnpm smoke` (after `pnpm check`)
  - `pnpm e2e` (after `pnpm smoke`)
- [ ] Verify: `cat .github/workflows/web-ci.yml` shows the three new steps.

## T7 — Update docs

- [ ] Append to the verification gates list in `docs/architecture/test_matrix.md`: mention `pnpm e2e` and `pnpm smoke` and what they cover.
- [ ] Verify: `grep -n "pnpm e2e\|pnpm smoke" docs/architecture/test_matrix.md` returns matches.

## T8 — Final verification

- [ ] Run `pnpm check` (must remain green; existing 566 tests untouched).
- [ ] Run `pnpm smoke` (must remain green; existing smoke test).
- [ ] Run `pnpm e2e` (must pass in this session; if not, document why).
- [ ] Verify: `git status --short` shows only intentional delivery artifacts.

## T9 — Delivery

- [ ] Write `delivery/summary.md` with: AC matrix status, deviations, follow-ups.
- [ ] Write `handoff.md` with: next-session recovery snapshot, unresolved risks, recommendations for Phase 3.