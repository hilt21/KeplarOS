"use client";

/**
 * CommandInput (F2-09).
 *
 * Sticky-bottom single-line input. Accepts slash commands (per
 * `lib/keyboard/command-parser`). Non-`/` input is rejected with a
 * mono error line.
 */

import { useState } from "react";
import { parseCommand } from "@/lib/keyboard/command-parser";
import type { ParsedCommand } from "@/lib/keyboard/command-parser";

export interface CommandInputProps {
  readonly onCommand: (cmd: ParsedCommand, raw: string) => void;
}

export function CommandInput({ onCommand }: CommandInputProps): React.ReactElement {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsed = parseCommand(trimmed);
    onCommand(parsed, trimmed);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-[var(--space-2xs)] border-t border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-[var(--space-md)] py-[var(--space-sm)]"
    >
      <span className="font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-small)] text-[var(--color-primary)]">
        /
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="type a command (start with /)"
        aria-label="Command input"
        autoComplete="off"
        spellCheck={false}
        className="flex-1 bg-transparent font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-small)] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
      />
      <button
        type="submit"
        className="border border-[var(--color-border)] px-[var(--space-sm)] py-[var(--space-2xs)] font-[var(--font-jetbrains-mono,monospace)] text-[var(--font-micro)] uppercase text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        style={{ transitionDuration: "var(--motion-hover)" }}
      >
        enter
      </button>
    </form>
  );
}
