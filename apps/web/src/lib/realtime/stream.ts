/**
 * SSE stream factory (F2-08).
 *
 * Creates a `ReadableStream` that emits realtime events as SSE frames
 * for a single goal space. The stream:
 *
 *   - Polls `realtime_events` every `SSE_POLL_INTERVAL_MS` for new events
 *     (`sequence > lastSequenceId`).
 *   - Emits `:heartbeat` comments every `SSE_HEARTBEAT_INTERVAL_MS`
 *     while idle.
 *   - Closes cleanly on `signal.aborted` (client disconnect).
 *
 * The factory does not handle replay — that is the route handler's
 * responsibility (synchronous, before opening the stream).
 */

import { ApiRequestError } from "@/lib/api/errors";
import type { DrizzleDb } from "@/lib/db/client";
import { listRealtimeEvents, type RealtimeEventRow } from "@/lib/db/repositories/realtime-events";
import {
  rowToWireEvent,
  serializeHeartbeat,
  serializeSseEvent,
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_POLL_INTERVAL_MS,
} from "./events";

export interface SseStreamOptions {
  readonly db: DrizzleDb;
  readonly goalSpaceId: string;
  /** Initial cursor: emit only events with `sequence > lastSequenceId`. */
  readonly lastSequenceId: number;
  readonly signal: AbortSignal;
}

export function createSseStream(options: SseStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let lastSequenceId = options.lastSequenceId;
  let aborted = false;

  const cleanup = (): void => {
    aborted = true;
    if (options.signal && !options.signal.aborted) {
      // Defensive; the route handler attaches the listener.
    }
  };

  if (options.signal) {
    options.signal.addEventListener("abort", cleanup, { once: true });
    if (options.signal.aborted) {
      cleanup();
    }
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let lastHeartbeatMs = Date.now();

      const tick = async (): Promise<void> => {
        if (aborted) {
          try {
            controller.close();
          } catch {
            // already closed
          }
          return;
        }

        // Poll for new events.
        try {
          const result = listRealtimeEvents(options.db, options.goalSpaceId, {
            afterSequence: lastSequenceId,
            limit: 100,
          });

          for (const row of result.events as RealtimeEventRow[]) {
            const frame = serializeSseEvent(rowToWireEvent(row));
            controller.enqueue(encoder.encode(frame));
            if (row.sequence > lastSequenceId) {
              lastSequenceId = row.sequence;
            }
          }
        } catch (error) {
          if (error instanceof ApiRequestError) {
            // Authorization errors during live mode should not crash the stream.
            // The replay phase already validated access; live mode silently drops events.
          }
          // Other errors (DB errors) also do not crash the stream.
        }

        // Heartbeat if idle.
        const now = Date.now();
        if (now - lastHeartbeatMs >= SSE_HEARTBEAT_INTERVAL_MS) {
          controller.enqueue(encoder.encode(serializeHeartbeat()));
          lastHeartbeatMs = now;
        }

        if (!aborted) {
          setTimeout(tick, SSE_POLL_INTERVAL_MS);
        }
      };

      // Start the polling loop asynchronously.
      setTimeout(tick, 0);
    },
    cancel() {
      aborted = true;
    },
  });
}
