/**
 * Context store (Frontend Polish 2026-06-29, Task 2).
 *
 * Single source of truth for which goal space and task the user is
 * currently viewing. Components read from it instead of parsing
 * `usePathname` themselves.
 *
 * Implemented with `useSyncExternalStore` (same pattern as
 * `board-store.ts` and `ui-store.ts`); exposes a Zustand-style
 * imperative API so tests and consumers can read/write state directly.
 */

import { useSyncExternalStore } from "react";

export interface AppContext {
  readonly goalSpaceId: string;
  readonly taskId: string | null;
}

interface ContextStore {
  current: AppContext;
  setContext: (patch: Partial<AppContext>) => void;
}

const INITIAL: AppContext = { goalSpaceId: "", taskId: null };

let state: ContextStore = {
  current: INITIAL,
  setContext: (patch) => {
    state = {
      ...state,
      current: { ...state.current, ...patch },
    };
    notify();
  },
};

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return (): void => {
    listeners.delete(cb);
  };
}

function getSnapshot(): ContextStore {
  return state;
}

function getServerSnapshot(): ContextStore {
  return SERVER_STORE;
}

const SERVER_STORE: ContextStore = Object.freeze({
  current: INITIAL,
  setContext: (): void => {},
}) as ContextStore;

export const useContextStore = {
  getState: (): ContextStore => state,
  setState: (patch: Partial<ContextStore>): void => {
    state = { ...state, ...patch };
    notify();
  },
  subscribe,
  getSnapshot,
  getServerSnapshot,
};

export function useContextStoreSelector<T>(selector: (s: ContextStore) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(SERVER_STORE),
  );
}

/**
 * Parse the current route into an `AppContext`. Used by `AppShell`
 * to read the goal space / task from `usePathname()`.
 */
export function parseContextFromPath(pathname: string): AppContext {
  // /goal-spaces/[id]
  const goalSpaceMatch = pathname.match(/^\/goal-spaces\/([^/]+)(?:\/(.*))?$/);
  if (!goalSpaceMatch) return INITIAL;
  const goalSpaceId = goalSpaceMatch[1] ?? "";
  const rest = goalSpaceMatch[2] ?? "";
  // /goal-spaces/[id]/tasks/[taskId]
  const taskMatch = rest.match(/^tasks\/([^/]+)$/);
  return {
    goalSpaceId,
    taskId: taskMatch ? (taskMatch[1] ?? null) : null,
  };
}