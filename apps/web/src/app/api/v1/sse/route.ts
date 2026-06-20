/**
 * GET /api/v1/sse?goal_space_id=<id> — Server-Sent Events stream.
 *
 * Per `docs/specs/interface_spec.md § 8.1` and
 * `docs/specs/realtime_events.md § 4`.
 *
 * Flow:
 *   1. Authenticate via `requireActor`.
 *   2. Validate `goal_space_id` query param.
 *   3. Validate goal space access (initiator / member).
 *   4. Read `Last-Event-ID` header for replay cursor.
 *   5. Build a composed stream: replay events with `id > cursor` first,
 *      then live events from `createSseStream`.
 *   6. Return `Response` with `Content-Type: text/event-stream`.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { apiError } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { getDb } from "@/lib/db/client";
import { getGoalSpaceWithMembers } from "@/lib/db/repositories/goal-spaces";
import { listRealtimeEvents, type RealtimeEventRow } from "@/lib/db/repositories/realtime-events";
import { rowToWireEvent, serializeSseEvent } from "@/lib/realtime/events";
import { createSseStream } from "@/lib/realtime/stream";

const SSE_BODY_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const goalSpaceId = url.searchParams.get("goal_space_id");
    if (typeof goalSpaceId !== "string" || goalSpaceId.length === 0) {
      return apiError("INVALID_FIELD", "goal_space_id is required.");
    }

    const db = getDb();
    const loaded = getGoalSpaceWithMembers(db, goalSpaceId);
    if (!loaded) {
      return apiError("NOT_FOUND", "Goal space not found.");
    }

    // Access check: initiator OR member of any node board in the goal space.
    const hasAccess =
      actor.role === "initiator"
        ? actor.id === loaded.row.initiatorId
        : loaded.memberIds.includes(actor.id);
    if (!hasAccess) {
      return apiError("FORBIDDEN", "Cannot read this goal space.");
    }

    // Replay phase: synchronous read of events with id > cursor.
    const lastEventIdHeader = request.headers.get("last-event-id");
    let cursorSequence = 0;
    const replayedFrames: Uint8Array[] = [];
    if (lastEventIdHeader !== null && lastEventIdHeader.length > 0) {
      const result = listRealtimeEvents(db, goalSpaceId, {
        afterId: lastEventIdHeader,
        limit: 500,
      });
      const encoder = new TextEncoder();
      for (const row of result.events as RealtimeEventRow[]) {
        replayedFrames.push(encoder.encode(serializeSseEvent(rowToWireEvent(row))));
        if (row.sequence > cursorSequence) cursorSequence = row.sequence;
      }
    }

    // Live phase: open the stream.
    const liveStream = createSseStream({
      db,
      goalSpaceId,
      lastSequenceId: cursorSequence,
      signal: request.signal,
    });

    // Compose: replay frames first, then live frames.
    const composed = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of replayedFrames) {
          controller.enqueue(chunk);
        }
        const reader = liveStream.getReader();
        const pump = async (): Promise<void> => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
            }
          } catch {
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        };
        void pump();
      },
      cancel() {
        void liveStream.cancel();
      },
    });

    return new Response(composed, {
      status: 200,
      headers: SSE_BODY_HEADERS,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
