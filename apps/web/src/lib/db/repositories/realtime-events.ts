/**
 * Realtime events repository (F2-08).
 *
 * Focused query helpers used by `apps/web/src/app/api/v1/sse/route.ts`
 * and `apps/web/src/app/api/v1/goal-spaces/[id]/events/route.ts`.
 *
 * The `realtime_events` table is per-`goal_space_id`. The `sequence`
 * column is monotonically increasing within a single goal space (per
 * the F-004 `runWithAudit` SQL subquery).
 *
 * Read helpers take the production `DrizzleDb`. Writes to this table
 * are NOT exposed — events are written exclusively via the F-004
 * `runWithAudit` wrapper as part of F2-04 / F2-05 / F2-06 / F2-07
 * lifecycle writes.
 */

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { realtimeEvents } from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import { ApiRequestError } from "@/lib/api/errors";

// ─── types ─────────────────────────────────────────────────────────

export interface RealtimeEventRow {
  readonly id: string;
  readonly goalSpaceId: string;
  readonly sequence: number;
  readonly type: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly actor: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly data: Record<string, unknown>;
  readonly occurredAt: string;
}

export interface ListEventsOptions {
  readonly afterSequence?: number;
  readonly afterId?: string;
  readonly limit: number;
}

export interface ListEventsResult {
  readonly events: RealtimeEventRow[];
  readonly nextAfterId?: string;
  readonly hasMore: boolean;
}

// ─── read helpers ────────────────────────────────────────────────

/**
 * List realtime events for a goal space.
 *   - `afterSequence`: returns events with `sequence > afterSequence`
 *     (used by the SSE live mode to poll for new events).
 *   - `afterId`: returns events with `id > afterId` (used by the replay
 *     endpoint for cursor-based replay). Throws `EVENT_CURSOR_EXPIRED`
 *     if the cursor is unknown / older than the retention window.
 *   - `limit`: max events to return (1-500).
 *   - `hasMore`: true if more events exist beyond the returned set.
 */
export function listRealtimeEvents(
  db: DrizzleDb,
  goalSpaceId: string,
  options: ListEventsOptions,
): ListEventsResult {
  const conds = [eq(realtimeEvents.goalSpaceId, goalSpaceId)];

  if (options.afterSequence !== undefined) {
    conds.push(gt(realtimeEvents.sequence, options.afterSequence));
  } else if (options.afterId !== undefined) {
    conds.push(
      gt(realtimeEvents.sequence, getSequenceForRealtimeEvent(db, goalSpaceId, options.afterId)),
    );
  }

  // Read limit + 1 to detect hasMore.
  const rows = db
    .select()
    .from(realtimeEvents)
    .where(and(...conds))
    .orderBy(sql`${realtimeEvents.sequence} ASC`)
    .limit(options.limit + 1)
    .all() as RealtimeEventRow[];

  const hasMore = rows.length > options.limit;
  const events = hasMore ? rows.slice(0, options.limit) : rows;

  const result: ListEventsResult = { events, hasMore };
  if (hasMore) {
    return { ...result, nextAfterId: events[events.length - 1]!.id };
  }
  return result;
}

/**
 * Look up the most recent event sequence for a goal space. Used by
 * the SSE handler to seed the live polling cursor after replay.
 */
export function getLatestSequenceForGoalSpace(db: DrizzleDb, goalSpaceId: string): number {
  const row = db
    .select({ max: sql<number | null>`MAX(${realtimeEvents.sequence})` })
    .from(realtimeEvents)
    .where(eq(realtimeEvents.goalSpaceId, goalSpaceId))
    .get() as { max: number | null } | undefined;
  return row?.max ?? 0;
}

/**
 * Resolve a replay cursor event id to its sequence within a goal space.
 * Throws EVENT_CURSOR_EXPIRED when the event is missing.
 */
export function getSequenceForRealtimeEvent(
  db: DrizzleDb,
  goalSpaceId: string,
  eventId: string,
): number {
  const row = db
    .select({ sequence: realtimeEvents.sequence })
    .from(realtimeEvents)
    .where(and(eq(realtimeEvents.goalSpaceId, goalSpaceId), eq(realtimeEvents.id, eventId)))
    .get() as { sequence: number } | undefined;

  if (!row) {
    throw new ApiRequestError(
      "EVENT_CURSOR_EXPIRED",
      "The replay cursor is unknown or older than the retention window.",
    );
  }

  return row.sequence;
}

/**
 * Validate that the `after_id` cursor is not older than the retention
 * window. Per realtime_events.md § 5, an expired cursor returns
 * `EVENT_CURSOR_EXPIRED` (HTTP 410).
 *
 * The retention policy itself is out of scope for F2-08; the SSE
 * endpoint uses this helper to enforce the documented error contract.
 */
export function assertCursorExists(db: DrizzleDb, goalSpaceId: string, afterId: string): void {
  getSequenceForRealtimeEvent(db, goalSpaceId, afterId);
}

// Re-export the schema column for downstream serialization.
export { realtimeEvents };
void desc;
