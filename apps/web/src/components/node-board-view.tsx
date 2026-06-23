"use client";

/**
 * NodeBoardView (F2-09).
 *
 * Renders one CardLane per CardState (horizontal row). Receives cards
 * filtered by node board; groups by state.
 */

import { useMemo, useState } from "react";
import { CardLane } from "./card-lane";
import { uiStore } from "@/lib/state/ui-store";
import type { CardResponse, CardState, NodeBoardResponse } from "@/lib/api/types";

const STATE_ORDER: readonly CardState[] = [
  "backlog",
  "todo",
  "dev",
  "review",
  "blocked",
  "done",
  "cancelled",
];

export interface NodeBoardViewProps {
  readonly board: NodeBoardResponse;
  readonly cards: readonly CardResponse[];
  readonly onSelectCard: (id: string) => void;
}

export function NodeBoardView({ board, cards, onSelectCard }: NodeBoardViewProps): React.ReactElement {
  const selectedCardId = useState(uiStore.get().selectedCardId)[0];

  const grouped = useMemo(() => {
    const map = new Map<CardState, CardResponse[]>();
    for (const state of STATE_ORDER) map.set(state, []);
    for (const c of cards) {
      const list = map.get(c.state);
      if (list) list.push(c);
    }
    return map;
  }, [cards]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-[var(--space-sm)] border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <h2 className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-h3)] text-[var(--color-text-primary)]">
          {board.name}
        </h2>
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-secondary)]">
          {board.key}
        </span>
        <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
          {board.members.length} members
        </span>
      </header>
      <div className="flex flex-1 overflow-x-auto">
        {STATE_ORDER.map((state) => (
          <CardLane
            key={state}
            state={state}
            cards={grouped.get(state) ?? []}
            selectedCardId={selectedCardId}
            onSelect={onSelectCard}
          />
        ))}
      </div>
    </div>
  );
}