/**
 * Realtime event serialization (F2-08).
 *
 * Translates between the storage-format event type names (dotted form,
 * emitted by F2-04 / F2-05 / F2-06 / F2-07) and the wire-format names
 * (snake_case without dots, per `docs/specs/realtime_events.md § 2`).
 *
 * The SSE wire format is documented at `realtime_events.md § 4`:
 *
 *     id: evt_01HY...
 *     event: card_state_changed
 *     data: {"id":"evt_01HY...","sequence":42,...}
 *
 * Heartbeats are SSE comments (`:` prefix) ignored by EventSource
 * clients; emitted every `SSE_HEARTBEAT_INTERVAL_MS` while idle.
 *
 * Live polling cadence is `SSE_POLL_INTERVAL_MS`.
 */

import type { RealtimeEventRow } from "@/lib/db/repositories/realtime-events";

// ─── constants ────────────────────────────────────────────────────

export const SSE_HEARTBEAT_INTERVAL_MS = 15_000;
export const SSE_POLL_INTERVAL_MS = 1_000;

// ─── wire-format ↔ storage-format type mapping ────────────────────

export const STORAGE_TO_WIRE_TYPE_MAP: Readonly<Record<string, string>> = {
  // Card events (F2-05).
  "card.created": "card_created",
  "card.updated": "card_updated",
  "card.assigned": "card_assigned",
  "card.blocked": "card_blocked",
  "card.unblocked": "card_unblocked",
  // Confirmation events (F2-06).
  "human_confirmation.approved": "confirmation_decided",
  "human_confirmation.rejected": "confirmation_decided",
  // Agent execution events (F2-07).
  "agent_execution.queued": "ai_role_started",
  "agent_execution.completed": "ai_role_completed",
  "agent_execution.failed": "ai_role_failed",
  "agent_execution.needs_confirmation": "confirmation_requested",
  // Node board events (F2-04).
  "node_board.created": "node_board_created",
  "node_board.updated": "node_board_updated",
  "node_board_member.added": "node_board_member_added",
  "node_board_member.removed": "node_board_member_removed",
};

const REVERSE_MAP: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const [storage, wire] of Object.entries(STORAGE_TO_WIRE_TYPE_MAP)) {
    // Only set if not already mapped (preserves the first-seen mapping
    // for shared wire types like "confirmation_decided" → first storage form wins).
    if (!(wire in out)) {
      out[wire] = storage;
    }
  }
  return out;
})();

export const WIRE_TO_STORAGE_TYPE_MAP = REVERSE_MAP;

// ─── wire envelope ────────────────────────────────────────────────

export interface WireRealtimeEvent {
  readonly id: string;
  readonly sequence: number;
  readonly type: string;
  readonly goal_space_id: string;
  readonly resource: { type: string; id: string };
  readonly actor: { type: string; id?: string; name?: string };
  readonly data: Record<string, unknown>;
  readonly occurred_at: string;
}

export function rowToWireEvent(row: RealtimeEventRow): WireRealtimeEvent {
  return {
    id: row.id,
    sequence: row.sequence,
    type: STORAGE_TO_WIRE_TYPE_MAP[row.type] ?? row.type,
    goal_space_id: row.goalSpaceId,
    resource: { type: row.resourceType, id: row.resourceId },
    actor: {
      type: row.actor,
      ...(row.actorId !== null ? { id: row.actorId } : {}),
      ...(row.actorName !== null
        ? { name: row.actorName }
        : row.actorId !== null
          ? { name: row.actorId }
          : {}),
    },
    data: row.data,
    occurred_at: row.occurredAt,
  };
}

// ─── serialization ────────────────────────────────────────────────

/**
 * Serialize a single realtime event into the SSE wire format:
 *
 *     id: evt-1
 *     event: card_created
 *     data: {"id":"evt-1",...}
 *
 *
 * (Trailing blank line per the SSE spec — separates frames.)
 */
export function serializeSseEvent(event: WireRealtimeEvent | RealtimeEventRow): string {
  // A RealtimeEventRow has `actor` as a string (e.g., "human"); a
  // WireRealtimeEvent has `actor` as an object. Distinguish by typeof.
  const isRow = typeof (event as RealtimeEventRow).actor === "string";
  const wire = isRow ? rowToWireEvent(event as RealtimeEventRow) : (event as WireRealtimeEvent);
  const data = JSON.stringify(wire);
  return `id: ${wire.id}\nevent: ${wire.type}\ndata: ${data}\n\n`;
}

/**
 * Serialize a heartbeat comment per the SSE spec (lines starting with
 * `:` are comments and are ignored by EventSource clients).
 */
export function serializeHeartbeat(): string {
  return ":heartbeat\n\n";
}
