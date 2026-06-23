/**
 * Theme system (F2-09).
 *
 * Four pre-defined themes. Each overrides a subset of `--color-*` CSS
 * variables via `[data-theme="..."]` selector blocks in
 * `apps/web/src/app/globals.css`. The current theme id is stored on
 * `<html data-theme="...">` and persisted to `localStorage`.
 *
 * SSR-safe: `getStoredTheme()` returns the default on the server. The
 * inline FOUC-prevention `<script>` in `app/layout.tsx` reads
 * `localStorage` and sets `document.documentElement.dataset.theme`
 * before first paint.
 */

import { themes, themeOrder } from "./themes";

export type TmThemeId = keyof typeof themes;

export const DEFAULT_THEME_ID: TmThemeId = "dark-codex";
export const THEME_STORAGE_KEY = "keplar.theme";

export function getThemeOrder(): readonly TmThemeId[] {
  return themeOrder as readonly TmThemeId[];
}

export function getStoredTheme(): TmThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && raw in themes) return raw as TmThemeId;
  } catch {
    // localStorage may throw in private mode; fall through.
  }
  return DEFAULT_THEME_ID;
}

export function applyTheme(id: TmThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = id;
}

export function setTheme(id: TmThemeId): void {
  applyTheme(id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // Tolerate localStorage failure.
    }
  }
}

export function cycleTheme(): TmThemeId {
  const order = getThemeOrder();
  const current = getStoredTheme();
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length] ?? DEFAULT_THEME_ID;
  setTheme(next);
  return next;
}