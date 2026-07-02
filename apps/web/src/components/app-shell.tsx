"use client";

/**
 * AppShell (F2-09). Persistent 3-pane shell owned by `(app)/layout.tsx`
 * (see Task 12 of the Frontend Polish plan). Left/right rail
 * visibility, header chrome, theme switching, and keyboard shortcuts
 * live here; server pages render their content inside `<main>`.
 */

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeSwitcher } from "./theme-switcher";
import { ShortcutProvider } from "@/lib/keyboard/shortcut-provider";
import { uiStore, useUiStore } from "@/lib/state/ui-store";

// F2 lays down the data contract. F3 will actually consume these props
// to render the left/right rails; today the AppShell ignores them and
// the type stays purely additive so existing callers (tests, etc.)
// don't break.

// Minimal shapes used by the data contract. They intentionally mirror
// what the per-page components (MasterPane / DetailPane / TopBar) expect
// so the type contract is forward-compatible with F3.
export interface AppShellUser {
  readonly name: string;
  readonly role: string;
  readonly workspace: string;
}

export interface AppShellGoalSpaceSummary {
  readonly id: string;
  readonly name: string;
}

export interface AppShellTaskSummary {
  readonly id: string;
  readonly display_id: string;
  readonly title: string;
  readonly state: "backlog" | "todo" | "dev" | "review" | "done" | "blocked" | "cancelled";
  readonly updated_at: string;
}

export interface AppShellCurrentHeader {
  readonly name: string;
  readonly boardName: string;
}

export interface AppShellCardRuntimeInfo {
  readonly cardId: string;
  readonly title: string;
  readonly state: AppShellTaskSummary["state"];
}

export interface AppShellProps {
  readonly children: ReactNode;
  // F2 forwards these from the (app) layout's server-side fetches; F3
  // will read them inside the shell. All optional so the existing
  // single-prop call sites (tests) keep compiling.
  readonly user?: AppShellUser;
  readonly goalSpaces?: readonly AppShellGoalSpaceSummary[];
  readonly tasksByGoalSpace?: Readonly<Record<string, readonly AppShellTaskSummary[]>>;
  readonly currentGoalSpaceHeader?: AppShellCurrentHeader | null;
  readonly goalSpaceId?: string | null;
  readonly card?: AppShellCardRuntimeInfo | null;
  readonly tokensUsed?: number;
  readonly tokensCap?: number;
  readonly env?: "dev" | "prod";
}

export function AppShell({ children }: AppShellProps): React.ReactElement {
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
          </div>
          <div className="flex items-center gap-[var(--space-md)]">
            <ThemeSwitcher />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
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
