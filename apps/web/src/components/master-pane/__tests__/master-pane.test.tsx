import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { MasterPane, sortTasksByPriority } from "../../master-pane";
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

describe("sortTasksByPriority", () => {
  function makeTask(id: string, state: TaskSummary["state"], updatedAt: string): TaskSummary {
    return {
      id,
      display_id: `D-${id}`,
      title: `Task ${id}`,
      state,
      updated_at: updatedAt,
    };
  }

  it("sorts tasks by state priority then updated_at desc", () => {
    const input: readonly TaskSummary[] = [
      makeTask("a", "cancelled", "2026-06-10T00:00:00Z"),
      makeTask("b", "backlog", "2026-06-15T00:00:00Z"),
      makeTask("c", "todo", "2026-06-01T00:00:00Z"),
      makeTask("d", "review", "2026-06-20T00:00:00Z"),
      makeTask("e", "dev", "2026-06-25T00:00:00Z"),
      makeTask("f", "done", "2026-06-05T00:00:00Z"),
      makeTask("g", "blocked", "2026-06-08T00:00:00Z"),
    ];

    const sorted = sortTasksByPriority(input);
    expect(sorted.map((t) => t.id)).toEqual(["e", "d", "c", "b", "f", "g", "a"]);
  });

  it("sorts same-priority tasks by updated_at desc", () => {
    const input: readonly TaskSummary[] = [
      makeTask("a", "dev", "2026-06-01T00:00:00Z"),
      makeTask("b", "dev", "2026-06-10T00:00:00Z"),
      makeTask("c", "dev", "2026-06-05T00:00:00Z"),
    ];

    const sorted = sortTasksByPriority(input);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const input: readonly TaskSummary[] = [
      makeTask("a", "done", "2026-06-01T00:00:00Z"),
      makeTask("b", "dev", "2026-06-10T00:00:00Z"),
    ];
    const snapshot = input.map((t) => t.id);

    sortTasksByPriority(input);

    expect(input.map((t) => t.id)).toEqual(snapshot);
  });

  it("returns an empty array for empty input", () => {
    expect(sortTasksByPriority([])).toEqual([]);
  });

  it("returns the single item for a one-element input", () => {
    const only = makeTask("only", "dev", "2026-06-01T00:00:00Z");
    const sorted = sortTasksByPriority([only]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]?.id).toBe("only");
  });

  it("preserves order when all tasks share the same state and updated_at", () => {
    const input: readonly TaskSummary[] = [
      makeTask("a", "todo", "2026-06-01T00:00:00Z"),
      makeTask("b", "todo", "2026-06-01T00:00:00Z"),
      makeTask("c", "todo", "2026-06-01T00:00:00Z"),
    ];
    const sorted = sortTasksByPriority(input);
    expect(sorted.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts each goal-space section independently in rendered output", async () => {
    // Tasks deliberately in non-priority order to verify they get re-ordered.
    const unsortedAlpha: readonly TaskSummary[] = [
      makeTask("a-1", "done", "2026-06-01T00:00:00Z"),
      makeTask("a-2", "dev", "2026-06-10T00:00:00Z"),
    ];
    const unsortedBeta: readonly TaskSummary[] = [
      makeTask("b-1", "todo", "2026-06-05T00:00:00Z"),
      makeTask("b-2", "review", "2026-06-12T00:00:00Z"),
    ];

    const gsA: GoalSpaceSummary = { id: "gs-alpha", name: "Alpha" };
    const gsB: GoalSpaceSummary = { id: "gs-beta", name: "Beta" };

    const tasksByGoalSpace: Readonly<Record<string, readonly TaskSummary[]>> = {
      [gsA.id]: unsortedAlpha,
      [gsB.id]: unsortedBeta,
    };

    render(
      <MasterPane
        goalSpaces={[gsA, gsB]}
        tasksByGoalSpace={tasksByGoalSpace}
        user={{ name: "Test", role: "Eng", workspace: "Keplar" }}
        onOpenSettings={() => {}}
      />,
    );

    await waitFor(() => {
      expect(window.localStorage.getItem("keplar.master.expanded.gs-alpha")).toBe("true");
    });

    // Alpha section should render dev (a-2) before done (a-1).
    const alphaSection = document.getElementById("workspace-section-gs-alpha-tasks");
    const betaSection = document.getElementById("workspace-section-gs-beta-tasks");
    expect(alphaSection).toBeTruthy();
    expect(betaSection).toBeTruthy();

    const alphaTaskTitles = Array.from(alphaSection!.querySelectorAll('[role="button"]')).map(
      (el) => el.textContent,
    );
    const betaTaskTitles = Array.from(betaSection!.querySelectorAll('[role="button"]')).map(
      (el) => el.textContent,
    );

    // First rendered alpha task should be the dev one (a-2).
    expect(alphaTaskTitles[0]).toContain("Task a-2");
    expect(alphaTaskTitles[1]).toContain("Task a-1");

    // First rendered beta task should be the review one (b-2).
    expect(betaTaskTitles[0]).toContain("Task b-2");
    expect(betaTaskTitles[1]).toContain("Task b-1");
  });
});
