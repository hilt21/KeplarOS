/**
 * GET /api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100
 *
 * Replay endpoint per `docs/specs/realtime_events.md § 5`. Used for
 * startup hydration, failed reconnects, and tests.
 *
 * Returns `{events, next_after_id?, has_more}`. Unknown / expired
 * `after_id` returns 409 `EVENT_CURSOR_EXPIRED` (HTTP 410).
 */

import { ApiRequestError } from "@/lib/api/errors";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { getDb } from "@/lib/db/client";
import { getGoalSpaceWithMembers } from "@/lib/db/repositories/goal-spaces";
import {
  assertCursorExists,
  listRealtimeEvents,
  type RealtimeEventRow,
} from "@/lib/db/repositories/realtime-events";
import { rowToWireEvent } from "@/lib/realtime/events";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function parseLimit(value: string | null): number {
  if (value === null) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiRequestError("INVALID_FIELD", "limit must be a positive integer.");
  }
  if (parsed > MAX_LIMIT) {
    throw new ApiRequestError("INVALID_FIELD", `limit must not exceed ${MAX_LIMIT}.`);
  }
  return parsed;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id: goalSpaceId } = await context.params;
    const url = new URL(request.url);
    const afterId = url.searchParams.get("after_id");
    const limit = parseLimit(url.searchParams.get("limit"));

    const db = getDb();
    const loaded = getGoalSpaceWithMembers(db, goalSpaceId);
    if (!loaded) {
      return apiError("NOT_FOUND", "Goal space not found.");
    }

    // Access check.
    const hasAccess =
      actor.role === "initiator"
        ? actor.id === loaded.row.initiatorId
        : loaded.memberIds.includes(actor.id);
    if (!hasAccess) {
      return apiError("FORBIDDEN", "Cannot read this goal space.");
    }

    // Cursor validation: 409 EVENT_CURSOR_EXPIRED for unknown after_id.
    if (afterId !== null && afterId.length > 0) {
      assertCursorExists(db, goalSpaceId, afterId);
    }

    // Read events.
    const result = listRealtimeEvents(db, goalSpaceId, {
      ...(afterId !== null && afterId.length > 0 ? { afterId } : {}),
      limit,
    });

    const events = (result.events as RealtimeEventRow[]).map(rowToWireEvent);

    return apiOk({
      events,
      has_more: result.hasMore,
      ...(result.nextAfterId !== undefined ? { next_after_id: result.nextAfterId } : {}),
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
