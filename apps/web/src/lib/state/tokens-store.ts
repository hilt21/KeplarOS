/**
 * Tokens store (Frontend Polish 2026-07-02, F10).
 *
 * Module-scoped state holding the current token usage (`used`) and the
 * server-provided cap (`cap`) for the persistent shell's token meter.
 *
 * Seeded by `<AppShell>` from its `tokensUsed` / `tokensCap` props on
 * mount so the server-rendered initial state flows into the client
 * store. Components read from it via `useTokensStore`.
 *
 * Implemented with `useSyncExternalStore` (same pattern as
 * `ui-store.ts` and `agents-store.ts`); exposes a Zustand-style
 * imperative API (`getState`, `setState`, `subscribe`) so tests and
 * consumers can read/write state directly.
 *
 * SSR-safe: `getServerSnapshot` returns the default values.
 */

import { useSyncExternalStore } from "react";

export interface TokensState {
  used: number;
  cap: number;
}

const DEFAULT_CAP = 100000;

const DEFAULT_STATE: TokensState = {
  used: 0,
  cap: DEFAULT_CAP,
};

let state: TokensState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function getSnapshot(): TokensState {
  return state;
}

function getServerSnapshot(): TokensState {
  return DEFAULT_STATE;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return (): void => {
    listeners.delete(cb);
  };
}

export const tokensStore = {
  get: (): TokensState => state,
  getState: (): TokensState => state,
  set: (patch: Partial<TokensState>): void => {
    state = { ...state, ...patch };
    notify();
  },
  setState: (patch: Partial<TokensState>): void => {
    state = { ...state, ...patch };
    notify();
  },
  subscribe,
  getSnapshot,
  getServerSnapshot,
};

export function useTokensStore<T>(selector: (s: TokensState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULT_STATE),
  );
}

/**
 * Reset the store to its default state. Used by tests to keep state
 * isolated between cases.
 */
export function resetTokensStore(): void {
  state = DEFAULT_STATE;
  notify();
}