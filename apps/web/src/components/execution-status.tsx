"use client";

/**
 * ExecutionStatus (F2-09).
 *
 * Right-sidebar panel showing AI roles currently in-flight. Rows are
 * derived from the deduped RealtimeEvent[]: an `ai_role_started`
 * event is open until a matching `ai_role_completed` or
 * `ai_role_failed` event arrives for the same `resource.id`.
 *
 * Updates automatically when new events arrive via the SSE stream.
 */

import { useEffect, useState } from "react";
import type { RealtimeEvent } from "@/lib/api/types";

export interface ExecutionStatusProps {
  readonly events: readonly RealtimeEvent[];
}

interface InFlightRow {
  readonly resourceId: string;
  readonly startedAt: string;
}

function deriveInFlight(events: readonly RealtimeEvent[]): readonly InFlightRow[] {
  const started = new Map<string, string>();
  for (const ev of events) {
    if (ev.type === "ai_role_started") {
      started.set(ev.resource.id, ev.occurred_at);
    } else if (ev.type === "ai_role_completed" || ev.type === "ai_role_failed") {
      started.delete(ev.resource.id);
    }
  }
  return [...started.entries()].map(([resourceId, startedAt]) => ({ resourceId, startedAt }));
}

function useTick(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return (): void => clearInterval(t);
  }, [ms]);
  return now;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

export function ExecutionStatus({ events }: ExecutionStatusProps): React.ReactElement {
  const inFlight = deriveInFlight(events);
  const now = useTick(1000);

  return (
    <section className="flex flex-col border-b border-[var(--color-border)]">
      <header className="border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          In-flight executions
        </span>
        <span className="ml-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
          {String(inFlight.length)}
        </span>
      </header>
      <ul className="divide-y divide-[var(--color-border)]">
        {inFlight.length === 0 && (
          <li className="px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
            {"// idle"}
          </li>
        )}
        {inFlight.map((row) => {
          const elapsed = Math.max(0, now - new Date(row.startedAt).getTime());
          return (
            <li
              key={row.resourceId}
              className="flex items-center justify-between gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]"
            >
              <span className="text-[var(--color-text-secondary)]">
                {row.resourceId.slice(0, 8)}
              </span>
              <span className="text-[var(--color-text-muted)]">
                {formatElapsed(elapsed)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}