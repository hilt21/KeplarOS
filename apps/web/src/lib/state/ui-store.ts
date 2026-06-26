/**
 * UI store (F2-09).
 *
 * Module-scoped state shared across the three columns: sidebar collapsed
 * states, selected card id, palette open flag, theme id. Subscribed via
 * `useSyncExternalStore` from React 18+.
 *
 * SSR-safe: `getServerSnapshot` returns the default values.
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME_ID, type TmThemeId } from "@/lib/theme/tmTheme";

export interface UiState {
  leftOpen: boolean;
  rightOpen: boolean;
  selectedCardId: string | null;
  paletteOpen: boolean;
  themeId: TmThemeId;
}

const DEFAULT_STATE: UiState = {
  leftOpen: true,
  rightOpen: true,
  selectedCardId: null,
  paletteOpen: false,
  themeId: DEFAULT_THEME_ID,
};

let state: UiState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function getSnapshot(): UiState {
  return state;
}

function getServerSnapshot(): UiState {
  return DEFAULT_STATE;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return (): void => {
    listeners.delete(cb);
  };
}

function update(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  notify();
}

export const uiStore = {
  get: (): UiState => state,
  set: update,
  subscribe,
  getSnapshot,
  getServerSnapshot,
};

export function useUiStore<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(DEFAULT_STATE),
  );
}
