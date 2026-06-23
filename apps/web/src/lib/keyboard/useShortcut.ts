/**
 * useShortcut hook (F2-09).
 *
 * Subscribes a single `keydown` listener on `window` and dispatches
 * matches against the registered shortcut registry. Returns a `rebind`
 * helper for swapping the registry after registration changes.
 *
 * `g g` sequencing: first `g` sets a pending flag with a 500ms
 * reset; second `g` within the window fires the `go-to-list` handler.
 */

import { useEffect, useRef } from "react";
import {
  findShortcut,
  parseChord,
  registerShortcuts,
} from "./shortcuts";
import type { Shortcut } from "./shortcuts";

export type { Shortcut };

const GG_SEQUENCE_TIMEOUT_MS = 500;

export function useShortcuts(items: readonly Shortcut[]): { rebind: () => void } {
  // Register once per items identity change.
  const itemsRef = useRef<readonly Shortcut[]>(items);
  useEffect(() => {
    registerShortcuts(items);
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let ggPending = false;
    let ggTimer: ReturnType<typeof setTimeout> | null = null;

    const onKeyDown = (e: KeyboardEvent): void => {
      const chord = parseChord(e);

      // Handle g g sequencing before chord matching.
      if (!chord.metaKey && !chord.ctrlKey && !chord.shiftKey && !chord.altKey) {
        if (chord.key === "g") {
          if (ggPending) {
            ggPending = false;
            if (ggTimer) clearTimeout(ggTimer);
            // The g g handler is a compound chord { key: "gg" } that we
            // recognize by shortcut id === "go-to-list".
            const handler = itemsRef.current.find((s) => s.id === "go-to-list")?.handler;
            if (handler) {
              e.preventDefault();
              handler(e);
              return;
            }
          } else {
            ggPending = true;
            ggTimer = setTimeout(() => {
              ggPending = false;
            }, GG_SEQUENCE_TIMEOUT_MS);
            return;
          }
        } else {
          ggPending = false;
          if (ggTimer) clearTimeout(ggTimer);
        }
      }

      // Plain chord match.
      const scope: "global" | "list" | "detail" | "modal" = detectScope();
      const match = findShortcut(chord, scope);
      if (match) {
        e.preventDefault();
        match.handler(e);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return (): void => {
      window.removeEventListener("keydown", onKeyDown);
      if (ggTimer) clearTimeout(ggTimer);
    };
  }, []);

  return {
    rebind: (): void => {
      registerShortcuts(itemsRef.current);
    },
  };
}

function detectScope(): "global" | "list" | "detail" | "modal" {
  if (typeof window === "undefined") return "global";
  const path = window.location.pathname;
  if (path.startsWith("/goal-spaces/") && path.length > "/goal-spaces/".length) return "detail";
  if (path === "/goal-spaces") return "list";
  return "global";
}