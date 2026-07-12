# Request Analysis Tasks

Change ID: `20260712-e2e-isolation-stability`
Status: request_analysis

## Implementation Tasks

- [ ] F-001: Introduce an environment-selected DB path with the current
  `db/dev.db` as the normal-development default.
  - Verify: a unit-level check or focused import proves the default remains
    unchanged and the selected E2E path is used only when explicitly set.
- [ ] F-001: Configure Playwright/global setup/E2E helpers around one
  E2E-only database. A guarded prepare command must delete only the dedicated
  SQLite/WAL/SHM files, migrate before `next dev`, then global setup must seed
  and fail loudly on a seed error.
  - Verify: no E2E process opens `dev.db`; a port conflict cannot reuse an
    unknown local server; the suite startup never deletes or writes `dev.db`.
- [ ] F-002: Make composed SSE response cancellation safe after the live
  stream reader has locked the underlying stream.
  - Verify: retain and cancel the reader (not the locked source stream); a
    route regression test cancels the response and observes no rejection;
    existing SSE authorization/replay tests still pass.
- [ ] F-003: Remove the successful LoginForm stale-route refresh and lock the
  direct `/goal-spaces` navigation behavior with a component regression test.
  - Verify: successful login calls `push("/goal-spaces")` and does not call
    `refresh()`; API error behavior is unchanged.

## Test Tasks

- [ ] Run focused DB-path and SSE route tests.
  - Verify: all targeted assertions pass.
- [ ] Run the full Playwright suite twice from a project-started server.
  - Verify: each run reports 4/4 passing with no failed-test artifact.
- [ ] Run typecheck, lint, and the web test suite.
  - Verify: failures are fixed or documented as pre-existing and out of scope.

## Documentation Tasks

- [ ] Update only the E2E setup documentation/comments if the isolation path
  or command becomes materially different for developers.
  - Verify: documentation names the generated E2E DB and preserves the
    developer-database warning.

## Sequencing

1. Review the DB client, Playwright lifecycle, and SSE cancellation test seam.
   Verify: review findings distinguish confirmed facts from hypotheses.
2. Implement and verify F-001 only, including the ordered prepare → server →
   global-seed lifecycle.
   Verify: isolated full-suite run reaches all existing workflow assertions.
3. Implement and verify F-002 only.
   Verify: no cancellation rejection and API regression coverage passes.
4. Implement and verify F-003 only, then run the complete verification matrix
   twice for E2E and record results.
   Verify: no unresolved blocker remains.

## Dependencies

- Existing `better-sqlite3`, Playwright, raw SQL migrations, and test fixtures.
- Ability to bind the local Playwright server port outside the sandbox.

## Stop Condition

Stop after writing request-analysis artifacts and wait for explicit human
approval.
