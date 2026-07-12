# Expert Review Findings

Change ID: `20260712-e2e-isolation-stability`
Status: approved_for_implementation

## Blocking Findings

None remaining.

## Findings Resolved During Review

1. **Untrusted local server reuse could bypass database isolation.**
   - Evidence: `apps/web/playwright.config.ts` used
     `reuseExistingServer: !process.env.CI`.
   - Resolution: require a dedicated project-started server with reuse
     disabled; a port conflict fails before browser requests.

2. **Database reset order was unsafe.**
   - Evidence: global setup and web-server lifecycle did not prove that reset
     happened before Next.js opened SQLite.
   - Resolution: require guarded prepare + migration in the server startup
     path, followed by global seed; seed/migration failures are fatal.

3. **Path propagation could diverge across processes.**
   - Evidence: `src/lib/db/client.ts`, global setup, and E2E specs each
     hard-coded `db/dev.db`.
   - Resolution: one explicit E2E path source for the runner, server child,
     global setup, and direct SQLite seed helpers, while development retains
     the default `db/dev.db`.

4. **SSE cancellation targeted a locked source stream.**
   - Evidence: `src/app/api/v1/sse/route.ts` calls `getReader()` then later
     invokes `liveStream.cancel()`, matching observed
     `ReadableStream is locked` unhandled rejections.
   - Resolution: retain and cancel the reader, with a focused regression test;
     do not add a catch-all that hides other stream errors.

## Non-Blocking Risks

- E2E keeps a fixed port and database and is deliberately serial. Concurrent
  invocations fail fast instead of sharing state.
- Node `v25.2.1` remains outside the declared `>=20.10 <21` engine range.
  It is recorded during verification but is not changed by this feature.

## Test Coverage Required

- Default vs explicit DB-path selection.
- Guarded E2E database preparation, migration, and seed lifecycle.
- SSE response cancellation after the live stream has been locked by its
  reader, with no unhandled rejection.
- Existing SSE authorization/replay coverage.
- Full Playwright suite twice, with all four specs passing each time.

## Recommendation

Proceed with F-001 first, then F-002. The revised request analysis contains
no unapproved product or architecture expansion.
