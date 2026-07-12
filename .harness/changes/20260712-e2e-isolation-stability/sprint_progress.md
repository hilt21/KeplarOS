# Sprint Progress

Change ID: `20260712-e2e-isolation-stability`
Status: complete

## Phase Status

| Phase | Status | Notes |
|------|--------|-------|
| Request Analysis | Done | Scope revised after review: guarded prepare → server → seed, no server reuse. |
| Review | Done | Two independent reviews approved the revised lifecycle and SSE boundary. |
| Implementation | Done | F-001 lifecycle, F-003 login navigation, and F-002 SSE cancellation complete. |
| Testing | Done | Final isolated Playwright suite: 4/4 passed. |
| Delivery | Done | Summary and handoff recorded. |

## Current Blockers

- None.

## Evidence Collected

- `apps/web/e2e/phase2-board.spec.ts` passes in isolation after the edited-card locator fix.
- The complete suite repeatedly reports 3/4 passing. The remaining Phase 2 failure changes with suite state: one run timed out waiting for the card-create response; another reached execution then lost the SSE/audit assertion during navigation.
- `apps/web/playwright.config.ts`, `e2e/global-setup.ts`, both browser-flow specs, and `src/lib/db/client.ts` currently converge on the long-lived `db/dev.db`.
- `src/app/api/v1/sse/route.ts` calls `liveStream.cancel()` from composed-stream `cancel()` after `liveStream.getReader()`; full-suite logs show `TypeError: Invalid state: ReadableStream is locked` as unhandled rejections.
- Review found the original plan insufficient: `reuseExistingServer: !CI` could
  reuse a normal dev server connected to `dev.db`, and global setup cannot be
  assumed to reset a database before that server opens it. The plan now
  requires a guarded prepare command in the server lifecycle and no reuse.

## Completed

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `review/findings.md`
- Evidence review of the E2E configuration, global setup, browser specs, DB client, and SSE route.

## Current Focus

- Complete.

## Next Step

- No further action required.

## Change Log

- 2026-07-12: Created after full-suite E2E failures following an individually passing Phase 2 scenario.
- 2026-07-12: Review required no-reuse server startup, guarded database preparation before Next.js, a single propagated path, and reader-based SSE cancellation. Revised artifacts approved.
- 2026-07-12: F-001 implementation completed: environment-selected DB client,
  guarded `db/e2e.db` prepare/migration, no-reuse Playwright server, seed-only
  global setup, and unified direct SQLite helpers. Focused tests passed; full
  browser runs await a port-capable host.
- 2026-07-12: Added F-001 regression coverage that executes the prepare script
  against unset, developer, and other paths; all reject before deletion, and
  E2E helper path validation rejects a developer path.
- 2026-07-12: Attempted the first elevated full E2E run. The execution service
  rejected it for account usage limit before a local server or test started;
  this is an unavailable verification, not a test result.
- 2026-07-12: With execution restored, the isolated full suite reached browser
  actions but `frontend-polish` remained on `/login`. Trace review proved login
  itself succeeded; the remaining `router.refresh()`/`router.push()` race is
  outside F-001 and requires a separately approved scope amendment.
- 2026-07-12: Human approved F-003 scope amendment: direct post-login
  navigation only, with no UI or auth contract change.
- 2026-07-12: F-003 implementation removed the successful `router.refresh()`
  and added a regression assertion that direct login navigation does not call
  it. Focused LoginForm tests and typecheck passed.
- 2026-07-12: F-002 retains and cancels the live stream reader from the
  composed response, with an idempotent pump close. A response-body
  cancellation regression test and existing realtime tests passed.
- 2026-07-12: F-002 cancellation now propagates a real source cleanup failure
  rather than swallowing it; focused realtime regression coverage passed.
- 2026-07-12: Removed post-server duplicate authentication writes, required
  401 auth-route warmup, and replaced the transient execution label assertion
  with the actual 200 execution response. Final full suite passed 4/4.
