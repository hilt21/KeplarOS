/**
 * Agents store (Frontend Polish 2026-06-29, Task 3).
 *
 * Single source of truth for the runtime status of the 6 AI roles.
 * SSE handlers update it; `AIPanel` reads from it. This decouples
 * SSE from UI.
 *
 * Implemented with `useSyncExternalStore` (same pattern as
 * `context-store.ts` and `board-store.ts`); exposes a Zustand-style
 * imperative API so tests and consumers can read/write state directly.
 */

import { useSyncExternalStore } from "react";

export type AgentRoleId =
  | "backlog_refiner"
  | "todo_orchestrator"
  | "dev_crafter"
  | "review_guard"
  | "done_reporter"
  | "blocked_resolver";

export type AgentStatus = "idle" | "queued" | "running" | "error";

export interface AgentState {
  status: AgentStatus;
  elapsedMs: number;
  currentTaskId: string | null;
}

type ByRole = Record<AgentRoleId, AgentState>;

interface AgentsStore {
  byRole: ByRole;
  setStatus: (role: AgentRoleId, status: AgentStatus, taskId?: string) => void;
}

const INITIAL_BY_ROLE: ByRole = {
  backlog_refiner: { status: "idle", elapsedMs: 0, currentTaskId: null },
  todo_orchestrator: { status: "idle", elapsedMs: 0, currentTaskId: null },
  dev_crafter: { status: "idle", elapsedMs: 0, currentTaskId: null },
  review_guard: { status: "idle", elapsedMs: 0, currentTaskId: null },
  done_reporter: { status: "idle", elapsedMs: 0, currentTaskId: null },
  blocked_resolver: { status: "idle", elapsedMs: 0, currentTaskId: null },
};

let state: AgentsStore = {
  byRole: INITIAL_BY_ROLE,
  setStatus: (role, status, taskId) => {
    const current = state.byRole[role];
    // Idempotent: same status with same taskId is a no-op so the
    // snapshot reference stays stable and `useSyncExternalStore`
    // doesn't trigger a re-render.
    if (
      current.status === status &&
      current.currentTaskId === (taskId ?? null)
    ) {
      return;
    }
    state = {
      ...state,
      byRole: {
        ...state.byRole,
        [role]: {
          status,
          elapsedMs: 0,
          currentTaskId: status === "idle" ? null : (taskId ?? current.currentTaskId),
        },
      },
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

function getSnapshot(): AgentsStore {
  return state;
}

function getServerSnapshot(): AgentsStore {
  return SERVER_STORE;
}

const SERVER_STORE: AgentsStore = Object.freeze({
  byRole: INITIAL_BY_ROLE,
  setStatus: (): void => {},
}) as AgentsStore;

export const useAgentsStore = Object.assign(
  function useAgentsStore<T>(selector: (s: AgentsStore) => T): T {
    return useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(SERVER_STORE),
    );
  },
  {
    getState: (): AgentsStore => state,
    setState: (patch: Partial<AgentsStore>): void => {
      state = { ...state, ...patch };
      notify();
    },
    subscribe,
    getSnapshot,
    getServerSnapshot,
  },
);

export const useAgentsStoreSelector = useAgentsStore;