"use client";

/**
 * CardLane (F2-09).
 *
 * Single state's column: status dot + sans label + mono count +
 * list of CardRow. Empty state shows `// no cards in <state>`.
 */

import { CardRow } from "./card-row";
import { StatusDot } from "./empty-state";
import type { CardResponse, CardState } from "@/lib/api/types";

export interface CardLaneProps {
  readonly state: CardState;
  readonly cards: readonly CardResponse[];
  readonly selectedCardId: string | null;
  readonly onSelect: (id: string) => void;
}

const STATE_LABEL: Record<CardState, string> = {
  backlog: "backlog",
  todo: "todo",
  dev: "dev",
  review: "review",
  done: "done",
  blocked: "blocked",
  cancelled: "cancelled",
};

export function CardLane({
  state,
  cards,
  selectedCardId,
  onSelect,
}: CardLaneProps): React.ReactElement {
  return (
    <section
      data-testid={`lane-${state}`}
      className="flex w-[280px] shrink-0 flex-col border-r border-[var(--color-border)]"
    >
      <header className="flex items-center gap-[var(--space-2xs)] border-b border-[var(--color-border)] px-[var(--space-sm)] py-[var(--space-xs)]">
        <StatusDot status={state} />
        <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          {STATE_LABEL[state]}
        </span>
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
          {String(cards.length)}
        </span>
      </header>
      {cards.length === 0 ? (
        <p className="px-[var(--space-sm)] py-[var(--space-md)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
          {`// no cards in ${STATE_LABEL[state]}`}
        </p>
      ) : (
        <ul role="list" className="flex-1 overflow-y-auto">
          {cards.map((c) => (
            <CardRow key={c.id} card={c} selected={selectedCardId === c.id} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
}
