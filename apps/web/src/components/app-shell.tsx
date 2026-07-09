"use client";

/**
 * AppShell (F3). Persistent 3-pane shell owned by `(app)/layout.tsx`
 * via `<AppShellWrapper>`. Owns:
 *   - Top bar (breadcrumbs, token meter, command palette opener).
 *   - Left rail (MasterPane) — goal spaces + per-space task index.
 *   - Center `<main>` — server pages render their content here.
 *   - Right rail (DetailPane) — workspace metadata, AI panel, card runtime.
 *   - Keyboard shortcut provider (Cmd+B / Cmd+J / Cmd+/ / g g).
 *
 * The data contract was established by F2 (see `app-shell-wrapper.tsx`).
 * Per-page context (current goal space header, current card) is forwarded
 * by `(app)/layout.tsx` and rendered directly here.
 */

import { useCallback, useEffect, useMemo, type ReactElement, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TopBar, type TopBarSegment } from "./top-bar";
import { MasterPane } from "./master-pane";
import { DetailPane } from "./detail-pane";
import type { CardRuntimeInfo } from "./detail-pane/card-runtime";
import { CommandPalette } from "./command-palette";
import { useContextStore, parseContextFromPath, type AppContext } from "@/lib/state/context-store";
import { useAIAgentsSync } from "@/lib/realtime/ai-agents-sync";
import { tokensStore } from "@/lib/state/tokens-store";
import { uiStore, useUiStore } from "@/lib/state/ui-store";
import { ShortcutProvider } from "@/lib/keyboard/shortcut-provider";

// Re-export the F2 prop types so `AppShellWrapper` keeps importing them
// from here without a circular edge case. F3 reads them; F2 declared them.
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
  readonly displayId: string;
  readonly title: string;
  readonly state: AppShellTaskSummary["state"];
}

export interface AppShellProps {
  readonly user: AppShellUser;
  readonly goalSpaces: readonly AppShellGoalSpaceSummary[];
  readonly tasksByGoalSpace: Readonly<Record<string, readonly AppShellTaskSummary[]>>;
  readonly currentGoalSpaceHeader: AppShellCurrentHeader | null;
  readonly goalSpaceId: string | null;
  readonly card: AppShellCardRuntimeInfo | null;
  readonly tokensUsed: number;
  readonly tokensCap: number;
  readonly env: "dev" | "prod";
  readonly children: ReactNode;
}

const PRIMARY_PANE_WIDTH = 280;
const DETAIL_PANE_WIDTH = 320;

export function AppShell({
  user,
  goalSpaces,
  tasksByGoalSpace,
  currentGoalSpaceHeader,
  goalSpaceId,
  card,
  tokensUsed,
  tokensCap,
  env,
  children,
}: AppShellProps): ReactElement {
  const pathname = usePathname();
  const context: AppContext = useContextStore((s) => s.current);

  // Bridge SSE → agentsStore so AIPanel reflects real AI status.
  useAIAgentsSync(goalSpaceId);

  // Keep the global context store in sync with the URL on every navigation.
  // `useContextStore.setState` is a cheap immutable spread + notify.
  useEffect(() => {
    const next = parseContextFromPath(pathname);
    if (next.goalSpaceId !== context.goalSpaceId || next.taskId !== context.taskId) {
      useContextStore.setState({ current: next });
    }
  }, [pathname, context.goalSpaceId, context.taskId]);

  // Seed the tokens store with server-provided values. Done here (rather
  // than in TopBar/WorkspacePanel) so the store is populated exactly once
  // before any descendant reads it.
  useEffect(() => {
    tokensStore.setState({ used: tokensUsed, cap: tokensCap });
  }, [tokensUsed, tokensCap]);

  // Breadcrumb segments: KEPLAR → goal space → card.
  const segments: readonly TopBarSegment[] = useMemo<TopBarSegment[]>(() => {
    const list: TopBarSegment[] = [{ label: "KEPLAR", href: "/goal-spaces" }];
    if (currentGoalSpaceHeader) {
      const next: TopBarSegment =
        goalSpaceId !== null
          ? { label: currentGoalSpaceHeader.name, href: `/goal-spaces/${goalSpaceId}` }
          : { label: currentGoalSpaceHeader.name };
      list.push(next);
    }
    if (card) {
      list.push({ label: card.displayId });
    }
    return list;
  }, [currentGoalSpaceHeader, goalSpaceId, card]);

  // The F2 contract for `card` only carries display metadata. The full
  // `CardRuntimeInfo` (modified files, plan steps, audit events) is owned
  // by F11/F12; until it ships, keep the runtime panel hidden rather than
  // fabricating fields.
  const cardRuntime: CardRuntimeInfo | null = null;

  const openCommandPalette = (): void => {
    uiStore.set({ paletteOpen: true });
  };

  const closeCommandPalette = useCallback((): void => {
    uiStore.set({ paletteOpen: false });
  }, []);

  const handleActivateShortcut = useCallback(
    (shortcut: { id: string }): void => {
      // Built-in shortcuts already wire to their actions via shortcut-provider
      // (e.g., Cmd+B toggles leftOpen, Cmd+J toggles rightOpen). For everything
      // else, the shortcut registry owns the handler; we only need to close
      // the palette here. The id is kept for future per-id routing.
      void shortcut.id;
      closeCommandPalette();
    },
    [closeCommandPalette],
  );

  const paletteOpen = useUiStore((s) => s.paletteOpen);

  const openSettings = (): void => {
    // TODO(F9): wire to the settings overlay once it ships.
  };

  return (
    <ShortcutProvider>
      <div
        className="flex h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]"
        style={{ height: "100vh" }}
      >
        <TopBar
          segments={segments}
          tokensUsed={tokensUsed}
          tokensCap={tokensCap}
          onOpenCommandPalette={openCommandPalette}
        />
        <div className="flex flex-1 overflow-hidden">
          <div
            style={{
              width: PRIMARY_PANE_WIDTH,
              flexShrink: 0,
              minWidth: PRIMARY_PANE_WIDTH,
              maxWidth: PRIMARY_PANE_WIDTH,
              height: "100%",
            }}
            aria-label="Workspaces"
          >
            <MasterPane
              goalSpaces={goalSpaces}
              tasksByGoalSpace={tasksByGoalSpace}
              user={user}
              onOpenSettings={openSettings}
            />
          </div>
          <main className="flex-1 overflow-y-auto">{children}</main>
          <div
            style={{
              width: DETAIL_PANE_WIDTH,
              flexShrink: 0,
              minWidth: DETAIL_PANE_WIDTH,
              maxWidth: DETAIL_PANE_WIDTH,
              height: "100%",
            }}
            aria-label="Context"
          >
            <DetailPane
              workspace={{
                goalSpaceName: currentGoalSpaceHeader?.name ?? "—",
                boardName: currentGoalSpaceHeader?.boardName ?? "—",
                userName: user.name,
                userRole: user.role,
                runtime: "Next.js · React",
                apiBase: "/api/v1",
                tokensUsed,
                tokensCap,
              }}
              env={env}
              card={cardRuntime}
            />
          </div>
        </div>
        <CommandPalette
          open={paletteOpen}
          onClose={closeCommandPalette}
          onActivate={handleActivateShortcut}
        />
      </div>
    </ShortcutProvider>
  );
}
