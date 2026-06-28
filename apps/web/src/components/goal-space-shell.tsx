/**
 * GoalSpaceShell (F2-09).
 *
 * Client wrapper for the goal-space detail page. Owns:
 *   - replay hydration (loops while has_more, cap 5 calls)
 *   - SSE hook (one EventSource per page)
 *   - selection state (selected card id)
 *   - card detail drawer mount
 *   - board store hydration from replay + SSE events
 *   - output feed command handler
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NodeBoardView } from "./node-board-view";
import { CardDetailDrawer } from "./card-detail-drawer";
import { CommandInput } from "./command-input";
import { OutputFeed, type OutputEntry } from "./output-feed";
import { EmptyState } from "./empty-state";
import { CreateNodeBoardForm } from "./create-node-board-form";
import { fetchReplay } from "@/lib/realtime/replay";
import { useSseStream } from "@/lib/realtime/useSseStream";
import { boardStore, useBoardStore } from "@/lib/state/board-store";
import { uiStore, useUiStore } from "@/lib/state/ui-store";
import { decideConfirmation } from "@/lib/api/confirmations";
import { executeCard } from "@/lib/api/cards";
import { parseCommand } from "@/lib/keyboard/command-parser";
import { getStoredTheme, setTheme } from "@/lib/theme/tmTheme";
import type {
  CardResponse,
  CardState,
  GoalSpaceDetailResponse,
  HumanConfirmationResponse,
  NodeBoardResponse,
  RealtimeEvent,
} from "@/lib/api/types";

export interface GoalSpaceShellProps {
  readonly snapshot: GoalSpaceDetailResponse;
  readonly boards: readonly NodeBoardResponse[];
  readonly confirmations: readonly HumanConfirmationResponse[];
}

export function GoalSpaceShell({
  snapshot,
  boards,
  confirmations,
}: GoalSpaceShellProps): React.ReactElement {
  const goalSpaceId = snapshot.id;
  const initialLastEventId =
    typeof window !== "undefined"
      ? window.localStorage.getItem(`keplar.sse.lastEventId.${goalSpaceId}`)
      : null;

  const sse = useSseStream({
    goalSpaceId,
    initialLastEventId,
  });
  const selectedCardId = useUiStore((s) => s.selectedCardId);
  const boardState = useBoardStore(goalSpaceId, (s) => s);
  const router = useRouter();

  // F2-03's snapshot.cards is always `[]` by design (the goal-space
  // detail endpoint returns counts only and delegates full card
  // detail to the F2-05 list endpoint). We fetch the full card list
  // here on mount and merge into the live-cards view. After a UI
  // createCard call we also push the returned card into this state
  // for an immediate render without waiting for the refresh.
  const [listCards, setListCards] = useState<CardResponse[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const { listCards: fetchList } = await import("@/lib/api/cards");
        const result = await fetchList(goalSpaceId);
        if (!cancelled) setListCards([...result.items]);
      } catch {
        // Best-effort: the SSE feed will eventually deliver card_created
        // events; the UI can recover from there.
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [goalSpaceId]);

  const refreshCards = useCallback(async (): Promise<void> => {
    try {
      const { listCards: fetchList } = await import("@/lib/api/cards");
      const result = await fetchList(goalSpaceId);
      setListCards([...result.items]);
    } catch {
      // Best-effort.
    }
  }, [goalSpaceId]);

  // Hydrate from replay on mount; merge into board store.
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      let after: string | null = initialLastEventId;
      for (let i = 0; i < 5; i += 1) {
        if (cancelled) return;
        try {
          const result = await fetchReplay(goalSpaceId, after);
          boardStore.appendMany(goalSpaceId, result.events);
          if (!result.has_more) return;
          after = result.next_after_id ?? null;
          if (after === null) return;
        } catch {
          return;
        }
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [goalSpaceId, initialLastEventId]);

  // Mirror SSE events into the board store.
  useEffect(() => {
    if (sse.events.length === 0) return;
    boardStore.appendMany(goalSpaceId, sse.events);
  }, [goalSpaceId, sse.events]);

  const handleSelectCard = useCallback((id: string) => {
    uiStore.set({ selectedCardId: id });
  }, []);

  const handleCloseDrawer = useCallback(() => {
    uiStore.set({ selectedCardId: null });
  }, []);

  // Apply SSE state-change events to the snapshot's cards list.
  // F2-03 returns `cards: readonly unknown[]` (always empty by
  // design — full card detail lives at the F2-05 list endpoint,
  // fetched above into `listCards`). The view merges both: the
  // server-rendered list is sparse so the `listCards` result is
  // the authoritative source.
  const liveCards: CardResponse[] = useMemo(() => {
    const map = new Map<string, CardResponse>();
    for (const c of listCards) {
      map.set(c.id, c);
    }
    for (const raw of snapshot.cards) {
      if (typeof raw !== "object" || raw === null) continue;
      const c = raw as Partial<CardResponse>;
      if (typeof c.id !== "string") continue;
      if (map.has(c.id)) continue;
      map.set(c.id, {
        id: c.id,
        display_id: typeof c.display_id === "string" ? c.display_id : c.id.slice(0, 8),
        goal_space_id: c.goal_space_id ?? snapshot.id,
        node_board_id: c.node_board_id ?? "",
        title: c.title ?? "",
        description: c.description ?? "",
        state: (c.state ?? "backlog") as CardState,
        assigned_to: c.assigned_to ?? null,
        priority: c.priority ?? 0,
        risk_level: c.risk_level ?? "low",
        evidence: c.evidence ?? [],
        confidence: c.confidence ?? null,
        blocked_reason: c.blocked_reason ?? null,
        blocked_at: c.blocked_at ?? null,
        dependencies: c.dependencies ?? [],
        tags: c.tags ?? [],
        context: c.context ?? {},
        created_at: c.created_at ?? new Date().toISOString(),
        updated_at: c.updated_at ?? new Date().toISOString(),
      });
    }
    for (const ev of boardState.events) {
      const id = ev.resource.id;
      const existing = map.get(id);
      if (!existing) continue;
      if (
        ev.type === "card_state_changed" ||
        ev.type === "card_blocked" ||
        ev.type === "card_unblocked"
      ) {
        const next = ev.data as { state?: CardState };
        if (typeof next.state === "string") {
          map.set(id, { ...existing, state: next.state });
        }
      } else if (ev.type === "card_assigned") {
        const next = ev.data as { assigned_to?: string | null };
        if ("assigned_to" in next) {
          map.set(id, { ...existing, assigned_to: next.assigned_to ?? null });
        }
      }
    }
    return Array.from(map.values());
  }, [snapshot.cards, snapshot.id, boardState.events]);

  const selectedCard =
    selectedCardId !== null ? (liveCards.find((c) => c.id === selectedCardId) ?? null) : null;

  const handleTransition = useCallback(
    async (target: CardState) => {
      if (selectedCardId === null) return;
      // The state machine owns state transitions; in F2-09 we surface
      // the requested target via the execute path, where the AI role
      // applies the legal transition. Direct writes are rejected by the
      // /cards/:id PATCH endpoint.
      try {
        appendOutput({
          kind: "info",
          text: `transition request: ${selectedCardId.slice(0, 8)} → ${target} (run /execute to advance)`,
        });
      } catch (err) {
        appendOutput({
          kind: "error",
          text: `transition failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    [selectedCardId],
  );

  // ─── Command output feed ──────────────────────────────────────────

  const [outputEntries, setOutputEntries] = useState<OutputEntry[]>([]);
  const outputIdRef = useRef(0);
  const appendOutput = useCallback((entry: Omit<OutputEntry, "id" | "timestamp">) => {
    setOutputEntries((cur) => [
      ...cur,
      {
        id: `out-${String((outputIdRef.current += 1))}`,
        timestamp: new Date().toISOString(),
        ...entry,
      },
    ]);
  }, []);

  const handleCommand = useCallback(
    async (raw: string) => {
      appendOutput({ kind: "echo", text: raw });
      const parsed = parseCommand(raw);
      try {
        switch (parsed.kind) {
          case "help": {
            for (const line of (await import("@/lib/keyboard/command-parser")).helpText()) {
              appendOutput({ kind: "info", text: line });
            }
            return;
          }
          case "create-card": {
            const board = boards[0];
            if (!board) {
              appendOutput({ kind: "error", text: "no node board in goal space" });
              return;
            }
            const card = await (
              await import("@/lib/api/cards")
            ).createCard(goalSpaceId, {
              title: parsed.title,
              node_board_id: board.id,
            });
            // SSE event for card_created carries only summary fields.
            // Push the full card (returned by the API) into the local
            // card-list state so the UI updates immediately; the SSE
            // feed will eventually redeliver and re-render.
            setListCards((prev) => [...prev, card]);
            appendOutput({ kind: "success", text: `${card.display_id} created` });
            return;
          }
          case "execute": {
            await executeCard(parsed.cardId, "Backlog Refiner");
            appendOutput({
              kind: "success",
              text: `execute queued for ${parsed.cardId.slice(0, 8)}`,
            });
            return;
          }
          case "list-cards": {
            const { items } = await (
              await import("@/lib/api/cards")
            ).listCards(goalSpaceId, {
              ...(parsed.state ? { state: parsed.state as CardState } : {}),
            });
            for (const c of items)
              appendOutput({ kind: "info", text: `${c.display_id} ${c.state} ${c.title}` });
            return;
          }
          case "transition": {
            appendOutput({
              kind: "info",
              text: `${parsed.cardId.slice(0, 8)} → ${parsed.targetState}: state machine owns transitions; use /execute ${parsed.cardId.slice(0, 8)} to advance.`,
            });
            return;
          }
          case "block": {
            await (
              await import("@/lib/api/cards")
            ).blockCard(parsed.cardId, parsed.reason ?? "blocked via command");
            appendOutput({ kind: "success", text: `${parsed.cardId.slice(0, 8)} blocked` });
            return;
          }
          case "unblock": {
            await (await import("@/lib/api/cards")).unblockCard(parsed.cardId, "todo");
            appendOutput({ kind: "success", text: `${parsed.cardId.slice(0, 8)} unblocked` });
            return;
          }
          case "approve": {
            await decideConfirmation(parsed.confirmationId, {
              outcome: "approved",
              ...(parsed.comment ? { comment: parsed.comment } : {}),
            });
            appendOutput({
              kind: "success",
              text: `${parsed.confirmationId.slice(0, 8)} approved`,
            });
            return;
          }
          case "reject": {
            await decideConfirmation(parsed.confirmationId, {
              outcome: "rejected",
              ...(parsed.reason ? { reason: parsed.reason } : {}),
            });
            appendOutput({
              kind: "success",
              text: `${parsed.confirmationId.slice(0, 8)} rejected`,
            });
            return;
          }
          case "cancel": {
            await (
              await import("@/lib/api/goal-spaces")
            ).cancelGoalSpace(goalSpaceId, "cancelled via command");
            appendOutput({ kind: "success", text: "goal space cancelled" });
            return;
          }
          case "complete": {
            await (await import("@/lib/api/goal-spaces")).completeGoalSpace(goalSpaceId);
            appendOutput({ kind: "success", text: "goal space completed" });
            return;
          }
          case "unknown":
            appendOutput({ kind: "error", text: "// unrecognised input. type /help." });
            return;
        }
      } catch (err) {
        appendOutput({
          kind: "error",
          text: `${parsed.kind} failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
    [appendOutput, boards, goalSpaceId],
  );

  // ─── Sync theme to ui-store ───────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = getStoredTheme();
    if (id !== uiStore.get().themeId) {
      uiStore.set({ themeId: id });
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {boards.length === 0 ? (
            <EmptyState
              kind="empty"
              caption="// no node boards yet"
              action={<CreateNodeBoardForm goalSpaceId={goalSpaceId} />}
            />
          ) : (
            <NodeBoardView
              board={boards[0]!}
              cards={liveCards.filter((c) => c.node_board_id === boards[0]!.id)}
              onSelectCard={handleSelectCard}
            />
          )}
        </main>
        <aside className="w-[360px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]">
          <PendingSidebar confirmations={confirmations} events={boardState.events} />
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
        <OutputFeed entries={outputEntries} />
        <CommandInput onCommand={(parsed, raw) => void handleCommand(raw)} />
      </div>

      <CardDetailDrawer
        card={selectedCard}
        onClose={handleCloseDrawer}
        onTransition={(target) => void handleTransition(target)}
        transitions={[]}
        auditTrail={[]}
      />
    </div>
  );
}

// Local subcomponent to avoid a circular import between
// right-sidebar.tsx and goal-space-shell.tsx.
function PendingSidebar({
  confirmations,
  events,
}: {
  confirmations: readonly HumanConfirmationResponse[];
  events: readonly RealtimeEvent[];
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <section className="border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          Pending confirmations
        </span>
      </section>
      <ul className="divide-y divide-[var(--color-border)]">
        {confirmations.length === 0 && (
          <li className="px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
            {"// no pending confirmations"}
          </li>
        )}
        {confirmations.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-[var(--space-2xs)] px-[var(--space-md)] py-[var(--space-sm)]"
          >
            <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-secondary)]">
              {c.id.slice(0, 8)}
            </span>
            <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
              {c.card_title}
            </span>
            <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
              {c.trigger_type}
            </span>
          </li>
        ))}
      </ul>
      <section className="border-b border-[var(--color-border)]">
        <ExecutionStatusMini events={events} />
      </section>
      <AuditTimelineMini events={events} />
    </div>
  );
}

function ExecutionStatusMini({ events }: { events: readonly RealtimeEvent[] }): React.ReactElement {
  const started = new Map<string, string>();
  for (const ev of events) {
    if (ev.type === "ai_role_started") started.set(ev.resource.id, ev.occurred_at);
    else if (ev.type === "ai_role_completed" || ev.type === "ai_role_failed")
      started.delete(ev.resource.id);
  }
  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)]">
      <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
        In-flight
      </span>
      <span className="ml-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
        {String(started.size)}
      </span>
    </div>
  );
}

function AuditTimelineMini({ events }: { events: readonly RealtimeEvent[] }): React.ReactElement {
  const recent = events.slice(-20).reverse();
  return (
    <section className="px-[var(--space-md)] py-[var(--space-sm)]">
      <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
        Audit
      </span>
      <ul className="mt-[var(--space-2xs)] flex flex-col gap-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)]">
        {recent.map((ev) => (
          <li key={ev.id} className="text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-muted)]">{ev.occurred_at.slice(11, 19)}</span>{" "}
            <span>{ev.type}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Re-export so unused-import lints don't fire when shell is compiled
// without the strict no-unused-locals setting.
void setTheme;
