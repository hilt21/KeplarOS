/**
 * Keyboard shortcuts (F2-09) — RED-first test.
 *
 * Verifies the shortcut registry: synthetic keydown for chord X
 * matches the registered handler; non-matching keys do not. We test
 * the registry directly (not the ShortcutProvider's router wiring)
 * to avoid the Next app-router context requirement in unit tests.
 */

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  findShortcut,
  parseChord,
  registerShortcuts,
  unregisterAllShortcuts,
  type Shortcut,
} from "@/lib/keyboard/shortcuts";
import { useShortcuts } from "@/lib/keyboard/useShortcut";

function fireKey(opts: { key: string; metaKey?: boolean; ctrlKey?: boolean }): void {
  fireEvent.keyDown(window, {
    key: opts.key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
  });
}

function RegistryHarness({ items }: { items: readonly Shortcut[] }): null {
  useShortcuts(items);
  return null;
}

describe("shortcut registry", () => {
  it("parses a Cmd chord into metaKey: true", () => {
    const ev = new KeyboardEvent("keydown", { key: "b", metaKey: true });
    const chord = parseChord(ev);
    expect(chord.key).toBe("b");
    expect(chord.metaKey).toBe(true);
  });

  it("parses Ctrl chord on non-Mac as metaKey: true", () => {
    // navigator.platform on jsdom defaults to ''. Test the explicit
    // branch: with ctrlKey alone, parseChord sets metaKey: true
    // unless the platform is mac.
    const ev = new KeyboardEvent("keydown", { key: "b", ctrlKey: true });
    const chord = parseChord(ev);
    expect(chord.key).toBe("b");
    // On non-mac (which jsdom reports), ctrl becomes meta
    expect(chord.metaKey).toBe(true);
  });

  it("findShortcut returns the registered handler for the matching chord", () => {
    const handler = vi.fn();
    registerShortcuts([
      {
        id: "test-toggle",
        chord: { key: "b", metaKey: true },
        label: "test toggle",
        handler,
        scope: "global",
      },
    ]);
    const found = findShortcut({ key: "b", metaKey: true }, "global");
    expect(found).toBeDefined();
    expect(found?.id).toBe("test-toggle");
    unregisterAllShortcuts();
  });

  it("findShortcut returns undefined for a non-matching chord", () => {
    registerShortcuts([
      {
        id: "x",
        chord: { key: "b", metaKey: true },
        label: "x",
        handler: () => {},
        scope: "global",
      },
    ]);
    expect(findShortcut({ key: "z", metaKey: true }, "global")).toBeUndefined();
    unregisterAllShortcuts();
  });

  it("a keydown event fires the registered handler via useShortcuts wiring", () => {
    const handler = vi.fn();
    const items: readonly Shortcut[] = [
      {
        id: "kbd-test",
        chord: { key: "k", metaKey: true },
        label: "kbd test",
        handler,
        scope: "global",
      },
    ];
    render(<RegistryHarness items={items} />);
    act(() => {
      fireKey({ key: "k", metaKey: true });
    });
    // The handler is found via the registry; verify the registry
    // is populated after the effect runs.
    const found = findShortcut({ key: "k", metaKey: true }, "global");
    expect(found).toBeDefined();
    expect(found?.id).toBe("kbd-test");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
