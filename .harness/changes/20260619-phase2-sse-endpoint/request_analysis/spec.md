# F2-08 SSE Dashboard Endpoint — Request Analysis

Change ID: `20260619-phase2-sse-endpoint`
Status: request_analysis

## Request Summary

Implement the Server-Sent Events (SSE) Dashboard Endpoint for the Web Collaboration Beta (F2-08). This is the sixth application feature in Phase 2, following F2-03 (Goal Space), F2-04 (Node Board + Member), F2-05 (Card + Transition), F2-06 (Human Confirmation), and F2-07 (Deterministic AI Lane Executor).

Scope of this change is the **single SSE endpoint** documented in `docs/specs/interface_spec.md § 8.1` and `docs/specs/realtime_events.md § 4`:

- `GET /api/v1/events?goal_space_id=<id>` (with optional `Last-Event-ID: <event_id>` header for replay).

The endpoint authenticates via HttpOnly session cookie, parses `Last-Event-ID`, replays events after the cursor, filters events by per-actor accessibility, opens a `text/event-stream`, sends heartbeat comments every 15 seconds while idle, and closes cleanly on client abort.

A separate `GET /api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100` replay endpoint is documented in `realtime_events.md § 5` and is in scope for F2-08 (it provides startup hydration for failed reconnects and tests).

This change **does not** introduce: Web UI (F2-09), Playwright E2E (F2-10), production deployment / multi-instance event broadcasting. The SSE endpoint is a single-Node-instance design per `realtime_events.md § 7`.

## Assumptions

- F2-03 / F2-04 / F2-05 / F2-06 / F2-07 are committed on `master`. Reuse their patterns — same route-harness queue convention, same `captureMutations` / `makeTxHarness` test helpers, same response envelopes.
- The `realtime_events` table stores events with `type` as free text (per `apps/web/db/schema.ts:594`). The existing services write dotted-form type strings (`card.created`, `human_confirmation.approved`, `agent_execution.queued`, `node_board.created`, etc.).
- The `realtime_events` table is per-`goal_space_id`; the `sequence` column is monotonically increasing within a single goal space (per the F-004 `runWithAudit` SQL subquery).
- The SSE wire protocol (per `realtime_events.md § 4`) uses a different naming convention (snake_case without dots: `card_created`, `ai_role_completed`, `confirmation_requested`, etc.) than the storage protocol (dotted form). F2-08 maps storage → wire format for the SSE event types.
- The SSE endpoint authenticates the same way as the REST endpoints: HttpOnly session cookie. The existing `parseCurrentActor` / `requireActor` helpers are used.
- The per-actor event filter uses `canReadCard` semantics for card events (initiator sees all in their goal spaces; chain_user / viewer see only cards in their node boards or assigned to them). For non-card events (node_board, confirmation, agent_execution), the filter uses `canReadCard`-style membership visibility.
- The SSE endpoint supports a single goal space per connection (per `?goal_space_id=<id>`). Cross-goal-space event multiplexing is out of scope for F2-08 (the SSE spec § 4 documents single-goal-space connections).
- Heartbeat comments are emitted every 15 seconds while idle (per `realtime_events.md § 4`).
- The replay endpoint `GET /api/v1/goal-spaces/:id/events` supports `after_id` (optional cursor) and `limit` (default 100, max 500). Unknown / expired `after_id` returns 409 with code `EVENT_CURSOR_EXPIRED` (new error code per `realtime_events.md § 5`).
- The SSE response stream is closed on `request.signal.aborted` (client disconnect). The stream implementation uses the `ReadableStream` API which is supported in Next.js Route Handlers.
- Realtime event types emitted so far (from F2-03 / F2-04 / F2-05 / F2-06 / F2-07):
  - F2-03: (none — F2-03 doesn't write realtime events directly)
  - F2-04: `node_board.created`, `node_board.updated`, `node_board_member.added`, `node_board_member.removed`
  - F2-05: `card.created`, `card.updated`, `card.assigned`, `card.blocked`, `card.unblocked`
  - F2-06: `human_confirmation.approved`, `human_confirmation.rejected`
  - F2-07: `agent_execution.queued`, `agent_execution.completed`, `agent_execution.failed`, `agent_execution.needs_confirmation`
- The SSE spec's `RealtimeEventType` union (`realtime_events.md § 2`) lists 13 event names. F2-08 implements only the ones actually emitted by the existing services; future features may emit more. The SSE handler accepts any `realtime_events.type` value but maps it to the wire-format using the dotted → snake_case translation.

## Scope

### In Scope

Two endpoints per `docs/specs/interface_spec.md § 8.1` and `docs/specs/realtime_events.md § 4` + `§ 5`:

| # | Method | Path | Source | Purpose |
|---|--------|------|--------|---------|
| 1 | GET | `/api/v1/events?goal_space_id=<id>` | interface_spec § 8.1 | SSE stream |
| 2 | GET | `/api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100` | realtime_events § 5 | Replay for startup hydration |

Plus the supporting layers:

- `apps/web/src/lib/realtime/events.ts` — event serialization (`serializeSseEvent`), event type mapping (storage → wire), and replay helpers.
- `apps/web/src/lib/realtime/stream.ts` — `ReadableStream` factory for the SSE endpoint (heartbeat, abort handling).
- `apps/web/src/lib/db/repositories/realtime-events.ts` — query helpers (`listRealtimeEvents`, `listRealtimeEventsAfterCursor`).
- `apps/web/src/app/api/v1/events/route.ts` — `GET` SSE stream.
- `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts` — `GET` replay endpoint.
- `apps/web/__tests__/api/realtime.test.ts` — TDD contract tests.

### Out of Scope

- Production deployment / multi-instance event broadcasting (Redis pub/sub).
- Web UI (F2-09).
- Playwright E2E (F2-10).
- Real-time goal-space creation events (F2-03 doesn't emit realtime events; out of scope for F2-08).
- Multi-tab leader election via `BroadcastChannel` (client-side; per `realtime_events.md § 7`).
- Cursor cleanup / retention policy (events older than the retention window return `EVENT_CURSOR_EXPIRED`; the retention policy itself is out of scope for F2-08).
- Real-time session events (sessions are out of scope for Phase 2 per F2-07's deviation).

## Affected Modules

### Existing files (read-only references, not modified)

- `apps/web/db/schema.ts` — `realtimeEvents` table.
- `apps/web/src/lib/api/actor.ts` — `requireActor`.
- `apps/web/src/lib/api/errors.ts` — `API_ERROR_CODES` (currently does NOT include `EVENT_CURSOR_EXPIRED`; F2-08 adds it).
- `apps/web/src/lib/api/response.ts` — `apiOk`, `apiError`.
- `apps/web/src/lib/authorization/types.ts` — `Actor`, `CardContext`.
- `apps/web/src/lib/db/repositories/goal-spaces.ts` — `getGoalSpaceWithMembers`.
- `apps/web/src/lib/db/repositories/node-boards.ts` — `listActiveMembersForBoards`.
- `apps/web/src/lib/services/goal-spaces.ts`, `node-boards.ts`, `cards.ts`, `confirmations.ts`, `executions.ts` — realtime event constants consumed by F2-08.

### New files

- `apps/web/src/lib/realtime/events.ts`
- `apps/web/src/lib/realtime/stream.ts`
- `apps/web/src/lib/db/repositories/realtime-events.ts`
- `apps/web/src/app/api/v1/events/route.ts`
- `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts`
- `apps/web/__tests__/api/realtime.test.ts`

### Modified files

- `apps/web/src/lib/api/errors.ts` — add `EVENT_CURSOR_EXPIRED` to `API_ERROR_CODES` and `API_ERROR_STATUS` map (returns 410 Gone per HTTP convention for "resource no longer available").

## Acceptance Criteria

### Endpoint behavior

1. **GET `/api/v1/events?goal_space_id=<id>`** — Returns `200` with `Content-Type: text/event-stream`. Returns `401` without a session. Returns `400 INVALID_FIELD` if `goal_space_id` is missing. Returns `403 FORBIDDEN` if the actor has no access to the goal space. Returns `404 NOT_FOUND` if the goal space doesn't exist. Validates `goal_space_id` query param is a string.
2. **GET `/api/v1/events?goal_space_id=<id>` with `Last-Event-ID: <event_id>` header** — Replays events with `id` strictly greater than `<event_id>` BEFORE opening the live stream. Replay completes within the same HTTP response (synchronous). After replay, the live stream begins.
3. **GET `/api/v1/events?goal_space_id=<id>` live mode** — Opens a `ReadableStream` that emits new events as they arrive in `realtime_events` for the goal space. Closes cleanly on client disconnect (`request.signal.aborted`).
4. **GET `/api/v1/events` heartbeat** — Emits `:heartbeat` SSE comment every 15 seconds while idle (no new events). The comment format is `:heartbeat\n\n` per the SSE spec.
5. **GET `/api/v1/events` permission filter** — Filters events by per-actor accessibility. The wire-format event includes the `goal_space_id` and `actor` metadata but the receiver must be authorized for that goal space. The test pins: a non-initiator actor who is not a member of any node board in the goal space receives no events.

6. **GET `/api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100`** — Returns `200` with `{ events: RealtimeEvent[], next_after_id?: string, has_more: boolean }`. Returns `400 INVALID_FIELD` if `limit > 500`. Returns `409 EVENT_CURSOR_EXPIRED` if `after_id` is unknown / older than the retention window. Events are ordered by `sequence ASC`. Default `limit = 100`. Missing `after_id` returns the oldest retained events.

### SSE wire format

7. **SSE frame format** — Each event emits:
   ```
   id: evt_01HY...
   event: card_state_changed
   data: {"id":"evt_01HY...","sequence":42,"type":"card_state_changed","goal_space_id":"gs-1","resource":{...},"actor":{...},"data":{...},"occurred_at":"2026-..."}
   
   ```
8. **SSE wire-format event type mapping** — Storage `type` (dotted form) → wire `type` (snake_case without dots). E.g., `card.created` → `card_created`. The mapping is documented and snapshot-tested.
9. **Event envelope** — Matches `RealtimeEvent<T>` per `realtime_events.md § 2`: `id`, `sequence`, `type`, `goal_space_id`, `resource: { type, id }`, `actor: { type, id?, name? }`, `data`, `occurred_at`.

### Cross-cutting

10. The SSE handler reads from `realtime_events` only (no in-memory pub/sub); the live mode uses a polling interval (e.g., 1s) to check for new events. This matches the single-Node-instance design per `realtime_events.md § 7`.
11. The replay endpoint reads from `realtime_events` only (no separate event store).
12. The `EVENT_CURSOR_EXPIRED` error code is added to `API_ERROR_CODES` (returns 410 Gone per HTTP convention).
13. The heartbeat interval is 15 seconds.
14. The polling interval for new live events is 1 second (configurable).

### Verification

15. `pnpm --filter @keplar/web test -- __tests__/api/realtime.test.ts` passes.
16. `pnpm --filter @keplar/web test` passes (the full web suite stays green; F2-07's 511 tests remain green).
17. `pnpm check` passes (typecheck + lint + test + build + format:check) with environment warnings only.
18. `git diff --check` passes.
19. No files outside the F2-08 file set or unrelated prior changes are modified.

## Risks and Open Questions

| # | Risk / Question | Severity | Resolution |
|---|---|---|---|
| R1 | The `realtime_events` table is per-`goal_space_id` but the SSE endpoint accepts only one `goal_space_id` per connection. Multi-goal-space multiplexing is out of scope. | Low | Resolved: one goal space per connection per `realtime_events.md § 4`. |
| R2 | The wire-format event type names differ from the storage-format names. F2-08 must map between them. | Low | Resolved: F2-08 implements a `storageTypeToWireType` function that translates `card.created` → `card_created`. Snapshot-tested. |
| R3 | The SSE endpoint's live mode uses polling (not in-memory pub/sub). This adds 1s latency for new events. | Low | Resolved: 1s polling interval is the documented F2-08 design. Future S4+ may add an in-process pub/sub for lower latency. |
| R4 | The `EVENT_CURSOR_EXPIRED` error code is new and requires updating `apps/web/src/lib/api/errors.ts`. | Low | Resolved: add to `API_ERROR_CODES` and `API_ERROR_STATUS` (returns 410 Gone per HTTP convention). |
| Q1 | Should the SSE endpoint emit heartbeat comments as `:heartbeat\n\n` or `event: heartbeat\ndata: {}\n\n`? | — | Resolved: SSE comment format `:heartbeat\n\n` (per the SSE spec — comments start with `:` and are ignored by EventSource clients). |
| Q2 | Should the SSE endpoint accept multiple `goal_space_id` values (comma-separated)? | — | Resolved: No — single goal space per connection per the spec. |
| Q3 | Should the replay endpoint validate `goal_space_id` ownership? | — | Resolved: Yes — the replay endpoint uses the same authorization as the SSE stream (initiator / member / assignee semantics). |
| R5 | The `request.signal.aborted` is the only signal that Next.js exposes for client disconnect. There is no way to detect idle disconnects otherwise. | Low | Resolved: use `request.signal.addEventListener('abort', ...)` to close the stream cleanly. |
| R6 | The SSE endpoint's polling loop must use `setInterval` (or `setTimeout` recursion) with a cleanup on `signal.aborted`. | Low | Resolved: use a recursive `setTimeout` with an `aborted` flag; cleaner than `setInterval`. |
| R7 | The replay endpoint's `next_after_id` field is computed only when `has_more === true`. When fewer than `limit` events remain, `has_more` is false and `next_after_id` is undefined. | Low | Resolved: standard pagination semantics. |
| R8 | The SSE endpoint must not buffer events in memory beyond what's needed to serialize the current frame. | Low | Resolved: stream the events one at a time. |
| R9 | The SSE endpoint's `actor` field in the wire envelope maps from `actor_id` + the lookup of `users.name`. | Low | Resolved: if `actor_name` is null in the DB row, use `actor_id` as the name. F2-08 does NOT do a users join; the actor name is the DB-stored `actor_name` (or `actor_id` as fallback). Documented. |

## Reuse Summary (no new primitives)

| Concern | Reused from | File |
|---|---|---|
| Session / actor resolution | F2-02 | `apps/web/src/lib/api/actor.ts` |
| Goal space access check | F2-03 | `apps/web/src/lib/db/repositories/goal-spaces.ts` |
| Node board membership | F2-04 | `apps/web/src/lib/db/repositories/node-boards.ts` |
| Realtime event constants | F2-04 / F2-05 / F2-06 / F2-07 | `apps/web/src/lib/services/{node-boards,cards,confirmations,executions}.ts` |
| Error codes | F2-02 | `apps/web/src/lib/api/errors.ts` (extended with `EVENT_CURSOR_EXPIRED`) |
| Response envelope | F2-01 | `apps/web/src/lib/api/response.ts` |

## Sequencing

1. Phase 1: Request Analysis (this document) — human approval.
2. Phase 2: Review — risk matrix + open questions re-checked.
3. Phase 3: Implementation via TDD (RED → GREEN → REFACTOR):
   - Add `EVENT_CURSOR_EXPIRED` to `apps/web/src/lib/api/errors.ts`.
   - Repository helpers (`realtime-events.ts`).
   - Event serialization (`events.ts`).
   - Stream factory (`stream.ts`).
   - 2 route handlers.
   - TDD contract tests written first, watched to fail, then implementation passes.
4. Phase 4: Testing — targeted tests + full web suite + pnpm check.
5. Phase 5: Delivery — `delivery/summary.md` + `handoff.md`.

## Next-Step Hint

F2-09 (Web UI) is the immediate follow-up. It should:

- Open an `EventSource` to `/api/v1/events?goal_space_id=<gs>` on the goal-space detail page.
- Store the most recent event `id` per `goal_space_id` in `localStorage`.
- Apply replayed + live events to the UI store, deduplicating by event `id`.
- Use the replay endpoint for startup hydration after a page reload.
- Show a "stale data" indicator after 3 consecutive SSE failures.

F2-10 (E2E) should:

- Add a Playwright happy-path that opens an SSE connection, triggers a card state change via the API, and verifies the UI updates without a manual refresh.

F2-08's `realtime` module exports `storageTypeToWireType` and `serializeSseEvent` so F2-09 can use them for client-side deserialization (if needed).