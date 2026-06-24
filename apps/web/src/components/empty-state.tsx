"use client";

/**
 * EmptyState (F2-09).
 *
 * Shared renderer for loading / empty / error states. NEVER renders
 * as a rounded card; always a centered mono caption with 1px divider
 * lines above and below, full available width.
 *
 * Tokens:
 *   - font: var(--font-jetbrains-mono, monospace) for mono caption
 *   - color: var(--color-text-muted) for default; var(--color-error) for errors
 *   - dividers: 1px solid var(--color-border)
 */

import type { ReactNode } from "react";

export type EmptyStateKind = "loading" | "empty" | "error";

export interface EmptyStateProps {
  readonly kind: EmptyStateKind;
  readonly caption: string;
  readonly action?: ReactNode;
}

export function EmptyState({ kind, caption, action }: EmptyStateProps): React.ReactElement {
  const colorClass =
    kind === "error" ? "text-[var(--color-error)]" : "text-[var(--color-text-muted)]";

  return (
    <div
      className={`flex flex-col items-center justify-center gap-[var(--space-sm)] py-[var(--space-2xl)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-small)] ${colorClass}`}
      role="status"
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <div className="w-full border-t border-[var(--color-border)]" />
      <span>{caption}</span>
      {action !== undefined && <div>{action}</div>}
      <div className="w-full border-t border-[var(--color-border)]" />
    </div>
  );
}

/**
 * 4px status dot. Status colors map to one of the five --color-* families.
 * Covers CardState (lane labels) + the higher-level status enum used by
 * goal spaces, confirmations, and execution rows.
 */
export type StatusDotStatus =
  | "backlog"
  | "todo"
  | "dev"
  | "review"
  | "done"
  | "proposed"
  | "in_progress"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "active"
  | "running"
  | "queued"
  | "needs_confirmation"
  | "pending"
  | "approved"
  | "rejected"
  | "draft"
  | "archived"
  | "high"
  | "critical"
  | "low"
  | "medium";

export interface StatusDotProps {
  readonly status: StatusDotStatus;
}

const STATUS_COLOR: Record<StatusDotStatus, string> = {
  backlog: "var(--color-text-muted)",
  todo: "var(--color-info)",
  dev: "var(--color-primary)",
  review: "var(--color-warning)",
  done: "var(--color-success)",
  proposed: "var(--color-info)",
  in_progress: "var(--color-primary)",
  blocked: "var(--color-warning)",
  completed: "var(--color-success)",
  failed: "var(--color-error)",
  cancelled: "var(--color-text-muted)",
  active: "var(--color-primary)",
  running: "var(--color-primary)",
  queued: "var(--color-info)",
  needs_confirmation: "var(--color-warning)",
  pending: "var(--color-warning)",
  approved: "var(--color-success)",
  rejected: "var(--color-error)",
  draft: "var(--color-text-muted)",
  archived: "var(--color-text-muted)",
  high: "var(--color-warning)",
  critical: "var(--color-error)",
  low: "var(--color-success)",
  medium: "var(--color-info)",
};

export function StatusDot({ status }: StatusDotProps): React.ReactElement {
  return (
    <span
      aria-hidden
      className="inline-block h-[6px] w-[6px] rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  );
}
