# Testing Results

Change ID: `20260626-phase3-p3-04b-form-submit-fix`
Phase: 4 — Testing
Date: 2026-06-28 (revised; P3-04b completed successfully)

## Final E2E Result: PASSING

```
✓  1 [chromium] › e2e/phase2-board.spec.ts:135:5
   phase 2 board happy path: login → create goal space → create board →
   create card → execute → audit → SSE update (5.9s)

1 passed (7.1s)
```

## Verification Matrix (Final)

| Check | Required? | Command | Result |
|-------|-----------|---------|--------|
| Focused unit tests (3 forms) | Required | `pnpm --filter @keplar/web test -- src/__tests__/ui/{login-form,create-goal-space-form,create-node-board-form}.test.tsx` | 9/9 tests pass |
| Full unit suite | Required | `pnpm --filter @keplar/web test` | 47 files / 582 tests pass (1 added for dev-mode CSP) |
| Typecheck | Required | `pnpm --filter @keplar/web typecheck` | Exit 0; no errors |
| Format | Required | `pnpm --filter @keplar/web format:check` | Exit 0 |
| Build | Required | `pnpm --filter @keplar/web build` | Succeeded |
| **E2E** | Required | `pnpm --filter @keplar/web e2e` | **✅ 1 passed in 5.9s** |
| Integration | N/A | — | Feature is UI-only |
| API contract | N/A | — | No API changes |
| Migration | N/A | — | No DB changes |
| Smoke | Optional | — | Not run |

## What Made E2E Pass: The Five Pre-Existing Bugs P3-04b Uncovered

P3-04b's form-submit refactor (type="button" + `data-hydrated` marker) was the trigger, but it uncovered five pre-existing latent bugs that were masked by a deeper root cause: **the production CSP blocked Next.js dev-mode's React Refresh runtime from booting** (it uses `eval()`). Once hydration actually worked in this dev environment, the real bugs surfaced.

| # | Fix | File | What was broken |
|---|-----|------|-----------------|
| 1 | Dev-mode CSP allows `unsafe-inline` + `unsafe-eval` (production stays strict) | `apps/web/src/lib/security/headers.ts` + `next.config.ts` | 15 CSP errors blocked all hydration in dev mode |
| 2 | `getSnapshot` returns cached reference | `apps/web/src/lib/state/board-store.ts` | "Maximum update depth" infinite re-render loop |
| 3 | `getServerSnapshot` returns frozen `SERVER_SNAPSHOT` constant | same | Same loop, second source |
| 4 | Same snapshot caching pattern | `apps/web/src/lib/realtime/useSseStream.ts` | Same loop, third source (SSE hook) |
| 5 | ThemeSwitcher initializes with `DEFAULT_THEME_ID`; syncs from localStorage in useEffect | `apps/web/src/components/theme-switcher.tsx` | SSR/client hydration mismatch on localStorage |
| 6 | `goal-space-shell` fetches full card list via F2-05 on mount; merges into `liveCards`; pushes new card from `create-card` command | `apps/web/src/components/goal-space-shell.tsx` | F2-03 returns `cards: []` by design; shell needed to call F2-05 list endpoint |

## Acceptance Criteria Status

- [x] LoginForm submit button uses `type="button"` and `onClick`.
- [x] `CreateGoalSpaceForm` submit button uses `type="button"` and `onClick`.
- [x] `CreateNodeBoardForm` submit button uses `type="button"` and `onClick`.
- [x] All three forms keep `<form onSubmit={handleSubmit}>` (preserves Enter-to-submit post-hydration).
- [x] All three forms expose `data-hydrated` attribute on the submit button for the spec to wait on.
- [x] `pnpm --filter @keplar/web typecheck` exits 0.
- [x] `pnpm --filter @keplar/web lint` exits 0 (no new warnings).
- [x] `pnpm --filter @keplar/web test` exits 0; all three focused UI test files pass without modification.
- [x] `pnpm --filter @keplar/web format:check` exits 0.
- [x] `pnpm --filter @keplar/web e2e` exits 0 with `1 passed`.

## Risk / Caveats (Resolved)

- Dev server hydration in this environment: now resolves within Playwright's timeout window thanks to the CSP fix.
- Pre-existing lint warnings (14) in unrelated files; none introduced by P3-04b.
- Pre-existing Node engine warning (`v25.2.1` vs wanted `>=20.10.0 <21.0.0`) is environment-level.
- The P3-04 happy-path spec is committed (1e9d03f) and now passes end-to-end.
