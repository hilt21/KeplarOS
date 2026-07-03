"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { TimelineMessage, type TimelineVariant } from "./timeline-message";
import { MessageInput } from "./message-input";
import type { RealtimeEvent } from "@/lib/api/types";
import { decideConfirmation } from "@/lib/api/confirmations";

export interface TimelineEntry {
  readonly id: string;
  readonly variant: TimelineVariant;
  readonly body: string;
  readonly meta?: string;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
  readonly onComment?: () => void;
}

interface TaskTimelineViewProps {
  readonly cardId: string;
  readonly displayId: string;
  readonly title: string;
  readonly state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";
  readonly assignee: string;
  readonly entries: readonly TimelineEntry[];
  readonly liveStream?: readonly RealtimeEvent[];
  readonly onSend: (text: string) => void;
}

const STATE_BG: Record<TaskTimelineViewProps["state"], string> = {
  backlog: "var(--color-text-muted)",
  todo: "var(--color-info)",
  dev: "var(--color-primary)",
  review: "var(--color-warning)",
  done: "var(--color-success)",
  blocked: "var(--color-error)",
  cancelled: "var(--color-text-muted)",
};

const STATES: TaskTimelineViewProps["state"][] = ["backlog", "todo", "dev", "review", "done"];

// F8: hard cap on the merged timeline. Keeps the most recent entries only.
const MAX_TIMELINE_ENTRIES = 200;

// Scroll-away threshold: any value < this many pixels from the bottom
// counts as "at bottom" so we don't fight sub-pixel jitter.
const SCROLL_BOTTOM_THRESHOLD_PX = 4;

// ─── RealtimeEvent → TimelineEntry transform (F8 transform map) ─────

function readString(record: Record<string, unknown>, key: string): string | null {
  const v = record[key];
  return typeof v === "string" ? v : null;
}

function eventToEntry(ev: RealtimeEvent): TimelineEntry {
  const base = (variant: TimelineVariant, body: string): TimelineEntry => ({
    id: ev.id,
    variant,
    body,
  });

  switch (ev.type) {
    case "ai_role_started": {
      const role = readString(ev.data, "role") ?? "agent";
      return base("agent-thinking", `${role} started`);
    }
    case "ai_role_completed": {
      const role = readString(ev.data, "role") ?? "agent";
      return base("system", `${role} completed`);
    }
    case "ai_role_failed": {
      const role = readString(ev.data, "role") ?? "agent";
      const reason = readString(ev.data, "reason");
      return base("system", reason === null ? `${role} failed` : `${role} failed: ${reason}`);
    }
    case "confirmation_requested": {
      const summary = readString(ev.data, "summary") ?? "Confirmation required";
      const confirmationId = readString(ev.data, "id") ?? ev.resource.id;
      return {
        id: ev.id,
        variant: "confirmation",
        body: summary,
        onApprove: () => {
          void decideConfirmation(confirmationId, { outcome: "approved" }).catch(() => {
            // Network/server errors are surfaced by the global SSE status;
            // keep this stub silent so we never throw into a render cycle.
          });
        },
        onReject: () => {
          void decideConfirmation(confirmationId, { outcome: "rejected" }).catch(() => {
            // Same rationale as onApprove.
          });
        },
      };
    }
    case "confirmation_decided": {
      return base("system", "confirmation decided");
    }
    case "card_state_changed": {
      const state = readString(ev.data, "state") ?? "updated";
      return base("system", `state → ${state}`);
    }
    case "card_blocked": {
      const reason = readString(ev.data, "reason");
      return base("system", reason === null ? "card blocked" : `card blocked: ${reason}`);
    }
    case "card_unblocked": {
      return base("system", "card unblocked");
    }
    case "card_assigned": {
      const assignee = readString(ev.data, "assignee");
      return base("system", assignee === null ? "card assigned" : `card assigned to ${assignee}`);
    }
    case "card_created":
    case "card_updated":
    case "goal_space_updated":
    case "goal_space_cancelled":
    case "session_started":
    case "session_completed":
    case "session_failed":
    case "node_board_created":
    case "node_board_updated":
    case "node_board_member_added":
    case "node_board_member_removed":
      return base("system", ev.type);
    default: {
      // Exhaustiveness guard — if a new RealtimeEventType is added, fall
      // back to a system message so unknown events are still surfaced.
      const _exhaustive: never = ev.type;
      return base("system", String(_exhaustive ?? ev.type));
    }
  }
}

// Filter the per-card SSE stream down to events whose resource matches
// this card. The hook delivers the full goal-space stream; the parent
// page passes the unfiltered array, so we filter here. Card events have
// resource.type === "card" (storage-format name retained for resilience).
function liveStreamForCard(
  events: readonly RealtimeEvent[],
  cardId: string,
): readonly RealtimeEvent[] {
  if (events.length === 0) return events;
  return events.filter((ev) => ev.resource.id === cardId || ev.resource.type === cardId);
}

export function TaskTimelineView({
  cardId,
  displayId,
  title,
  state,
  assignee,
  entries,
  liveStream,
  onSend,
}: TaskTimelineViewProps): ReactElement {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastEntryCountRef = useRef(entries.length);
  const seenLiveIdsRef = useRef<Set<string>>(new Set());
  const scrollTickRef = useRef<number | null>(null);

  const [merged, setMerged] = useState<readonly TimelineEntry[]>(entries);
  const [unreadCount, setUnreadCount] = useState(0);

  // ─── Merge live SSE events into the timeline (F8) ──────────────
  useEffect(() => {
    const stream = liveStream ?? [];
    const filtered = liveStreamForCard(stream, cardId);
    if (filtered.length === 0) return;

    const seen = seenLiveIdsRef.current;
    const fresh: RealtimeEvent[] = [];
    for (const ev of filtered) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      fresh.push(ev);
    }
    if (fresh.length === 0) return;

    const newEntries = fresh.map(eventToEntry);

    setMerged((prev) => {
      const next = [...prev, ...newEntries];
      return next.length > MAX_TIMELINE_ENTRIES ? next.slice(-MAX_TIMELINE_ENTRIES) : next;
    });

    // Authoritative bottom-check reads the live DOM so the unread
    // counter is correct even if the rAF-debounced onScroll hasn't
    // updated the ref yet (typical right after a prop-driven merge).
    const el = scrollerRef.current;
    const atBottom =
      el === null
        ? isAtBottomRef.current
        : el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX;
    if (!atBottom) {
      setUnreadCount((n) => n + newEntries.length);
    }
  }, [liveStream, cardId]);

  // Sync props.entries into local state on prop changes (page
  // navigations / hot reloads). Drop any seen-live ids so they are
  // not double-counted. Skip the very first run so the liveStream
  // effect's appended entries aren't wiped out on mount.
  const lastSyncedEntriesRef = useRef<readonly TimelineEntry[] | null>(null);
  useEffect(() => {
    if (lastSyncedEntriesRef.current === entries) return;
    lastSyncedEntriesRef.current = entries;
    // Preserve any liveStream-originated entries the merge effect
    // already appended so we don't blow them away on every entries
    // re-render.
    setMerged((prev) => {
      const incomingIds = new Set(entries.map((e) => e.id));
      const liveOnly = prev.filter(
        (e) => seenLiveIdsRef.current.has(e.id) && !incomingIds.has(e.id),
      );
      const next = [...entries, ...liveOnly];
      return next.length > MAX_TIMELINE_ENTRIES ? next.slice(-MAX_TIMELINE_ENTRIES) : next;
    });
    lastEntryCountRef.current = entries.length;
    for (const e of entries) seenLiveIdsRef.current.add(e.id);
  }, [entries]);

  // ─── Scroll handling (F8) ──────────────────────────────────────
  const updateIsAtBottom = useCallback((): void => {
    const el = scrollerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = atBottom;
    if (atBottom) setUnreadCount(0);
  }, []);

  useEffect(() => {
    // Recompute on resize / content changes since `scrollHeight` may
    // shift without a scroll event.
    const el = scrollerRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => updateIsAtBottom());
    return () => cancelAnimationFrame(raf);
  }, [merged.length, updateIsAtBottom]);

  // Auto-scroll on new entry only if user is at the bottom.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const grew = merged.length > lastEntryCountRef.current;
    lastEntryCountRef.current = merged.length;
    if (!grew) return;
    // Authoritative bottom check — read the live DOM so a stale ref
    // can't cause us to slam to the bottom and clear the unread
    // badge while the user is scrolled up.
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist <= SCROLL_BOTTOM_THRESHOLD_PX;
    if (atBottom) {
      el.scrollTop = el.scrollHeight;
      setUnreadCount(0);
    }
  }, [merged.length]);

  const onScroll = useCallback((): void => {
    // Throttle via rAF so we don't run on every wheel tick.
    if (scrollTickRef.current) return;
    scrollTickRef.current = requestAnimationFrame(() => {
      scrollTickRef.current = null;
      updateIsAtBottom();
    });
  }, [updateIsAtBottom]);

  useEffect(() => {
    return () => {
      if (scrollTickRef.current !== null) cancelAnimationFrame(scrollTickRef.current);
    };
  }, []);

  const scrollToBottom = useCallback((): void => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setUnreadCount(0);
  }, []);

  // Read the live DOM for the visibility check so the indicator is
  // correct on the very render where unreadCount was just bumped —
  // the rAF-debounced ref update lags one tick behind.
  const indicatorVisible =
    unreadCount > 0 &&
    (() => {
      const el = scrollerRef.current;
      if (el === null) return !isAtBottomRef.current;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      return dist > SCROLL_BOTTOM_THRESHOLD_PX;
    })();

  return (
    <div
      style={{
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-jetbrains-mono,monospace)",
              color: "var(--color-info)",
            }}
          >
            {displayId}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>
            {title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 8,
            fontSize: 10,
            fontFamily: "var(--font-jetbrains-mono,monospace)",
            color: "var(--color-text-muted)",
          }}
        >
          {STATES.map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  color: s === state ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  background: s === state ? STATE_BG[s] : "transparent",
                  padding: s === state ? "1px 6px" : "1px 0",
                  borderRadius: 2,
                  fontWeight: s === state ? 600 : 400,
                }}
              >
                {s}
              </span>
              {s !== "done" && <span>→</span>}
            </div>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--color-text-muted)" }}>{assignee}</span>
        </div>
      </div>

      <div
        ref={scrollerRef}
        role="log"
        aria-live="polite"
        data-testid="timeline-scroller"
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          position: "relative",
        }}
      >
        {merged.map((e) => (
          <TimelineMessage
            key={e.id}
            variant={e.variant}
            body={e.body}
            {...(e.meta !== undefined ? { meta: e.meta } : {})}
            {...(e.onApprove ? { onApprove: e.onApprove } : {})}
            {...(e.onReject ? { onReject: e.onReject } : {})}
            {...(e.onComment ? { onComment: e.onComment } : {})}
          />
        ))}

        {indicatorVisible && (
          <button
            type="button"
            data-testid="timeline-new-messages-indicator"
            onClick={scrollToBottom}
            style={{
              position: "sticky",
              bottom: 12,
              marginTop: 8,
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
              padding: "6px 14px",
              fontSize: 11,
              fontFamily: "var(--font-jetbrains-mono,monospace)",
              color: "#FFF",
              background: "var(--color-info)",
              border: "none",
              borderRadius: 999,
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              cursor: "pointer",
              animation: "var(--motion-message-enter)",
            }}
            aria-label={`${unreadCount} new messages — jump to latest`}
          >
            ↓ {unreadCount} new message{unreadCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <MessageInput onSend={onSend} />
    </div>
  );
}
