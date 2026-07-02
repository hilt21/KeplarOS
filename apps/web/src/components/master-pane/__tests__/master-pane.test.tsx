import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { MasterPane } from "../../master-pane";
import type { GoalSpaceSummary, TaskSummary } from "../workspace-section";
import { useContextStore } from "@/lib/state/context-store";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  pushMock.mockReset();
  useContextStore.setState({ current: { goalSpaceId: "", taskId: null } });
});

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

const goalSpaceA: GoalSpaceSummary = { id: "gs-alpha", name: "Alpha" };
const goalSpaceB: GoalSpaceSummary = { id: "gs-beta", name: "Beta" };

const tasksA: readonly TaskSummary[] = [
  {
    id: "t-1",
    display_id: "A-001",
    title: "Alpha task one",
    state: "todo",
    updated_at: "2026-06-01T00:00:00Z",
  },
];

const tasksB: readonly TaskSummary[] = [
  {
    id: "t-2",
    display_id: "B-001",
    title: "Beta task one",
    state: "review",
    updated_at: "2026-06-01T00:00:00Z",
  },
];

const tasksByGoalSpace: Readonly<Record<string, readonly TaskSummary[]>> = {
  [goalSpaceA.id]: tasksA,
  [goalSpaceB.id]: tasksB,
};

const user = { name: "Test User", role: "Engineer", workspace: "Keplar" };

function renderPane() {
  return render(
    <MasterPane
      goalSpaces={[goalSpaceA, goalSpaceB]}
      tasksByGoalSpace={tasksByGoalSpace}
      user={user}
      onOpenSettings={() => {}}
    />,
  );
}

describe("MasterPane section collapse persistence", () => {
  it("renders sections expanded by default and writes true on mount", async () => {
    renderPane();
    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("true");
    });
    expect(screen.getByText("Alpha task one")).toBeInTheDocument();
    expect(screen.getByText("Beta task one")).toBeInTheDocument();
  });

  it("collapses a section on chevron click and persists expanded=false", async () => {
    renderPane();

    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("true");
    });

    const alphaChevron = document.querySelector(
      '[aria-controls="workspace-section-gs-alpha-tasks"]',
    ) as HTMLButtonElement;
    expect(alphaChevron).toBeTruthy();

    await act(async () => {
      fireEvent.click(alphaChevron);
    });

    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("false");
    });
    expect(screen.queryByText("Alpha task one")).not.toBeInTheDocument();
    expect(screen.getByText("Beta task one")).toBeInTheDocument();
  });

  it("reflects aria-expanded state correctly after collapse", async () => {
    renderPane();
    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("true");
    });

    const alphaChevron = document.querySelector(
      '[aria-controls="workspace-section-gs-alpha-tasks"]',
    ) as HTMLButtonElement;
    expect(alphaChevron).toHaveAttribute("aria-expanded", "true");

    await act(async () => {
      fireEvent.click(alphaChevron);
    });

    expect(alphaChevron).toHaveAttribute("aria-expanded", "false");
    expect(alphaChevron).toHaveAttribute("aria-label", "Expand");
  });

  it("seeds initial collapsed state from persisted localStorage on mount", async () => {
    window.localStorage.setItem("keplar.master.expanded.gs-alpha", "false");
    window.localStorage.setItem("keplar.master.expanded.gs-beta", "true");

    renderPane();

    // Alpha should be hidden, beta should remain visible.
    await waitFor(() => {
      expect(screen.queryByText("Alpha task one")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Beta task one")).toBeInTheDocument();
  });

  it("preserves per-goal-space state independently", async () => {
    renderPane();
    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("true");
      expect(window.localStorage.getItem("keplar.master.expanded.gs-beta")).toBe("true");
    });

    const alphaChevron = document.querySelector(
      '[aria-controls="workspace-section-gs-alpha-tasks"]',
    ) as HTMLButtonElement;
    const betaChevron = document.querySelector(
      '[aria-controls="workspace-section-gs-beta-tasks"]',
    ) as HTMLButtonElement;
    expect(alphaChevron).toBeTruthy();
    expect(betaChevron).toBeTruthy();

    // Collapse only the first (alpha) section.
    await act(async () => {
      fireEvent.click(alphaChevron);
    });

    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("false");
    });
    expect(window.localStorage.getItem("keplar.master.expanded.gs-beta")).toBe("true");

    expect(screen.queryByText("Alpha task one")).not.toBeInTheDocument();
    expect(screen.getByText("Beta task one")).toBeInTheDocument();
  });
});