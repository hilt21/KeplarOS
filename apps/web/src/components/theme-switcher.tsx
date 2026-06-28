"use client";

/**
 * ThemeSwitcher (F2-09).
 *
 * Custom dropdown (NOT a native <select>) listing the four themes with
 * a 16×16 preview swatch. Click outside closes. Persists to
 * `localStorage` via `setTheme`.
 */

import { useEffect, useRef, useState } from "react";
import { themes, themeOrder } from "@/lib/theme/themes";
import {
  applyTheme,
  DEFAULT_THEME_ID,
  getStoredTheme,
  setTheme,
  type TmThemeId,
} from "@/lib/theme/tmTheme";

export function ThemeSwitcher(): React.ReactElement {
  const [open, setOpen] = useState(false);
  // Initialize with the server-safe default to avoid an SSR / client
  // hydration mismatch (localStorage is not available on the server).
  // We sync from localStorage in a useEffect after mount; the brief
  // flash of the default theme before the stored one applies is
  // acceptable for this case.
  const [current, setCurrent] = useState<TmThemeId>(DEFAULT_THEME_ID);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrent(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return (): void => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = (id: TmThemeId): void => {
    setTheme(id);
    applyTheme(id);
    setCurrent(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-[var(--space-2xs)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-[var(--space-sm)] py-[var(--space-2xs)] font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]"
        style={{ transitionDuration: "var(--motion-hover)" }}
      >
        <span
          aria-hidden
          className="inline-block h-[16px] w-[16px] border border-[var(--color-border)]"
          style={{ backgroundColor: themes[current].swatch }}
        />
        <span>{themes[current].label}</span>
        <span aria-hidden className="text-[var(--color-text-muted)]">
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-10 mt-[var(--space-2xs)] min-w-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
          style={{ transitionDuration: "var(--motion-enter)" }}
        >
          {themeOrder.map((id) => (
            <li key={id} role="option" aria-selected={id === current}>
              <button
                type="button"
                onClick={() => handleSelect(id)}
                className="flex w-full items-center gap-[var(--space-sm)] px-[var(--space-sm)] py-[var(--space-2xs)] text-left font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
              >
                <span
                  aria-hidden
                  className="inline-block h-[16px] w-[16px] border border-[var(--color-border)]"
                  style={{ backgroundColor: themes[id].swatch }}
                />
                <span className="flex-1">{themes[id].label}</span>
                {id === current && (
                  <span
                    aria-hidden
                    className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--color-text-secondary)]"
                  >
                    ✓
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
