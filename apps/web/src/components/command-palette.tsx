"use client";

/**
 * CommandPalette (F2-09).
 *
 * Modal opened by `Cmd+K`. Centered overlay with search input +
 * filtered list of registered shortcuts + slash commands.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { listShortcuts, subscribeShortcuts, type Shortcut } from "@/lib/keyboard/shortcuts";
import { helpText } from "@/lib/keyboard/command-parser";

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onActivate: (shortcut: Shortcut) => void;
}

type Item =
  | { kind: "shortcut"; shortcut: Shortcut }
  | { kind: "command"; label: string; insert: string };

export function CommandPalette({ open, onClose, onActivate }: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Force re-render when shortcut registry changes.
  const [, setTick] = useState(0);
  useEffect(() => subscribeShortcuts(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActiveIndex(0);
    // Defer focus to next tick so the input mounts first.
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return (): void => clearTimeout(id);
  }, [open]);

  const items = useMemo<readonly Item[]>(() => {
    const out: Item[] = listShortcuts().map((s) => ({ kind: "shortcut", shortcut: s }));
    for (const line of helpText()) {
      out.push({ kind: "command", label: line.split(/\s+/)[0] ?? line, insert: line });
    }
    return out;
  }, []);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = q === ""
    ? items
    : items.filter((it) => {
        const label = it.kind === "shortcut" ? it.shortcut.label.toLowerCase() : it.label.toLowerCase();
        return label.includes(q);
      });

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[activeIndex];
      if (!it) return;
      if (it.kind === "shortcut") {
        onActivate(it.shortcut);
        onClose();
      } else {
        setQuery(it.insert);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-30 flex items-start justify-center bg-[rgba(0,0,0,0.6)] pt-[15vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[90vw] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="search commands and shortcuts…"
          aria-label="Command palette search"
          className="w-full border-b border-[var(--color-border)] bg-transparent px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-body)] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
        />
        <ul role="listbox" className="max-h-[40vh] overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-[var(--space-md)] py-[var(--space-sm)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] italic text-[var(--color-text-muted)]">
              {"// no matches"}
            </li>
          )}
          {filtered.map((it, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li
                key={it.kind === "shortcut" ? `s:${it.shortcut.id}` : `c:${it.label}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  if (it.kind === "shortcut") {
                    onActivate(it.shortcut);
                    onClose();
                  } else {
                    setQuery(it.insert);
                  }
                }}
                className={[
                  "flex items-center justify-between gap-[var(--space-sm)] border-b border-[var(--color-border)] px-[var(--space-md)] py-[var(--space-xs)] cursor-pointer",
                  isActive ? "bg-[var(--color-surface)]" : "",
                ].join(" ")}
              >
                <span className="font-[var(--font-instrument-sans,system-ui,sans-serif)] text-[var(--font-small)] text-[var(--color-text-primary)]">
                  {it.kind === "shortcut" ? it.shortcut.label : it.label}
                </span>
                <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] text-[var(--color-text-muted)]">
                  {it.kind === "shortcut"
                    ? `${it.shortcut.chord.metaKey ? "⌘/" : ""}${it.shortcut.chord.key}`
                    : "→"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}