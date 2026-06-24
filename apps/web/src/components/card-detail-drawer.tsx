"use client";

/**
 * CardDetailDrawer (F2-09).
 *
 * Slides in from right (width 480px). Three tabs: OVERVIEW /
 * TRANSITIONS / AUDIT. Sticky footer with legal transitions as bordered
 * buttons (no shadows, no rounded pills).
 *
 * Legal transitions are a static map per state (NOT a state-machine
 * call), per review R8.
 */

import { useEffect, useState } from "react";
import { useShortcuts } from "@/lib/keyboard/useShortcut";
import { EmptyState } from "./empty-state";
import type { CardResponse, CardState } from "@/lib/api/types";

const LEGAL_TRANSITIONS: Readonly<Record<CardState, readonly CardState[]>> = {
  backlog: ["todo"],
  todo: ["dev", "blocked"],
  dev: ["review", "blocked"],
  review: ["done", "blocked"],
  done: [],
  blocked: ["backlog", "todo", "dev", "review"],
  cancelled: [],
};

export interface CardDetailDrawerProps {
  readonly card: CardResponse | null;
  readonly onClose: () => void;
  readonly onTransition: (target: CardState) => void;
  readonly transitions: readonly {
    id: string;
    from_state: CardState | null;
    to_state: CardState;
    trigger: string;
    actor: string;
    timestamp: string;
  }[];
  readonly auditTrail: readonly {
    id: string;
    action: string;
    actor: string;
    actor_id: string | null;
    timestamp: string;
  }[];
}

type Tab = "OVERVIEW" | "TRANSITIONS" | "AUDIT";

export function CardDetailDrawer({
  card,
  onClose,
  onTransition,
  transitions,
  auditTrail,
}: CardDetailDrawerProps): React.ReactElement | null {
  const [tab, setTab] = useState<Tab>("OVERVIEW");

  useShortcuts([
    {
      id: "close-drawer",
      chord: { key: "escape" },
      scope: "modal",
      label: "Close drawer",
      handler: () => onClose(),
    },
  ]);

  useEffect(() => {
    if (card === null) setTab("OVERVIEW");
  }, [card]);

  if (card === null) return null;

  const legal = LEGAL_TRANSITIONS[card.state] ?? [];

  return (
    <aside
      role="dialog"
      aria-label={card.title}
      className="fixed inset-y-0 right-0 z-20 flex w-[480px] flex-col border-l border-[var(--color-border)] bg-[var(--color-bg)]"
      style={{ animationDuration: "var(--motion-enter)" }}
    >
      <header className="flex items-center justify-between gap-[var(--space-sm)] border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <div className="flex items-center gap-[var(--space-sm)]">
          <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
            {card.display_id}
          </span>
          <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-h3)] text-[var(--color-text-primary)]">
            {card.title}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close drawer"
          onClick={onClose}
          className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-small)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          style={{ transitionDuration: "var(--motion-hover)" }}
        >
          esc
        </button>
      </header>

      <nav
        role="tablist"
        aria-label="Card detail tabs"
        className="flex border-b border-[var(--color-border)] text-[var(--font-micro)] uppercase tracking-wider"
      >
        {(["OVERVIEW", "TRANSITIONS", "AUDIT"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={[
              "border-r border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-xs)] font-[var(--font-jetbrains-mono,monospace)]",
              tab === t
                ? "text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
            style={{ transitionDuration: "var(--motion-hover)" }}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {tab === "OVERVIEW" && (
          <div className="flex flex-col gap-[var(--space-md)] p-[var(--space-md)]">
            <p className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-body)] text-[var(--color-text-primary)]">
              {card.description || (
                <span className="italic text-[var(--color-text-muted)]">{"// no description"}</span>
              )}
            </p>
            <dl className="grid grid-cols-[120px_1fr] gap-y-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]">
              <dt className="text-[var(--color-text-muted)]">state</dt>
              <dd className="text-[var(--color-text-primary)]">{card.state}</dd>
              <dt className="text-[var(--color-text-muted)]">priority</dt>
              <dd className="text-[var(--color-text-primary)]">{card.priority}</dd>
              <dt className="text-[var(--color-text-muted)]">risk</dt>
              <dd className="text-[var(--color-text-primary)]">{card.risk_level}</dd>
              <dt className="text-[var(--color-text-muted)]">assigned</dt>
              <dd className="text-[var(--color-text-primary)]">
                {card.assigned_to ?? (
                  <span className="italic text-[var(--color-text-muted)]">unassigned</span>
                )}
              </dd>
            </dl>
          </div>
        )}

        {tab === "TRANSITIONS" && (
          <ul className="divide-y divide-[var(--color-border)]">
            {transitions.length === 0 && (
              <EmptyState kind="empty" caption="// no transitions yet" />
            )}
            {transitions.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-[var(--space-2xs)] px-[var(--space-md)] py-[var(--space-xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]"
              >
                <span className="text-[var(--color-text-muted)]">{t.timestamp}</span>
                <span>
                  <span className="text-[var(--color-text-secondary)]">{t.from_state ?? "—"}</span>
                  <span className="px-[var(--space-2xs)] text-[var(--color-text-muted)]">→</span>
                  <span className="text-[var(--color-text-primary)]">{t.to_state}</span>
                  <span className="px-[var(--space-2xs)] text-[var(--color-text-muted)]">via</span>
                  <span className="text-[var(--color-text-secondary)]">{t.trigger}</span>
                </span>
                <span className="text-[var(--color-text-muted)]">by {t.actor}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "AUDIT" && (
          <ul className="divide-y divide-[var(--color-border)]">
            {auditTrail.length === 0 && (
              <EmptyState kind="empty" caption="// no audit entries yet" />
            )}
            {auditTrail.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-[var(--space-2xs)] px-[var(--space-md)] py-[var(--space-xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]"
              >
                <span className="text-[var(--color-text-muted)]">{a.timestamp}</span>
                <span>
                  <span className="text-[var(--color-text-secondary)]">{a.action}</span>
                  <span className="px-[var(--space-2xs)] text-[var(--color-text-muted)]">by</span>
                  <span className="text-[var(--color-text-primary)]">{a.actor}</span>
                  {a.actor_id !== null && (
                    <span className="px-[var(--space-2xs)] text-[var(--color-text-muted)]">
                      #{a.actor_id.slice(0, 6)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-[var(--space-2xs)] border-t border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="mr-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase tracking-wider text-[var(--color-text-muted)]">
          transitions
        </span>
        {legal.length === 0 && (
          <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
            {"// terminal"}
          </span>
        )}
        {legal.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTransition(t)}
            className="border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-[var(--space-sm)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-primary)] hover:border-[var(--color-primary)]"
            style={{ transitionDuration: "var(--motion-hover)" }}
          >
            → {t}
          </button>
        ))}
      </footer>
    </aside>
  );
}
