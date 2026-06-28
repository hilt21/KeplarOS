/**
 * SSE client hook (F2-09).
 *
 * Opens exactly one `EventSource` per `goalSpaceId` per page. Events are
 * deduped by `id`. The last event id is persisted to `localStorage` per
 * goal space for reconnect resilience.
 *
 * Status machine:
 *   idle → connecting → live → reconnecting → live → ... (capped backoff)
 *           ↓                            ↓
 *          error ←————————————————————─ error
 *           ↓
 *         stale (no event for 45s)
 *
 * EVENT_CURSOR_EXPIRED (HTTP 410) handling: EventSource does not surface
 * HTTP status codes. The caller (`goal-space-shell.tsx`) handles 410 from
 * the explicit replay fetch (which uses `fetch`, not EventSource).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/api/types";

// ─── types ─────────────────────────────────────────────────────────

export type SseStatus = "idle" | "connecting" | "live" | "reconnecting" | "stale" | "error";

export interface UseSseStreamOptions {
  readonly goalSpaceId: string | null;
  readonly initialLastEventId?: string | null;
}

export interface UseSseStreamResult {
  readonly events: readonly RealtimeEvent[];
  readonly status: SseStatus;
  readonly lastEventId: string | null;
  reconnect: () => void;
}

const HEARTBEAT_STALE_MS = 45_000;
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_CAP_MS = 30_000;
const SUBSCRIBED_EVENT_TYPES: readonly RealtimeEventType[] = [
  "card_created",
  "card_state_changed",
  "card_blocked",
  "ai_role_started",
  "ai_role_completed",
  "ai_role_failed",
  "confirmation_requested",
  "confirmation_decided",
  "goal_space_updated",
  "goal_space_cancelled",
  "session_started",
  "session_completed",
  "session_failed",
  "card_updated",
  "card_assigned",
  "card_unblocked",
  "node_board_created",
  "node_board_updated",
  "node_board_member_added",
  "node_board_member_removed",
];

// ─── module-scoped shared state ──────────────────────────────────────

interface SseSnapshot {
  events: readonly RealtimeEvent[];
  status: SseStatus;
  lastEventId: string | null;
}

interface SharedStream {
  source: EventSource | null;
  events: RealtimeEvent[];
  byId: Set<string>;
  status: SseStatus;
  lastEventId: string | null;
  lastEventAt: number;
  attempts: number;
  staleTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  listeners: Set<() => void>;
  // Cached snapshot: useSyncExternalStore requires a stable
  // reference between notifications. We cache the
  // { events, status, lastEventId } wrapper and only rebuild it
  // when one of the three fields actually changes.
  cachedSnapshot: SseSnapshot | null;
}

const streams = new Map<string, SharedStream>();

// Single frozen constant for `getServerSnapshot`: useSyncExternalStore
// expects the server snapshot to be the same reference for the
// lifetime of a request.
const SSE_SERVER_SNAPSHOT: SseSnapshot = Object.freeze({
  events: Object.freeze([]) as readonly RealtimeEvent[],
  status: "idle",
  lastEventId: null,
});

function notify(stream: SharedStream): void {
  for (const l of stream.listeners) l();
}

function snapshot(stream: SharedStream): SseSnapshot {
  const cached = stream.cachedSnapshot;
  if (
    cached !== null &&
    cached.events === stream.events &&
    cached.status === stream.status &&
    cached.lastEventId === stream.lastEventId
  ) {
    return cached;
  }
  const fresh: SseSnapshot = {
    events: stream.events,
    status: stream.status,
    lastEventId: stream.lastEventId,
  };
  stream.cachedSnapshot = fresh;
  return fresh;
}

function teardown(stream: SharedStream): void {
  if (stream.staleTimer) clearTimeout(stream.staleTimer);
  if (stream.reconnectTimer) clearTimeout(stream.reconnectTimer);
  stream.staleTimer = null;
  stream.reconnectTimer = null;
  if (stream.source) {
    stream.source.close();
    stream.source = null;
  }
}

function scheduleStaleCheck(stream: SharedStream): void {
  if (stream.staleTimer) clearTimeout(stream.staleTimer);
  stream.staleTimer = setTimeout(() => {
    if (Date.now() - stream.lastEventAt >= HEARTBEAT_STALE_MS && stream.status === "live") {
      stream.status = "stale";
      notify(stream);
    }
  }, HEARTBEAT_STALE_MS);
}

function scheduleReconnect(stream: SharedStream, goalSpaceId: string): void {
  if (stream.reconnectTimer) clearTimeout(stream.reconnectTimer);
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** stream.attempts, RECONNECT_CAP_MS);
  stream.attempts += 1;
  stream.status = "reconnecting";
  notify(stream);
  stream.reconnectTimer = setTimeout(() => {
    if (streams.get(goalSpaceId) === stream) {
      openStream(stream, goalSpaceId);
    }
  }, delay);
}

function openStream(stream: SharedStream, goalSpaceId: string): void {
  const ES = typeof EventSource !== "undefined" ? EventSource : undefined;
  if (!ES) {
    stream.status = "error";
    notify(stream);
    return;
  }

  stream.status = "connecting";
  stream.lastEventAt = Date.now();
  notify(stream);

  const source = new ES(`/api/v1/sse?goal_space_id=${encodeURIComponent(goalSpaceId)}`);
  stream.source = source;

  for (const type of SUBSCRIBED_EVENT_TYPES) {
    source.addEventListener(type, (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeEvent;
        if (stream.byId.has(payload.id)) return;
        stream.byId.add(payload.id);
        stream.events = [...stream.events, payload];
        stream.lastEventId = payload.id;
        stream.lastEventAt = Date.now();
        stream.status = "live";
        stream.attempts = 0;
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(`keplar.sse.lastEventId.${goalSpaceId}`, payload.id);
          }
        } catch {
          // localStorage may throw in private mode; tolerate.
        }
        notify(stream);
        scheduleStaleCheck(stream);
      } catch {
        // Malformed payload; drop it.
      }
    });
  }

  source.onerror = (): void => {
    if (stream.source?.readyState === EventSource?.CLOSED) {
      scheduleReconnect(stream, goalSpaceId);
    } else {
      stream.status = "error";
      notify(stream);
    }
  };

  source.onopen = (): void => {
    stream.status = "live";
    stream.attempts = 0;
    stream.lastEventAt = Date.now();
    notify(stream);
    scheduleStaleCheck(stream);
  };
}

function ensureStream(goalSpaceId: string): SharedStream {
  let stream = streams.get(goalSpaceId);
  if (!stream) {
    stream = {
      source: null,
      events: [],
      byId: new Set(),
      status: "idle",
      lastEventId: null,
      lastEventAt: 0,
      attempts: 0,
      staleTimer: null,
      reconnectTimer: null,
      listeners: new Set(),
      cachedSnapshot: null,
    };
    streams.set(goalSpaceId, stream);
    openStream(stream, goalSpaceId);
  }
  return stream;
}

function disposeStream(goalSpaceId: string): void {
  const stream = streams.get(goalSpaceId);
  if (!stream) return;
  teardown(stream);
  streams.delete(goalSpaceId);
}

// ─── React hook ─────────────────────────────────────────────────────

export function useSseStream(options: UseSseStreamOptions): UseSseStreamResult {
  const { goalSpaceId, initialLastEventId } = options;
  const listenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!goalSpaceId) return undefined;
    const stream = ensureStream(goalSpaceId);

    // Seed lastEventId from the caller's initial cursor (one-time only;
    // subsequent SSE updates override).
    if (initialLastEventId && stream.lastEventId === null) {
      stream.lastEventId = initialLastEventId;
    }

    const listener = (): void => {
      // Force a re-render via the state below.
      setStateTick((n) => n + 1);
    };
    listenerRef.current = listener;
    stream.listeners.add(listener);

    return (): void => {
      if (listenerRef.current) {
        stream.listeners.delete(listenerRef.current);
      }
      // If no more listeners, leave the stream open for a short grace
      // period; otherwise close it immediately. For simplicity in F2-09,
      // we close it on last unsubscribe to avoid leaks.
      if (stream.listeners.size === 0) {
        disposeStream(goalSpaceId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalSpaceId]);

  const [, setStateTick] = useState(0);

  const subscribe = (cb: () => void): (() => void) => {
    if (!goalSpaceId) return (): void => undefined;
    const stream = streams.get(goalSpaceId);
    if (!stream) return (): void => undefined;
    stream.listeners.add(cb);
    return (): void => {
      stream.listeners.delete(cb);
    };
  };

  const getSnapshot = (): SseSnapshot => {
    if (!goalSpaceId) return SSE_SERVER_SNAPSHOT;
    const stream = streams.get(goalSpaceId);
    if (!stream) return SSE_SERVER_SNAPSHOT;
    return snapshot(stream);
  };

  const getServerSnapshot = (): SseSnapshot => SSE_SERVER_SNAPSHOT;

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const reconnect = (): void => {
    if (!goalSpaceId) return;
    const stream = streams.get(goalSpaceId);
    if (!stream) return;
    teardown(stream);
    stream.attempts = 0;
    stream.status = "idle";
    notify(stream);
    openStream(stream, goalSpaceId);
  };

  return {
    events: snap.events,
    status: snap.status,
    lastEventId: snap.lastEventId,
    reconnect,
  };
}
