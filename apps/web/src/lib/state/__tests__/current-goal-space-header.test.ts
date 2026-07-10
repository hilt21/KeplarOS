/**
 * useCurrentGoalSpaceHeader — derives current GS name + board from URL.
 *
 * Replaces the hardcoded `currentGoalSpaceHeader={null}` in the
 * (app) layout. Reads `usePathname()`, finds the goal space id, and
 * looks up name + board from the `goalSpaces` prop.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mockUsePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { useCurrentGoalSpaceHeader } from "../current-goal-space-header";
import type { AppShellGoalSpaceSummary } from "@/components/app-shell";

const goalSpaces: readonly AppShellGoalSpaceSummary[] = [
  { id: "gs-alpha", name: "Alpha" },
  { id: "gs-beta", name: "Beta" },
];

const nodeBoardsByGs = {
  "gs-alpha": [{ name: "Frontend Board" }],
  "gs-beta": [{ name: "Backend Board" }],
};

beforeEach(() => {
  mockUsePathname.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCurrentGoalSpaceHeader", () => {
  it("returns null when pathname is not under /goal-spaces/", () => {
    mockUsePathname.mockReturnValue("/login");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: null,
      }),
    );
    expect(result.current).toBeNull();
  });

  it("returns null when goal space id is not in the goalSpaces prop", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-ghost");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: "gs-ghost",
      }),
    );
    expect(result.current).toBeNull();
  });

  it("returns { name, boardName } for a known goal space", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-alpha");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: "gs-alpha",
      }),
    );
    expect(result.current).toEqual({ name: "Alpha", boardName: "Frontend Board" });
  });

  it("falls back to empty boardName when no boards exist for the GS", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-beta");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs: { "gs-beta": [] },
        goalSpaceId: "gs-beta",
      }),
    );
    expect(result.current).toEqual({ name: "Beta", boardName: "" });
  });

  it("prefers the explicit goalSpaceId prop over the URL pathname", () => {
    mockUsePathname.mockReturnValue("/goal-spaces/gs-alpha");
    const { result } = renderHook(() =>
      useCurrentGoalSpaceHeader({
        goalSpaces,
        nodeBoardsByGs,
        goalSpaceId: "gs-beta",
      }),
    );
    expect(result.current).toEqual({ name: "Beta", boardName: "Backend Board" });
  });
});
