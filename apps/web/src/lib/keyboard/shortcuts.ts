/**
 * Keyboard shortcut registry (F2-09).
 *
 * Each shortcut is a `Shortcut` object: `{ id, chord, label, scope, handler }`.
 * The registry is built once at module load from a static array. Chord
 * sequencing (`g g`) is implemented in `ShortcutProvider` via a small
 * state machine.
 */

export interface KeyCombo {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

export interface Shortcut {
  readonly id: string;
  readonly chord: KeyCombo;
  readonly label: string;
  readonly scope?: "global" | "list" | "detail" | "modal";
  readonly handler: (e: KeyboardEvent) => void;
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toLowerCase().includes("mac");
}

/**
 * Normalize a chord so chords can be compared regardless of platform.
 * On Mac, `Cmd` is `metaKey`; on Windows / Linux, `Ctrl` is `ctrlKey`.
 * The canonical form stores `metaKey: true` for Cmd-or-Ctrl chords.
 */
export function parseChord(e: KeyboardEvent): KeyCombo {
  const useMeta = e.metaKey || (!isMac() && e.ctrlKey);
  const result: KeyCombo = {
    key: e.key.toLowerCase(),
    ...(useMeta ? { metaKey: true } : {}),
    ...(e.shiftKey ? { shiftKey: true } : {}),
    ...(e.altKey ? { altKey: true } : {}),
  };
  return result;
}

export function chordsMatch(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key === b.key &&
    Boolean(a.metaKey) === Boolean(b.metaKey) &&
    Boolean(a.shiftKey) === Boolean(b.shiftKey) &&
    Boolean(a.altKey) === Boolean(b.altKey)
  );
}

// ─── Static registry ────────────────────────────────────────────────

let registry: Shortcut[] = [];
const listeners = new Set<() => void>();

export function registerShortcuts(items: readonly Shortcut[]): void {
  registry = [...registry, ...items];
  for (const l of listeners) l();
}

export function unregisterAllShortcuts(): void {
  registry = [];
  for (const l of listeners) l();
}

export function listShortcuts(): readonly Shortcut[] {
  return registry;
}

export function subscribeShortcuts(cb: () => void): () => void {
  listeners.add(cb);
  return (): void => {
    listeners.delete(cb);
  };
}

/**
 * Find the first registered shortcut matching the given chord within
 * the given scope. Returns `undefined` if no match.
 */
export function findShortcut(
  chord: KeyCombo,
  scope: "global" | "list" | "detail" | "modal",
): Shortcut | undefined {
  return registry.find((s) => s.scope === scope && chordsMatch(s.chord, chord));
}
