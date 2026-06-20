# Delivery Summary

Change ID: `20260619-phase2-sse-endpoint`
Status: delivered

## Change Summary

F2-08 SSE Dashboard Endpoint is complete. The change adds the two documented endpoints:

1. `GET /api/v1/sse?goal_space_id=<id>` — Server-Sent Events stream with 1s polling, 15s heartbeat, `Last-Event-ID` replay, and abort-aware `ReadableStream`.
2. `GET /api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100` — Replay endpoint for startup hydration, failed reconnects, and tests.

The wire-format event type names (snake_case) are translated from the storage-format names (dotted form, emitted by F2-04 / F2-05 / F2-06 / F2-07) via the `STORAGE_TO_WIRE_TYPE_MAP` constant.

The work reuses the F2-02 actor helper and F2-03 goal-space repository. **No new auth, authorization, audit, or transaction primitives were introduced.** One error code (`EVENT_CURSOR_EXPIRED`, HTTP 410) was added to `API_ERROR_CODES`.

## Files Changed

### New

- `apps/web/src/lib/db/repositories/realtime-events.ts` — 3 read helpers + 3 types.
- `apps/web/src/lib/realtime/events.ts` — wire-format mapping, serializers, constants.
- `apps/web/src/lib/realtime/stream.ts` — ReadableStream factory.
- `apps/web/src/app/api/v1/sse/route.ts` — `GET` SSE stream.
- `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts` — `GET` replay.
- `apps/web/__tests__/api/realtime.test.ts` — TDD contract tests (12 tests).

### Modified

- `apps/web/src/lib/api/errors.ts` — added `EVENT_CURSOR_EXPIRED` (returns 410 Gone).

## Verification Performed

- `pnpm --filter @keplar/web test -- __tests__/api/realtime.test.ts` — 12 / 12 passed.
- `pnpm --filter @keplar/web test` — 34 files, 523 / 523 passed (baseline 511 + new 12).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## Known Deviations

1. **SSE path corrected** (review F1): `/api/v1/sse` per `interface_spec.md § 8.1`.
2. **Streaming approach**: live mode uses 1s polling (single-Node design per `realtime_events.md § 7`).
3. **Composed stream for replay + live**: the SSE route prepends replayed events before opening the live stream.

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