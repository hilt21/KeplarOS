/**
 * ShortcutProvider (F2-09).
 *
 * Thin client component that wires the standard F2-09 keyboard chords
 * to `uiStore` actions. Rendered once by `<AppShell>`. The actual
 * dispatch lives in `useShortcuts` (single window keydown listener,
 * deduped chord registry).
 */

"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { uiStore } from "@/lib/state/ui-store";
import { useShortcuts, type Shortcut } from "@/lib/keyboard/useShortcut";

export interface ShortcutProviderProps {
  readonly children: ReactNode;
}

export function ShortcutProvider({ children }: ShortcutProviderProps): React.ReactElement {
  const router = useRouter();

  const shortcuts: readonly Shortcut[] = [
    {
      id: "toggle-left",
      chord: { key: "b", metaKey: true },
      label: "Toggle left sidebar",
      handler: () => uiStore.set({ leftOpen: !uiStore.get().leftOpen }),
    },
    {
      id: "toggle-right",
      chord: { key: "j", metaKey: true },
      label: "Toggle right sidebar",
      handler: () => uiStore.set({ rightOpen: !uiStore.get().rightOpen }),
    },
    {
      id: "cycle-theme",
      chord: { key: "/", metaKey: true },
      label: "Cycle theme",
      handler: () => {
        // Lazy-load the cycle helper to keep SSR happy.
        void import("@/lib/theme/tmTheme").then((m) => {
          m.cycleTheme();
          uiStore.set({ themeId: m.getStoredTheme() });
        });
      },
    },
    {
      id: "go-to-list",
      chord: { key: "g" },
      label: "Go to goal space list (g g)",
      handler: () => router.push("/goal-spaces"),
    },
  ];

  useShortcuts(shortcuts);

  return <>{children}</>;
}
