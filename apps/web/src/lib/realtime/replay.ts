/**
 * Replay fetch helper (F2-09).
 *
 * Calls `GET /api/v1/goal-spaces/:id/events?after_id=&limit=` for
 * startup hydration. Throws `ApiClientError(EVENT_CURSOR_EXPIRED)` on
 * HTTP 410 (per `realtime_events.md § 5`).
 */

import { apiGet, ApiClientError } from "@/lib/api/client";
import type { RealtimeEventsResponse } from "@/lib/api/types";

export async function fetchReplay(
  goalSpaceId: string,
  afterId: string | null,
  limit: number = 100,
): Promise<RealtimeEventsResponse> {
  const query: Record<string, string> = { limit: String(limit) };
  if (afterId !== null) {
    query.after_id = afterId;
  }
  return apiGet<RealtimeEventsResponse>(`/api/v1/goal-spaces/${goalSpaceId}/events`, { query });
}

export { ApiClientError };
