"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { TimelineMessage, type TimelineVariant } from "./timeline-message";
import { MessageInput } from "./message-input";

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

const STATES: TaskTimelineViewProps["state"][] = [
  "backlog",
  "todo",
  "dev",
  "review",
  "done",
];

export function TaskTimelineView({
  cardId,
  displayId,
  title,
  state,
  assignee,
  entries,
  onSend,
}: TaskTimelineViewProps): ReactElement {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastEntryCountRef = useRef(entries.length);

  // Auto-scroll to bottom on new entry unless user scrolled up
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const grew = entries.length > lastEntryCountRef.current;
    lastEntryCountRef.current = entries.length;
    if (!grew) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 100) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries.length]);

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
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</div>
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
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {entries.map((e) => (
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
      </div>

      <MessageInput onSend={onSend} />
    </div>
  );
}
