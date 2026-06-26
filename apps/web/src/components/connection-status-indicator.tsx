"use client";

/**
 * ConnectionStatusIndicator (F2-09).
 *
 * Top-bar 6px dot reflecting SSE state:
 *   idle         → no dot
 *   connecting   → blue
 *   live         → green
 *   reconnecting → amber, pulses at --motion-hover cadence
 *   stale        → amber, no pulse
 *   error        → red
 */

import type { SseStatus } from "@/lib/realtime/useSseStream";

export interface ConnectionStatusIndicatorProps {
  readonly status: SseStatus;
}

const STATUS_COLOR: Record<SseStatus, string | null> = {
  idle: null,
  connecting: "var(--color-info)",
  live: "var(--color-success)",
  reconnecting: "var(--color-warning)",
  stale: "var(--color-warning)",
  error: "var(--color-error)",
};

const STATUS_LABEL: Record<SseStatus, string> = {
  idle: "idle",
  connecting: "connecting…",
  live: "live",
  reconnecting: "reconnecting…",
  stale: "stale",
  error: "error",
};

export function ConnectionStatusIndicator({
  status,
}: ConnectionStatusIndicatorProps): React.ReactElement | null {
  const color = STATUS_COLOR[status];
  if (color === null) return null;

  const pulse = status === "reconnecting";

  return (
    <span
      className="inline-flex items-center gap-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]"
      aria-label={STATUS_LABEL[status]}
      title={STATUS_LABEL[status]}
    >
      <span
        aria-hidden
        className={[
          "inline-block h-[6px] w-[6px] rounded-full",
          pulse ? "animate-[pulse_1s_ease-in-out_infinite]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backgroundColor: color,
          ...(pulse ? { animationDuration: "var(--motion-hover)" } : {}),
        }}
      />
    </span>
  );
}
