import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { tokensStore, useTokensStore, resetTokensStore } from "../tokens-store";

describe("tokensStore", () => {
  beforeEach(() => {
    resetTokensStore();
  });

  it("initial state matches defaults", () => {
    expect(tokensStore.getState()).toEqual({ used: 0, cap: 100000 });
  });

  it("setState updates used and notifies subscribers", () => {
    let notified = 0;
    const unsub = tokensStore.subscribe(() => {
      notified += 1;
    });
    tokensStore.setState({ used: 2400 });
    expect(tokensStore.getState()).toEqual({ used: 2400, cap: 100000 });
    expect(notified).toBe(1);
    unsub();
  });

  it("setState supports partial updates of cap without resetting used", () => {
    tokensStore.setState({ used: 5000 });
    tokensStore.setState({ cap: 200000 });
    expect(tokensStore.getState()).toEqual({ used: 5000, cap: 200000 });
  });

  it("subscriber receives subsequent updates", () => {
    const seen: number[] = [];
    const unsub = tokensStore.subscribe(() => {
      seen.push(tokensStore.getState().used);
    });
    tokensStore.setState({ used: 100 });
    tokensStore.setState({ used: 250 });
    unsub();
    tokensStore.setState({ used: 999 });
    expect(seen).toEqual([100, 250]);
  });

  it("subscribe returns an unsubscribe function that detaches the listener", () => {
    let notified = 0;
    const unsub = tokensStore.subscribe(() => {
      notified += 1;
    });
    tokensStore.setState({ used: 1 });
    unsub();
    tokensStore.setState({ used: 2 });
    expect(notified).toBe(1);
  });

  it("getServerSnapshot returns default state for SSR", () => {
    tokensStore.setState({ used: 12345, cap: 999 });
    expect(tokensStore.getServerSnapshot()).toEqual({ used: 0, cap: 100000 });
  });

  it("useTokensStore selector returns the selected slice", () => {
    tokensStore.setState({ used: 2400, cap: 100000 });
    const { result } = renderHook(() => useTokensStore((s) => s));
    expect(result.current.used).toBe(2400);
    expect(result.current.cap).toBe(100000);
    expect(Math.round((result.current.used / result.current.cap) * 100)).toBe(2);
  });

  it("useTokensStore re-renders when state changes", () => {
    const { result } = renderHook(() => useTokensStore((s) => s.used));
    expect(result.current).toBe(0);
    act(() => {
      tokensStore.setState({ used: 7500 });
    });
    expect(result.current).toBe(7500);
  });

  it("resetTokensStore restores defaults and notifies subscribers", () => {
    tokensStore.setState({ used: 5000, cap: 50000 });
    let notified = 0;
    const unsub = tokensStore.subscribe(() => {
      notified += 1;
    });
    resetTokensStore();
    expect(tokensStore.getState()).toEqual({ used: 0, cap: 100000 });
    expect(notified).toBe(1);
    unsub();
  });
});