"use client";

/**
 * AppShell (F2-09).
 *
 * Client wrapper that owns the three-column layout, header bar, and
 * shortcut provider. Server components (page.tsx) render their children
 * inside `<main>`; the shell handles left/right sidebar visibility,
 * header chrome, theme switching, and keyboard shortcuts.
 */

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LeftSidebar } from "./left-sidebar";
import { ThemeSwitcher } from "./theme-switcher";
import { ShortcutProvider } from "@/lib/keyboard/shortcut-provider";
import { uiStore, useUiStore } from "@/lib/state/ui-store";

export interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps): React.ReactElement {
  const leftOpen = useUiStore((s) => s.leftOpen);
  const rightOpen = useUiStore((s) => s.rightOpen);

  return (
    <ShortcutProvider>
      <div className="flex h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-md)]">
          <div className="flex items-center gap-[var(--space-md)]">
            <Link
              href="/goal-spaces"
              className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-body)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)]"
            >
              KEPLAR
            </Link>
            <button
              type="button"
              onClick={() => uiStore.set({ leftOpen: !leftOpen })}
              className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Toggle left sidebar (Cmd+B)"
            >
              {leftOpen ? "← hide (⌘B)" : "→ show (⌘B)"}
            </button>
          </div>
          <div className="flex items-center gap-[var(--space-md)]">
            <ThemeSwitcher />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar goalSpaceId={null} goalSpaceName={null} eventCount={0} lastEventId={null} />
          <main className="flex-1 overflow-y-auto">{children}</main>
          {rightOpen && (
            <aside
              aria-label="Context"
              className="flex w-[360px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <header className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-sm)]">
                <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
                  Context
                </span>
                <button
                  type="button"
                  onClick={() => uiStore.set({ rightOpen: false })}
                  className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  aria-label="Hide right sidebar (Cmd+J)"
                >
                  hide (⌘J)
                </button>
              </header>
            </aside>
          )}
        </div>
      </div>
    </ShortcutProvider>
  );
}
