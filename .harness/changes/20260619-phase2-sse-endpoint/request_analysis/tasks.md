# F2-08 SSE Dashboard Endpoint — Implementation Tasks

Change ID: `20260619-phase2-sse-endpoint`
Status: request_analysis

## Conventions

- Strict TDD: every task begins with a failing test, then minimal GREEN implementation, then REFACTOR.
- Tests live alongside the F2-04 / F2-05 / F2-06 / F2-07 pattern: `apps/web/__tests__/api/realtime.test.ts` with inline `queueSelectResults`, `captureMutations`, `makeTxHarness`.
- All routes use `apps/web/src/lib/api/actor.ts` `requireActor`.
- Realtime event constants are reused from F2-04 / F2-05 / F2-06 / F2-07.

---

## T1. Add `EVENT_CURSOR_EXPIRED` to `errors.ts`

**RED** — write a test that imports `API_ERROR_CODES` and asserts `EVENT_CURSOR_EXPIRED` is in the list. Watch it fail.

**GREEN** — add the code to `API_ERROR_CODES` and `API_ERROR_STATUS` (returns 410 Gone per HTTP convention).

**REFACTOR** — none.

## T2. Repository helpers — realtime events read paths

**RED** — write a service-level test for `listRealtimeEvents(db, goalSpaceId, opts)`. Watch it fail.

**GREEN** — implement in `apps/web/src/lib/db/repositories/realtime-events.ts`:

- `listRealtimeEvents(db, goalSpaceId, { afterId?, limit })` — returns `{ events, nextAfterId?, hasMore }`.
- The `afterId` is matched against the row's primary-key `id` (the SSE `id:` field); if not found, the caller throws `EVENT_CURSOR_EXPIRED`.
- Pagination: events ordered by `sequence ASC`; `limit + 1` rows are read internally to compute `hasMore`.

**REFACTOR** — split helpers.

## T3. Event serialization

**RED** — write a unit test for `serializeSseEvent(event)` that asserts the SSE frame format.

**GREEN** — implement in `apps/web/src/lib/realtime/events.ts`:

- `storageTypeToWireType(storageType)` — maps `card.created` → `card_created`, `human_confirmation.approved` → `confirmation_decided`, `agent_execution.queued` → `ai_role_started`, etc.
- `wireTypeToStorageType(wireType)` — inverse mapping.
- `serializeSseEvent(event)` — returns the multi-line SSE frame string (`id: ...\nevent: ...\ndata: ...\n\n`).
- `serializeHeartbeat()` — returns `:heartbeat\n\n`.
- `SSE_HEARTBEAT_INTERVAL_MS = 15000`.
- `SSE_POLL_INTERVAL_MS = 1000`.

**REFACTOR** — none.

## T4. Permission filter

**RED** — write a unit test for the per-actor event filter.

**GREEN** — implement `filterEventsForActor(events, actor, db)`:

- For each event, compute the `goalSpaceContext` (initiator / member / assignee).
- Drop events the actor cannot read.
- Return filtered events.

**REFACTOR** — extract helper.

## T5. Stream factory

**RED** — write a unit test for the `ReadableStream` factory that emits heartbeats and polls for new events.

**GREEN** — implement in `apps/web/src/lib/realtime/stream.ts`:

- `createSseStream(db, goalSpaceId, actor, lastSequenceId)` — returns a `ReadableStream` that:
  - Polls `realtime_events` every 1s for new events (`sequence > lastSequenceId`).
  - Emits `:heartbeat` comments every 15s while idle.
  - Closes on `signal.aborted`.
- Uses `enqueue` to push SSE frames.

**REFACTOR** — none.

## T6. SSE route handler

**RED-first** — write the route test first.

**GREEN** — implement `apps/web/src/app/api/v1/events/route.ts`:

- `requireActor`.
- Validate `goal_space_id` query param.
- Validate goal space access (initiator / member / assignee).
- Parse `Last-Event-ID` header.
- Replay events after the cursor (synchronous, before opening the stream).
- Open `ReadableStream` for live mode.
- Return `Response` with `Content-Type: text/event-stream`.

**REFACTOR** — share boilerplate.

## T7. Replay route handler

**RED-first** — write the route test first.

**GREEN** — implement `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts`:

- `requireActor`.
- Validate goal space access.
- Parse `after_id` and `limit` query params.
- Read events via `listRealtimeEvents`.
- Throw `EVENT_CURSOR_EXPIRED` if `after_id` is unknown.
- Return `200` with `{ events, next_after_id?, has_more }`.

**REFACTOR** — none.

## T8. Wire-type mapping snapshot test

**RED** — snapshot test asserts the exact mapping.

**GREEN** — export `STORAGE_TO_WIRE_TYPE_MAP` and `WIRE_TO_STORAGE_TYPE_MAP` from `apps/web/src/lib/realtime/events.ts`.

**REFACTOR** — none.

## T9. Contract tests file

**RED-then-GREEN** — write the full test file covering:
- 401 without session.
- 400 INVALID_FIELD for missing goal_space_id.
- 403 FORBIDDEN for non-member.
- 404 NOT_FOUND for missing goal space.
- 200 with `text/event-stream` content type for valid request.
- Replay path: `Last-Event-ID` header triggers replay of events with `id > cursor`.
- Live path: new events are emitted when polled.
- Heartbeat: `:heartbeat` comment is emitted.
- Permission filter: a non-member chain_user receives no events.
- Replay endpoint: 200 with `{ events, next_after_id?, has_more }`.
- Replay endpoint: 409 `EVENT_CURSOR_EXPIRED` for unknown `after_id`.
- Replay endpoint: 400 INVALID_FIELD for `limit > 500`.
- Duplicate event `id`s keep stable identity.
- Realtime constants snapshot.

**REFACTOR** — extract helpers if repeated 3+ times.

## T10. Verification

- `pnpm --filter @keplar/web test -- __tests__/api/realtime.test.ts` — green.
- `pnpm --filter @keplar/web test` — full web suite stays green (511 + new tests).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web lint` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## T11. Delivery artifacts

- `.harness/changes/20260619-phase2-sse-endpoint/implementation/notes.md`
- `.harness/changes/20260619-phase2-sse-endpoint/testing/results.md`
- `.harness/changes/20260619-phase2-sse-endpoint/delivery/summary.md`
- `.harness/changes/20260619-phase2-sse-endpoint/handoff.md`

## T12. Update `feature_list.json` + `sprint_progress.md`

- Mark `F2-08` `implementation_status: completed`, `test_status: passed`, `done_status: completed`.

## Sequencing Rules

- One task at a time.
- Tests are RED-first.
- If a deviation is needed, document in `implementation/notes.md`.