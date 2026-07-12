# Implementation Notes

Change ID: `20260712-e2e-isolation-stability`

## F-001: Isolate Playwright database lifecycle

- `src/lib/db/client.ts` uses `KEPLAR_DB_PATH` only when explicitly set and
  otherwise retains `db/dev.db`.
- `e2e/db-path.ts` defines the absolute `db/e2e.db` path and rejects E2E
  processes not configured with it.
- `scripts/prepare-e2e-db.mjs` accepts only that path, removes only its
  SQLite files, and runs migrations before Next starts.
- Playwright sets the path for its runner and server, runs preparation before
  `next dev`, and never reuses an existing server.
- Global setup requires the prepared E2E database and only seeds it; seed
  failures propagate.
- Direct E2E SQLite seed helpers use the same explicit path. Generated E2E
  database files are ignored.

## Verification

- Focused DB path test passed.
- Guard regression tests passed for an unset path, `db/dev.db`, and another
  non-E2E path; the latter's sentinel file remained unchanged after the real
  prepare script rejected it. The E2E helper's non-E2E rejection also passed.
- Guarded E2E preparation and all migrations passed.
- Typecheck passed.
- Playwright discovered all four E2E specs with the isolated configuration.
- Full browser execution remains pending because this sandbox cannot bind the
  configured local server port.

## Scope

F-001 and F-003 are implemented. The SSE route and F-002 were not changed.

## F-003: Make successful login navigation race-free

- Removed the successful-login `router.refresh()` so the authenticated route
  transition only pushes `/goal-spaces`.
- The LoginForm success test now asserts `refresh` is not called while
  retaining the existing push and API-error coverage.
- F-002 remains unchanged.

## F-002: Make SSE response cancellation safe

- The composed SSE response retains the live stream reader instead of
  cancelling the already-locked live stream.
- Reader cancellation uses the response cancellation reason and propagates a
  real source cleanup failure to the response-body cancellation caller.
- The composed controller close path is idempotent for both pump completion
  and cancellation.
- A regression test cancels the actual response body and proves it resolves
  without an unhandled `ERR_INVALID_STATE`, while existing auth/replay tests
  remain green. A second regression test proves a rejected source cancel is
  not swallowed.
