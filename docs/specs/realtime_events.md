# KEPLAR Realtime Events Specification

## 1. Purpose

Phase 1 uses Server-Sent Events (SSE) for one-way Dashboard updates.

The realtime contract exists to keep the UI, database state, audit trail, and AI execution status aligned after refreshes, temporary disconnects, and multiple browser tabs.

## 2. Event Envelope

All SSE messages and replay responses use the same envelope:

```typescript
type RealtimeEventType =
  | 'card_created'
  | 'card_state_changed'
  | 'card_blocked'
  | 'ai_role_started'
  | 'ai_role_completed'
  | 'ai_role_failed'
  | 'confirmation_requested'
  | 'confirmation_decided'
  | 'goal_space_updated'
  | 'goal_space_cancelled'
  | 'session_started'
  | 'session_completed'
  | 'session_failed'

interface RealtimeEvent<T = Record<string, unknown>> {
  id: string
  sequence: number
  type: RealtimeEventType
  goal_space_id: string
  resource: {
    type: 'goal_space' | 'node_board' | 'node_board_member' | 'card' | 'session' | 'agent_execution' | 'confirmation'
    id: string
  }
  actor: {
    type: 'human' | 'ai_role' | 'system'
    id?: string
    name?: string
  }
  data: T
  occurred_at: string
}
```

Rules:
- `id` is the SSE `id:` field and is the client replay cursor.
- `sequence` is monotonically increasing within one `goal_space_id`.
- `type` must be one of the event names above.
- `resource` identifies the object the event primarily updates.
- `data` contains only the minimal payload needed to update the Dashboard.
- Events are append-only once published.

## 3. Event Persistence

Phase 1 stores events in `realtime_events`.

The event write must happen in the same transaction as the business change and audit write when the event represents a persisted state change.

```text
Business mutation
  -> state_transitions / domain row update
  -> audit_entries append
  -> realtime_events append
  -> transaction commit
  -> SSE publish
```

If the event append fails, the business mutation fails. If SSE publish fails after commit, the event remains replayable.

## 4. SSE Endpoint

```http
GET /api/v1/sse?goal_space_id=<id>
Last-Event-ID: <event_id>
```

Server behavior:
- Authenticate through the same HttpOnly session cookie as REST APIs.
- Authorize against `docs/specs/authorization_matrix.md`.
- Replay events after `Last-Event-ID` before sending new live events.
- Send heartbeat comments every 15 seconds while idle.
- Send only events for goal spaces the user can read.

SSE frame format:

```text
id: evt_01HY...
event: card_state_changed
data: {"id":"evt_01HY...","sequence":42,"type":"card_state_changed",...}

```

## 5. Replay API

SSE is the primary realtime channel. The replay API exists for startup hydration, failed reconnects, and tests.

```http
GET /api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100
```

Response:

```typescript
interface RealtimeEventsResponse {
  events: RealtimeEvent[]
  next_after_id?: string
  has_more: boolean
}
```

Rules:
- Default `limit` is 100, maximum `limit` is 500.
- Missing `after_id` returns the oldest retained events for the goal space.
- Unknown or expired `after_id` returns `409` with code `EVENT_CURSOR_EXPIRED`; the client must refetch the current goal-space snapshot before reconnecting.
- Events are ordered by `sequence ASC`.

## 6. Client Reconnect Strategy

The client stores the most recent event `id` per `goal_space_id`.

```text
Initial load
  -> fetch goal-space snapshot
  -> open SSE with Last-Event-ID if available
  -> apply replayed events in sequence order
  -> apply live events
```

Reconnect behavior:
- Let `EventSource` retry automatically.
- After 3 consecutive failures, show a non-blocking stale-data indicator.
- Keep retrying while the page is open.
- On `EVENT_CURSOR_EXPIRED`, close SSE, refetch the snapshot, then reconnect.

Event application must be idempotent: applying the same event twice must not duplicate cards, confirmations, or audit items.

## 7. Multiple Browser Tabs

Phase 1 uses one active SSE connection per browser profile and goal space when the browser supports `BroadcastChannel`.

```text
Leader tab
  -> owns EventSource
  -> broadcasts RealtimeEvent to sibling tabs

Follower tab
  -> receives BroadcastChannel events
  -> opens its own EventSource only if the leader is gone
```

Fallback:
- If `BroadcastChannel` is unavailable, each tab may open its own SSE connection.
- The server must still enforce authorization and per-user connection limits.

## 8. Minimum Test Cases

| Case | Expected result |
|------|-----------------|
| Event append in transaction | Domain write, audit write, and event write commit or fail together |
| `Last-Event-ID` replay | Client receives only events after the cursor |
| Duplicate event apply | UI state is unchanged after applying the same event twice |
| Cursor expired | API returns `409 EVENT_CURSOR_EXPIRED` and client refetches snapshot |
| Multi-tab leader handoff | Follower tab opens SSE after leader tab closes |
| Permission filter | User receives only authorized goal-space events |
