"use client";

/**
 * ConfirmationQueue (F2-09).
 *
 * Right-sidebar collapsible list of pending confirmations. Each row:
 * mono id + sans title + [approve] / [reject] buttons. Buttons disable
 * during in-flight POST (shown via 1px underline, no spinner).
 */

import { useState } from "react";
import type { HumanConfirmationResponse } from "@/lib/api/types";

export interface ConfirmationQueueProps {
  readonly confirmations: readonly HumanConfirmationResponse[];
  readonly onDecide: (id: string, outcome: "approved" | "rejected") => Promise<void>;
}

export function ConfirmationQueue({
  confirmations,
  onDecide,
}: ConfirmationQueueProps): React.ReactElement {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const handleDecide = async (id: string, outcome: "approved" | "rejected"): Promise<void> => {
    setPending((p) => new Set(p).add(id));
    try {
      await onDecide(id, outcome);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <section className="flex flex-col border-b border-[var(--color-border)]">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)] text-left hover:bg-[var(--color-surface)]"
        style={{ transitionDuration: "var(--motion-hover)" }}
      >
        <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          Pending confirmations
        </span>
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
          {String(confirmations.length)} ▾
        </span>
      </button>

      {!collapsed && (
        <ul className="divide-y divide-[var(--color-border)]">
          {confirmations.length === 0 && (
            <li className="px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
              {"// no pending confirmations"}
            </li>
          )}
          {confirmations.map((c) => {
            const isPending = pending.has(c.id);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-[var(--space-xs)] px-[var(--space-md)] py-[var(--space-sm)]"
              >
                <div className="flex items-center justify-between gap-[var(--space-sm)]">
                  <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-secondary)]">
                    {c.id.slice(0, 8)}
                  </span>
                  <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
                    {c.card_title}
                  </span>
                </div>
                <p className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
                  {c.trigger_type}
                </p>
                <div className="flex gap-[var(--space-2xs)]">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void handleDecide(c.id, "approved")}
                    className={[
                      "border border-[var(--color-border)] bg-transparent px-[var(--space-sm)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-success)]",
                      isPending
                        ? "underline underline-offset-2"
                        : "hover:border-[var(--color-success)]",
                    ].join(" ")}
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void handleDecide(c.id, "rejected")}
                    className={[
                      "border border-[var(--color-border)] bg-transparent px-[var(--space-sm)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-error)]",
                      isPending
                        ? "underline underline-offset-2"
                        : "hover:border-[var(--color-error)]",
                    ].join(" ")}
                  >
                    reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
