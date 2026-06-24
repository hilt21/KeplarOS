"use client";

/**
 * AuditTimeline (F2-09).
 *
 * Right-sidebar chronological log of all SSE events received for the
 * goal space. Filterable by event type (top filter chips).
 */

import { useState } from "react";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/api/types";

const TYPE_COLOR: Partial<Record<RealtimeEventType, string>> = {
  card_created: "var(--color-info)",
  card_state_changed: "var(--color-info)",
  card_blocked: "var(--color-warning)",
  card_updated: "var(--color-info)",
  card_assigned: "var(--color-info)",
  card_unblocked: "var(--color-success)",
  ai_role_started: "var(--color-info)",
  ai_role_completed: "var(--color-success)",
  ai_role_failed: "var(--color-error)",
  confirmation_requested: "var(--color-warning)",
  confirmation_decided: "var(--color-success)",
  goal_space_updated: "var(--color-text-muted)",
  goal_space_cancelled: "var(--color-error)",
  session_started: "var(--color-info)",
  session_completed: "var(--color-success)",
  session_failed: "var(--color-error)",
  node_board_created: "var(--color-info)",
  node_board_updated: "var(--color-info)",
  node_board_member_added: "var(--color-info)",
  node_board_member_removed: "var(--color-warning)",
};

export interface AuditTimelineProps {
  readonly events: readonly RealtimeEvent[];
}

const FILTER_TYPES: readonly RealtimeEventType[] = [
  "card_created",
  "card_state_changed",
  "card_blocked",
  "ai_role_started",
  "ai_role_completed",
  "ai_role_failed",
  "confirmation_requested",
  "confirmation_decided",
];

function timeOnly(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function AuditTimeline({ events }: AuditTimelineProps): React.ReactElement {
  const [activeFilters, setActiveFilters] = useState<Set<RealtimeEventType>>(new Set());

  const filtered =
    activeFilters.size === 0 ? events : events.filter((e) => activeFilters.has(e.type));

  return (
    <section className="flex flex-col">
      <header className="border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          Audit timeline
        </span>
        <span className="ml-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
          {String(filtered.length)}
        </span>
      </header>
      <div className="flex flex-wrap gap-[var(--space-2xs)] border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-xs)]">
        {FILTER_TYPES.map((t) => {
          const on = activeFilters.has(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setActiveFilters((cur) => {
                  const next = new Set(cur);
                  if (next.has(t)) next.delete(t);
                  else next.add(t);
                  return next;
                })
              }
              className={[
                "border border-[var(--color-border)] px-[var(--space-2xs)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase",
                on
                  ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
              ].join(" ")}
              style={{ transitionDuration: "var(--motion-hover)" }}
            >
              {t}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilters(new Set())}
            className="px-[var(--space-2xs)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            clear
          </button>
        )}
      </div>
      <ul className="max-h-[400px] divide-y divide-[var(--color-border)] overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
            {"// idle"}
          </li>
        )}
        {filtered
          .slice()
          .reverse()
          .map((ev) => (
            <li
              key={ev.id}
              className="flex flex-col gap-[var(--space-2xs)] px-[var(--space-md)] py-[var(--space-xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]"
            >
              <div className="flex items-center gap-[var(--space-2xs)]">
                <span className="text-[var(--color-text-muted)]">[{timeOnly(ev.occurred_at)}]</span>
                <span className="text-[var(--color-text-secondary)]">{ev.id.slice(0, 8)}</span>
                <span style={{ color: TYPE_COLOR[ev.type] ?? "var(--color-text-primary)" }}>
                  {ev.type}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {ev.resource.type}:{ev.resource.id.slice(0, 8)}
                </span>
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}
