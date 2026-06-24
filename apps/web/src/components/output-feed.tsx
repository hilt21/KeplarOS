"use client";

/**
 * OutputFeed (F2-09).
 *
 * Sticky-bottom list of command entries (command echo + result card).
 * Newest at bottom; max 100 entries (older fall off).
 */

import { StatusDot } from "./empty-state";

export type OutputEntryKind = "echo" | "success" | "error" | "info";

export interface OutputEntry {
  readonly id: string;
  readonly kind: OutputEntryKind;
  readonly text: string;
  readonly timestamp: string;
}

export interface OutputFeedProps {
  readonly entries: readonly OutputEntry[];
}

const KIND_BORDER: Record<OutputEntryKind, string> = {
  echo: "var(--color-border)",
  success: "var(--color-success)",
  error: "var(--color-error)",
  info: "var(--color-info)",
};

const KIND_LABEL: Record<OutputEntryKind, string> = {
  echo: "",
  success: "✓",
  error: "✗",
  info: "·",
};

export function OutputFeed({ entries }: OutputFeedProps): React.ReactElement {
  const recent = entries.slice(-100);
  return (
    <div
      role="log"
      aria-live="polite"
      className="max-h-[240px] overflow-y-auto border-t border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      {recent.length === 0 ? (
        <p className="px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
          {"// type /help for commands"}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {recent.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-[var(--space-2xs)] border-l-2 px-[var(--space-md)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]"
              style={{ borderLeftColor: KIND_BORDER[e.kind] }}
            >
              <span className="text-[var(--color-text-muted)]">{e.timestamp.slice(11, 19)}</span>
              {KIND_LABEL[e.kind] && (
                <span aria-hidden style={{ color: KIND_BORDER[e.kind] }}>
                  {KIND_LABEL[e.kind]}
                </span>
              )}
              <span className="text-[var(--color-text-primary)]">{e.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="px-[var(--space-md)] py-[var(--space-2xs)] text-right font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
        <StatusDot status="active" />
      </div>
    </div>
  );
}
