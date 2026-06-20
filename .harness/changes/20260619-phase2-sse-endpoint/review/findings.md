# Review Findings

Change ID: `20260619-phase2-sse-endpoint`
Status: review

## Recommendation

**Proceed with one correction.**

The F2-08 request analysis maps the SSE stream endpoint and replay endpoint to the existing `realtime_events` table and the F2-04 / F2-05 / F2-06 / F2-07 realtime event constants. The implementation reuses the F2-02 actor helper, F2-03 goal-space repository, F2-04 node-board repository, and the F2-04 / F2-05 / F2-06 / F2-07 service modules. No new auth, authorization, or audit primitives are introduced.

One spec correction is required before implementation begins — the endpoint URL in my Phase 1 spec does not match the interface spec.

## Blocking Findings

- **F1. The SSE endpoint URL in the Phase 1 spec is `/api/v1/events`, but `docs/specs/interface_spec.md § 8.1` defines it as `GET /api/v1/sse?goal_space_id=xxx`. The plan § F2-08 also uses `/api/v1/events` (inconsistent with the interface spec).**
  Evidence:
  - `interface_spec.md:639` — `GET /api/v1/sse?goal_space_id=xxx`
  - `plan/2026-06-19-phase2-web-collaboration-beta.md:682` — `Create: apps/web/src/app/api/v1/events/route.ts` (path is `/api/v1/events`)
  - The realtime spec `realtime_events.md § 4` does not pin the path.
  Required action: Adopt the interface spec's path `GET /api/v1/sse?goal_space_id=<id>` (it is the documented contract). The plan's "events" path is descriptive prose; the interface spec is the source of truth. Implementation creates the route at `apps/web/src/app/api/v1/sse/route.ts`. The replay endpoint at `GET /api/v1/goal-spaces/:id/events` (per `realtime_events.md § 5`) is unaffected.

## Non-Blocking Risks

- **R1. The SSE endpoint accepts only one `goal_space_id` per connection. Multi-goal-space multiplexing is out of scope (per `realtime_events.md § 4`).**
  Mitigation: Document the single-goal-space design in the implementation notes. Future S4+ may add multiplexing via a comma-separated `goal_space_id` query param.

- **R2. The wire-format event type names (`card_created`, `ai_role_started`, etc.) differ from the storage-format names (`card.created`, `agent_execution.queued`). F2-08 implements the mapping.**
  Mitigation: Pin the mapping with a snapshot test. Future services should follow the storage-format convention and rely on F2-08's mapping.

- **R3. The SSE live mode uses 1-second polling. There is 1s of latency between event creation and SSE delivery.**
  Mitigation: Documented. Future S4+ may add an in-process pub/sub for lower latency (single Node instance; cross-instance requires Redis or similar).

- **R4. The `realtime_events.actor_name` column is a free-text string. F2-08 uses it directly as the wire `actor.name`. When null, falls back to `actor.id`.**
  Mitigation: Document the fallback. No users join is performed (would require schema changes to the realtime_events table to add a users FK).

- **R5. The SSE endpoint's `Last-Event-ID` header is the SSE client's `id:` field. The server must parse this header (case-insensitive per the SSE spec).**
  Mitigation: Use `request.headers.get('Last-Event-ID')`. Next.js lowercases incoming header keys; `headers.get('last-event-id')` also works.

- **R6. The `EVENT_CURSOR_EXPIRED` error code returns HTTP 410 Gone per HTTP convention. The `API_ERROR_STATUS` map will be extended.**
  Mitigation: Add the code to `API_ERROR_CODES` and `API_ERROR_STATUS` (status: 410).

- **R7. The SSE endpoint's `Content-Type` is `text/event-stream`. The response must NOT include `Content-Length` (streaming responses have unknown length).**
  Mitigation: Use `new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })`.

- **R8. The SSE endpoint's heartbeat interval is 15 seconds. The polling interval for new events is 1 second. These are constants exposed from the implementation.**
  Mitigation: Pin as `SSE_HEARTBEAT_INTERVAL_MS = 15000` and `SSE_POLL_INTERVAL_MS = 1000` in `apps/web/src/lib/realtime/events.ts`.

- **R9. The SSE endpoint must NOT buffer events in memory. Each event is enqueued individually as it's read from the database.**
  Mitigation: Use `controller.enqueue()` per event. The `ReadableStream` API supports per-chunk enqueue.

- **R10. The SSE endpoint must close the stream on `request.signal.aborted`. The `signal.aborted` event triggers stream cleanup.**
  Mitigation: Use `signal.addEventListener('abort', () => controller.close())`. Combine with the polling `setTimeout` chain's abort check.

## Missing Tests

- **MT1. SSE endpoint returns 401 without a session.**
- **MT2. SSE endpoint returns 400 INVALID_FIELD for missing `goal_space_id`.**
- **MT3. SSE endpoint returns 403 FORBIDDEN for non-member actor.**
- **MT4. SSE endpoint returns 404 NOT_FOUND for missing goal space.**
- **MT5. SSE endpoint returns 200 with `Content-Type: text/event-stream`.**
- **MT6. SSE endpoint emits replayed events with `id > cursor` when `Last-Event-ID` is provided.**
- **MT7. SSE live mode emits new events when polled.**
- **MT8. SSE heartbeat `:heartbeat` comment is emitted.**
- **MT9. SSE permission filter drops events for non-readable cards.**
- **MT10. Replay endpoint returns 200 with `{events, next_after_id?, has_more}`.**
- **MT11. Replay endpoint returns 409 `EVENT_CURSOR_EXPIRED` for unknown `after_id`.**
- **MT12. Replay endpoint returns 400 INVALID_FIELD for `limit > 500`.**
- **MT13. Wire-format event type mapping snapshot.**
- **MT14. SSE stream closes on `request.signal.aborted`.**

## Open Questions

- **Q1. Should the SSE endpoint accept the `?goal_space_id` as a path param or a query param?**
  Resolution: Query param, per the interface spec § 8.1 (`GET /api/v1/sse?goal_space_id=xxx`).

- **Q2. Should the replay endpoint support cursor-based pagination beyond `after_id`?**
  Resolution: No — `after_id` + `limit` is sufficient per `realtime_events.md § 5`.

- **Q3. Should the SSE endpoint support a `?types=card_created,ai_role_completed` filter?**
  Resolution: No — out of scope for F2-08. The wire filter reduces event volume but adds API complexity. Future S4+ may add it.

## Reviewed Artifacts

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `sprint_progress.md`

## Sprint Progress Update

After human approves the corrections above:

- Phase 2 (Review) → Complete.
- Phase 3 (Implementation) → In Progress.
- Add a "Change Log" entry recording: R-fix F1 (SSE endpoint path corrected from `/api/v1/events` to `/api/v1/sse` per `interface_spec.md § 8.1`).