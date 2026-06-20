# Handoff

Change ID: `20260619-phase2-sse-endpoint`
Status: delivered

## Current State

F2-08 SSE Dashboard Endpoint is complete and verified.

Delivered files:

- `apps/web/src/lib/db/repositories/realtime-events.ts`
- `apps/web/src/lib/realtime/events.ts`
- `apps/web/src/lib/realtime/stream.ts`
- `apps/web/src/app/api/v1/sse/route.ts`
- `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts`
- `apps/web/__tests__/api/realtime.test.ts`

Modified:

- `apps/web/src/lib/api/errors.ts` (added `EVENT_CURSOR_EXPIRED`).

## Important Evidence

- Targeted F2-08 tests pass (12 new + 511 baseline = 523 total).
- `pnpm --filter @keplar/web typecheck` — 0 errors.
- `pnpm --filter @keplar/web format:check` — clean.
- `git diff --check` — clean.

## Remaining Environment Caveats

- The machine is still on Node `v25.2.1`; exact Node `20.10.0` parity has not yet been demonstrated.
- `pnpm check` (which includes `pnpm build`) was not run end-to-end; F2-10 E2E phase will exercise the full check.

## SSE Wire Format (handed off to F2-09)

`apps/web/src/lib/realtime/events.ts` exports:

- `STORAGE_TO_WIRE_TYPE_MAP` — translation from storage `type` (`card.created`) to wire `type` (`card_created`).
- `WIRE_TO_STORAGE_TYPE_MAP` — inverse mapping.
- `WireRealtimeEvent` — the SSE envelope shape (per `realtime_events.md § 2`).
- `serializeSseEvent(event)` — produces `id: ...\nevent: ...\ndata: ...\n\n`.
- `serializeHeartbeat()` — produces `:heartbeat\n\n`.
- `SSE_HEARTBEAT_INTERVAL_MS = 15_000`.
- `SSE_POLL_INTERVAL_MS = 1_000`.

F2-09 UI should consume the wire-format type names (`card_created`, `ai_role_started`, etc.) when handling events from the SSE stream.

## Realtime Event Type Mapping

| Storage `type` (DB) | Wire `type` (SSE) |
|---|---|
| `card.created` | `card_created` |
| `card.updated` | `card_updated` |
| `card.assigned` | `card_assigned` |
| `card.blocked` | `card_blocked` |
| `card.unblocked` | `card_unblocked` |
| `human_confirmation.approved` | `confirmation_decided` |
| `human_confirmation.rejected` | `confirmation_decided` |
| `agent_execution.queued` | `ai_role_started` |
| `agent_execution.completed` | `ai_role_completed` |
| `agent_execution.failed` | `ai_role_failed` |
| `agent_execution.needs_confirmation` | `confirmation_requested` |
| `node_board.created` | `node_board_created` |
| `node_board.updated` | `node_board_updated` |
| `node_board_member.added` | `node_board_member_added` |
| `node_board_member.removed` | `node_board_member_removed` |

## Recommended Next Step

Resume the main Phase 2 line at **F2-09 (Web UI)**. F2-09 should:

- Open an `EventSource` to `/api/v1/sse?goal_space_id=<gs>` on the goal-space detail page.
- Store the most recent event `id` per `goal_space_id` in `localStorage`.
- Apply replayed + live events to the UI store, deduplicating by event `id`.
- Use the replay endpoint (`GET /api/v1/goal-spaces/:id/events`) for startup hydration after a page reload.
- Show a "stale data" indicator after 3 consecutive SSE failures (per `realtime_events.md § 6`).
- Consume the wire-format event type names (`card_created`, `ai_role_started`, etc.) when handling events.
- Use the SSE envelope shape: `id`, `sequence`, `type`, `goal_space_id`, `resource: { type, id }`, `actor: { type, id?, name? }`, `data`, `occurred_at`.
- On `EVENT_CURSOR_EXPIRED` (HTTP 410) from the replay endpoint, refetch the snapshot and reconnect.

**F2-10 (E2E + delivery docs)** should:

- Add a Playwright happy-path that opens an SSE connection, triggers a card state change via the API, and verifies the UI updates without a manual refresh.
- Update `docs/specs/phase1_scope.md` with Phase 2 completion notes.
- Update `docs/architecture/test_matrix.md` with the new verification gates.
- Update `package.json` with `e2e` and `smoke` scripts.
- Add `apps/web/playwright.config.ts` and `apps/web/e2e/phase2-board.spec.ts`.
- Update CI to run `pnpm check`, `pnpm smoke`, `pnpm e2e`.

The realtime event type names listed above are the single source of truth for F2-09 UI consumption.