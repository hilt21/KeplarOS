# Request Analysis Spec

Change ID: `20260712-e2e-isolation-stability`
Status: request_analysis

## Request Summary

Make the Playwright suite deterministic when run as a full suite, without
changing product behavior. The immediate request follows evidence that
`phase2-board.spec.ts` passes alone but the full four-spec suite repeatedly
fails after earlier browser flows.

The evidence points to two test-environment defects: every browser flow,
global setup, and application server use the long-lived `apps/web/db/dev.db`;
and closing a browser SSE connection invokes `liveStream.cancel()` after the
stream has been locked, producing unhandled server rejections. This change
will isolate E2E data from the developer database and make stream cleanup
safe. It must retain the existing real-browser workflows and their product
assertions.

## Assumptions

- `apps/web/db/dev.db` is developer-owned data and must never be removed,
  reset, or mutated by an E2E run after this change.
- A repository-local E2E-only SQLite path can be recreated by global setup;
  it is generated test state, not product data.
- The current `ReadableStream is locked` rejection is caused by cancellation
  of an already-reader-locked live stream. The change will verify this with a
  focused route test before claiming it as fixed.
- The approved Story-draft hardening work remains separate. Its edited-card
  assertion in `phase2-board.spec.ts` is preserved, not redesigned.

## Scope

### In Scope

- Add a single, explicit environment-selected SQLite path to the application
  DB client, retaining `db/dev.db` as the default for normal development.
- Configure Playwright, global setup, and E2E seed helpers to share an
  E2E-only database path. A guarded preparation command must recreate and
  migrate that database before Next.js opens it; global setup then seeds the
  existing fixture and fails on seed errors.
- Start E2E on a dedicated, project-started server configuration with no
  reuse of an arbitrary existing `pnpm dev` process. If its port is occupied,
  the suite must fail before browser actions rather than risk writing `dev.db`.
- Retain the reader created for the live SSE stream and cancel that reader
  from the composed response, preventing an unhandled rejection from calling
  `ReadableStream.cancel()` on an already locked stream; add a focused
  regression test.
- Fix the successful-login navigation race by routing directly to
  `/goal-spaces` without refreshing the stale `/login` route first; retain the
  existing login request and error behavior.
- Preserve E2E command-palette, execution, audit, and browser-visible
  assertions; improve only test isolation/readiness where evidence requires.
- Record repeatable full-suite evidence and remaining environment warnings.

### Out of Scope

- No production database migration, schema change, or data deletion.
- No change to product Card states, Story-draft semantics, or UI styling.
- No redesign of the SSE protocol, replay contract, heartbeat, or client
  event handling.
- No login UI, copy, credential, session, authorization, or redirect-target
  changes beyond removing the stale-route refresh.
- No change to the existing developer `db/dev.db` contents or Git history.

## Affected Areas

- API: `src/app/api/v1/sse/route.ts` cancellation boundary only.
- Data model: no schema change; E2E path selection and generated DB lifecycle.
- Authorization: unchanged.
- UI/UX: no visual or interaction scope.
- Tests: Playwright config/global setup/spec seed helpers and focused SSE route coverage.
- Docs: E2E setup comments/README only if the command or database path is user-facing.

## Acceptance Criteria

- [ ] Normal application startup still uses `apps/web/db/dev.db` when no DB
      environment variable is set.
- [ ] Playwright uses an isolated E2E SQLite database and starts each suite
      from a known migrated fixture without deleting or altering `db/dev.db`.
      Preparation completes before the application server opens the database;
      every E2E process uses the same explicit path.
- [ ] E2E never reuses an unknown local development server. A conflicting
      test port stops the suite before any browser/API request.
- [ ] All existing E2E specs pass together on two consecutive runs using the
      project-started server; the edited Story-draft Card assertion remains
      scoped to the newly created Goal Space.
- [ ] Cancelling an SSE response after the live stream is locked does not
      create an unhandled rejection; the behavior has a focused automated test.
- [ ] Typecheck, lint, relevant unit/API tests, and the full E2E suite pass;
      non-blocking Node-engine and Next dev-origin warnings are recorded
      separately from pass/fail results.
- [ ] A successful LoginForm submission invokes only the goal-space route
      navigation after the session response; it does not refresh `/login`.

## Risks

- Risk: the browser server and test runner could use different DB paths.
  Mitigation: define one path in Playwright configuration, set it for the
  runner and web-server child, and make global setup/spec helpers consume it.
- Risk: removing an E2E database could target developer data.
  Mitigation: require an E2E-specific filename/path and reject the normal
  `dev.db` path before removing its SQLite, WAL, or SHM files.
- Risk: a server opens the E2E DB before it is reset.
  Mitigation: run guarded reset+migration in the web-server command before
  `next dev`; global setup only seeds the already-prepared database.
- Risk: catching all stream errors could mask genuine failures.
  Mitigation: limit the cancellation guard to the known already-locked
  cancellation case and retain normal pump error handling.
- Risk: the full-suite failure has an additional root cause.
  Mitigation: run the suite twice and report any surviving failure without
  weakening product assertions.

## Open Questions

- E2E remains a serial local resource: the suite uses one fixed dedicated port
  and database. Concurrent invocations are excluded and must fail fast rather
  than share mutable test state.
- If the suite still fails after isolation and safe SSE cleanup, that is a
  new, evidence-backed scope amendment rather than a reason to weaken E2E
  assertions.

## Approval Gate

Request analysis is complete. Implementation must wait for explicit human
approval of this scoped approach.
