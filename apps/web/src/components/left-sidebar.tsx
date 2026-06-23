"use client";

/**
 * LeftSidebar (F2-09).
 *
 * Workspace overview + status bar (event count, last event id).
 * Collapsible from the shell header (Cmd+B).
 */

import Link from "next/link";
import { uiStore } from "@/lib/state/ui-store";
import { useUiStore } from "@/lib/state/ui-store";

export interface LeftSidebarProps {
  readonly goalSpaceId: string | null;
  readonly goalSpaceName: string | null;
  readonly eventCount: number;
  readonly lastEventId: string | null;
}

export function LeftSidebar({
  goalSpaceId,
  goalSpaceName,
  eventCount,
  lastEventId,
}: LeftSidebarProps): React.ReactElement | null {
  const open = useUiStore((s) => s.leftOpen);
  if (!open) return null;

  return (
    <aside
      aria-label="Workspace navigation"
      className="flex w-[280px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <header className="border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
        <h2 className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-h3)] text-[var(--color-text-primary)]">
          {goalSpaceName ?? "KEPLAR"}
        </h2>
      </header>
      <nav className="flex flex-col gap-[var(--space-2xs)] px-[var(--space-md)] py-[var(--space-sm)]">
        <Link
          href="/goal-spaces"
          className="border-b border-[var(--color-border)] py-[var(--space-2xs)] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)]"
          style={{ transitionDuration: "var(--motion-hover)" }}
        >
          goal spaces
        </Link>
        {goalSpaceId !== null && (
          <Link
            href={`/goal-spaces/${goalSpaceId}`}
            className="border-b border-[var(--color-border)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
            style={{ transitionDuration: "var(--motion-hover)" }}
          >
            {goalSpaceId.slice(0, 8)}
          </Link>
        )}
      </nav>

      <div
        role="status"
        aria-label="Event stream status"
        className="mt-auto flex flex-col gap-[var(--space-2xs)] border-t border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]"
      >
        <span>events {String(eventCount)}</span>
        {lastEventId !== null && <span>last {lastEventId.slice(0, 8)}</span>}
      </div>

      <button
        type="button"
        onClick={() => uiStore.set({ leftOpen: false })}
        className="border-t border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-xs)] text-left font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        ← hide (⌘B)
      </button>
    </aside>
  );
}