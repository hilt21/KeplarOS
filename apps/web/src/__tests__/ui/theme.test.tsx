/**
 * Theme system (F2-09) — RED-first test.
 *
 * Verifies: getStoredTheme returns the persisted id; setTheme persists
 * and updates the document dataset; cycleTheme advances through the
 * theme order; an unknown stored id falls back to the default.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  applyTheme,
  cycleTheme,
  getStoredTheme,
  setTheme,
  getThemeOrder,
} from "@/lib/theme/tmTheme";

beforeEach(() => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.clear();
    } catch {
      // tolerate
    }
  }
});

afterEach(() => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.clear();
    } catch {
      // tolerate
    }
  }
});

describe("theme system", () => {
  it("returns the default when nothing is stored", () => {
    expect(getStoredTheme()).toBe(DEFAULT_THEME_ID);
  });

  it("returns the default when the stored id is not in the registry", () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, "not-a-real-theme");
    expect(getStoredTheme()).toBe(DEFAULT_THEME_ID);
  });

  it("setTheme persists the id and applies it to <html>", () => {
    if (typeof document === "undefined") return;
    setTheme("dark-solarized");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark-solarized");
    expect(document.documentElement.dataset.theme).toBe("dark-solarized");
  });

  it("getStoredTheme returns the persisted id after setTheme", () => {
    setTheme("light-paper");
    expect(getStoredTheme()).toBe("light-paper");
  });

  it("applyTheme updates the dataset without writing storage", () => {
    if (typeof document === "undefined") return;
    applyTheme("dark-monokai");
    expect(document.documentElement.dataset.theme).toBe("dark-monokai");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("cycleTheme advances through the theme order", () => {
    const order = getThemeOrder();
    const startIdx = order.indexOf(getStoredTheme());
    const next = cycleTheme();
    expect(next).toBe(order[(startIdx + 1) % order.length]);
    expect(getStoredTheme()).toBe(next);
  });
});
