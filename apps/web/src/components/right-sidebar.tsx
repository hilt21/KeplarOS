"use client";

/**
 * RightSidebar (F2-09).
 *
 * Holds `ConfirmationQueue` + `ExecutionStatus` + `AuditTimeline` +
 * `ThemeSwitcher`. Collapsible (Cmd+J).
 */

import { ConfirmationQueue } from "./confirmation-queue";
import { ExecutionStatus } from "./execution-status";
import { AuditTimeline } from "./audit-timeline";
import { ThemeSwitcher } from "./theme-switcher";
import { uiStore, useUiStore } from "@/lib/state/ui-store";
import type { HumanConfirmationResponse, RealtimeEvent } from "@/lib/api/types";

export interface RightSidebarProps {
  readonly confirmations: readonly HumanConfirmationResponse[];
  readonly events: readonly RealtimeEvent[];
  readonly onDecide: (id: string, outcome: "approved" | "rejected") => Promise<void>;
}

export function RightSidebar({
  confirmations,
  events,
  onDecide,
}: RightSidebarProps): React.ReactElement | null {
  const open = useUiStore((s) => s.rightOpen);
  if (!open) return null;

  return (
    <aside
      aria-label="Context"
      className="flex w-[360px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
          Context
        </span>
        <div className="flex items-center gap-[var(--space-sm)]">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => uiStore.set({ rightOpen: false })}
            className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Hide right sidebar (Cmd+J)"
          >
            hide (⌘J)
          </button>
        </div>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <ConfirmationQueue confirmations={confirmations} onDecide={onDecide} />
        <ExecutionStatus events={events} />
        <AuditTimeline events={events} />
      </div>
    </aside>
  );
}