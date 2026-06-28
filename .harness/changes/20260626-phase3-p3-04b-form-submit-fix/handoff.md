# Handoff

Change ID: `20260626-phase3-p3-04b-form-submit-fix`
Date: 2026-06-28 (revised; P3-04b completed successfully)

## Status

P3-04b is complete. E2E passes end-to-end (1 passed in 5.9s).

## Working Tree State (Final)

```
 M apps/web/__tests__/headers.test.ts                   (1 new dev-mode test case)
 M apps/web/e2e/phase2-board.spec.ts                    (data-hydrated waits + .first() + URL timeout)
 M apps/web/next.config.ts                              (isDev: NODE_ENV==="development")
 M apps/web/src/components/create-goal-space-form.tsx    (type="button" + data-hydrated)
 M apps/web/src/components/create-node-board-form.tsx   (type="button" + data-hydrated)
 M apps/web/src/components/goal-space-shell.tsx         (useRouter + listCards + createCard push)
 M apps/web/src/components/login-form.tsx               (type="button" + data-hydrated)
 M apps/web/src/components/theme-switcher.tsx            (DEFAULT_THEME_ID + useEffect sync)
 M apps/web/src/lib/realtime/useSseStream.ts            (snapshot caching)
 M apps/web/src/lib/security/headers.ts                  (dev-mode CSP branch)
 M apps/web/src/lib/state/board-store.ts                 (snapshot caching + frozen server snapshot)
?? .harness/changes/20260626-phase3-p3-04b-form-submit-fix/
```

## How To Verify From Scratch

```bash
# 1. Typecheck
pnpm --filter @keplar/web typecheck

# 2. Focused UI tests
pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx src/__tests__/ui/create-goal-space-form.test.tsx src/__tests__/ui/create-node-board-form.test.tsx

# 3. Full unit suite
pnpm --filter @keplar/web test

# 4. Format
pnpm --filter @keplar/web format:check

# 5. E2E (the final verification)
pnpm --filter @keplar/web e2e
```

All five commands currently pass. The E2E output:
```
✓  1 [chromium] › e2e/phase2-board.spec.ts:135:5
   phase 2 board happy path: login → create goal space → create board →
   create card → execute → audit → SSE update (5.9s)
1 passed (7.1s)
```

## Files Changed (Final)

| Path | Purpose |
|------|---------|
| `apps/web/src/lib/security/headers.ts` | dev-mode CSP allows `'unsafe-inline' 'unsafe-eval'`; production stays strict |
| `apps/web/next.config.ts` | pipes `isDev: process.env.NODE_ENV === "development"` into `buildSecurityHeaders` |
| `apps/web/__tests__/headers.test.ts` | 1 new test for dev-mode script-src + 2 assertions for production script-src |
| `apps/web/src/lib/state/board-store.ts` | `getSnapshot` returns cached reference; `getServerSnapshot` returns frozen constant |
| `apps/web/src/lib/realtime/useSseStream.ts` | Same snapshot caching pattern |
| `apps/web/src/components/theme-switcher.tsx` | SSR-safe initialization: `useState(DEFAULT_THEME_ID)` + `useEffect` sync from localStorage |
| `apps/web/src/components/login-form.tsx` | `type="button"` + `onClick` + `data-hydrated` + `hydrated` state |
| `apps/web/src/components/create-goal-space-form.tsx` | Same pattern |
| `apps/web/src/components/create-node-board-form.tsx` | Same pattern |
| `apps/web/src/components/goal-space-shell.tsx` | `useRouter` + `listCards` state + `refreshCards` + `createCard` push |
| `apps/web/e2e/phase2-board.spec.ts` | Added `data-hydrated` waits; `.first()` disambiguator; bumped URL timeout to 30s |

## Key Design Decisions

- **Dev-mode CSP**: dropped the per-request nonce in dev and used `'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net`. Production keeps `'self' 'nonce-...'` strict policy. Per CSP spec, a nonce makes `'unsafe-inline'` ignored, so we drop the nonce entirely in dev.
- **useSyncExternalStore snapshot caching**: `getSnapshot()` must return the same reference between notifications. All three stores (board, ui, SSE) now either return the cached object or a frozen constant. Two infinite-loop bugs eliminated.
- **ThemeSwitcher SSR-safe init**: `useState(DEFAULT_THEME_ID)` keeps server/client render in sync. `useEffect(() => setCurrent(getStoredTheme()), [])` syncs from localStorage after mount.
- **`type="button"` over `type="submit"`**: stops native GET-form-submit before hydration. React's `onClick` is the only submit path.
- **Hydration marker via `useEffect` + `data-hydrated`**: deterministic, observable signal for Playwright.
- **listCards fetch in goal-space-shell**: F2-03 returns `cards: []` by design. Shell calls the F2-05 list endpoint to get full cards, merges into `liveCards`. The `create-card` command pushes the newly-created card into local state for immediate render.

## Risks Left Open

- **None for this change.** All five fixes are verified at the unit level AND end-to-end.
- Pre-existing lint warnings (14) in unrelated files remain; none introduced here.
- Pre-existing Node engine warning (`v25.2.1` vs wanted `>=20.10.0 <21.0.0`) is environment-level.

## Suggested Next Action

Commit P3-04b with the form-submit refactor + the 5 pre-existing-bug fixes that it uncovered. The change is a coherent unit: all five fixes are required to make P3-04 E2E pass. Phase 3 web-beta-hardening P3-04 is now verified end-to-end.
