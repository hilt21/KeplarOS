"use client";

/**
 * CardRow (F2-09).
 *
 * Single row inside a CardLane: mono id + status dot + title (sans)
 * + assignee chip.
 */

import { StatusDot } from "./empty-state";
import type { CardResponse } from "@/lib/api/types";

export interface CardRowProps {
  readonly card: CardResponse;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}

export function CardRow({ card, selected, onSelect }: CardRowProps): React.ReactElement {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(card.id)}
        aria-pressed={selected}
        className={[
          "flex w-full items-center gap-[var(--space-sm)] border-b border-[var(--color-border)] px-[var(--space-sm)] py-[var(--space-xs)] text-left",
          selected ? "bg-[var(--color-surface-elevated)]" : "hover:bg-[var(--color-surface)]",
        ].join(" ")}
        style={{ transitionDuration: "var(--motion-hover)" }}
      >
        <StatusDot status={card.state} />
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-secondary)]">
          {card.display_id}
        </span>
        <span className="flex-1 truncate font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          {card.title}
        </span>
        {card.assigned_to !== null && (
          <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
            @{card.assigned_to.slice(0, 6)}
          </span>
        )}
      </button>
    </li>
  );
}
