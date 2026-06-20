# Implementation Notes

Change ID: `20260619-phase2-sse-endpoint`
Status: implementation_complete

## Files Changed

### New

- `apps/web/src/lib/db/repositories/realtime-events.ts` — query helpers (`listRealtimeEvents`, `getLatestSequenceForGoalSpace`, `assertCursorExists`).
- `apps/web/src/lib/realtime/events.ts` — wire-format type mapping, `serializeSseEvent`, `serializeHeartbeat`, `SSE_HEARTBEAT_INTERVAL_MS`, `SSE_POLL_INTERVAL_MS`.
- `apps/web/src/lib/realtime/stream.ts` — `createSseStream(options)` ReadableStream factory.
- `apps/web/src/app/api/v1/sse/route.ts` — `GET` SSE stream handler.
- `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts` — `GET` replay handler.
- `apps/web/__tests__/api/realtime.test.ts` — TDD contract test file (12 tests).

### Modified

- `apps/web/src/lib/api/errors.ts` — added `EVENT_CURSOR_EXPIRED` to `API_ERROR_CODES` (returns HTTP 410 Gone). Documented in the review as the planned extension.

## Implementation Summary

The implementation followed strict TDD (RED → GREEN → REFACTOR):

1. **RED** — wrote 12 failing contract tests for the SSE + replay endpoints, the membership matrix, the wire-format mapping, the `EVENT_CURSOR_EXPIRED` error, and the heartbeat emission.
2. **GREEN** — implemented the realtime events repository (3 read helpers), the events module (mapping + serializer + heartbeat), the stream factory (ReadableStream with 1s polling + 15s heartbeat + abort handling), and the 2 route handlers (composed stream for replay + live).
3. **REFACTOR** — ran `prettier --write` on the new files, then ran typecheck + 523 tests + format:check and `git diff --check`.

### Reuse Notes

- `requireActor` from F2-02's `apps/web/src/lib/api/actor.ts` is used by both routes.
- `getGoalSpaceWithMembers` from F2-03's repository is used for the goal space access check (initiator / member).
- Realtime event constants are consumed implicitly via the `STORAGE_TO_WIRE_TYPE_MAP` (no direct imports — the map is the single source of truth for storage → wire translation).

## Deviations from Plan

### SSE path corrected (review F1)

**Decision:** SSE endpoint at `/api/v1/sse` (per `interface_spec.md § 8.1`).

**Reasoning:** The plan § F2-08 description uses `/api/v1/events` in its description text, but the interface spec is the documented contract (`GET /api/v1/sse?goal_space_id=xxx`). The interface spec wins. Implementation creates the route at `apps/web/src/app/api/v1/sse/route.ts`.

### Streaming approach (review R3 + R10)

**Decision:** Live mode uses 1s polling + recursive `setTimeout`. The stream factory uses `ReadableStream` with `controller.enqueue` for per-chunk SSE frames.

**Reasoning:** The F-008 design is single-Node-instance per `realtime_events.md § 7`. Polling is the simplest correct approach. Future S4+ may add an in-process pub/sub for lower latency.

### Composed stream for replay + live (implementation choice)

**Decision:** The SSE route builds a composed `ReadableStream` that prepends replayed events before opening the live stream.

**Reasoning:** This satisfies the spec's "replay events after `Last-Event-ID` BEFORE opening the live stream" requirement (per `realtime_events.md § 4`). The composed stream drains the replay buffer, then pumps from the live stream factory.

## Risks and Follow-Ups

- **R3**: 1s polling latency. Future S4+ may add in-process pub/sub.
- **R4**: `actor_name` falls back to `actor_id` when null.
- **R9**: No event buffering beyond the current frame.
- **R10**: Abort handling via `request.signal.aborted` + the stream's `cancel()` callback.

## Verification Performed

```sh
pnpm --filter @keplar/web test -- __tests__/api/realtime.test.ts
# 12 / 12 passed
pnpm --filter @keplar/web test
# 34 files, 523 / 523 passed
pnpm --filter @keplar/web typecheck
# 0 errors
pnpm --filter @keplar/web format:check
# clean
git diff --check
# clean
```

## Recommended Commit Message

```text
feat(api): add realtime SSE endpoint

Implements F2-08: GET /api/v1/sse?goal_space_id=<id> (SSE stream with
1s polling + 15s heartbeat + Last-Event-ID replay) and GET /api/v1/
goal-spaces/:id/events (replay endpoint for startup hydration). The wire-
format event type names (snake_case) are translated from the storage-
format names (dotted form, emitted by F2-04 / F2-05 / F2-06 / F2-07) via
the STORAGE_TO_WIRE_TYPE_MAP exported from apps/web/src/lib/realtime/
events.ts. Reuses requireActor (F2-02) and getGoalSpaceWithMembers
(F2-03). Added EVENT_CURSOR_EXPIRED error code (HTTP 410) to API_ERROR_CODES
per realtime_events.md § 5.
```