import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { WorkspaceSection } from "../workspace-section";

afterEach(() => {
  cleanup();
});

const baseGoalSpace = { id: "gs-1", name: "Railway Metro 2026 Q1" };
const baseTasks = [
  {
    id: "c-1",
    display_id: "CARD-001",
    title: "Track geometry",
    state: "review" as const,
    updated_at: "2026-06-20T00:00:00Z",
  },
  {
    id: "c-2",
    display_id: "CARD-002",
    title: "Risk register",
    state: "backlog" as const,
    updated_at: "2026-06-15T00:00:00Z",
  },
];

describe("WorkspaceSection", () => {
  it("renders goal space name and task count", () => {
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />,
    );
    expect(screen.getByText("Railway Metro 2026 Q1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders all tasks when expanded (controlled)", () => {
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />,
    );
    expect(screen.getByText("Track geometry")).toBeInTheDocument();
    expect(screen.getByText("Risk register")).toBeInTheDocument();
  });

  it("hides children when collapsed prop is true", () => {
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
        collapsed={true}
        onToggleCollapsed={() => {}}
      />,
    );
    expect(screen.queryByText("Track geometry")).not.toBeInTheDocument();
    expect(screen.queryByText("Risk register")).not.toBeInTheDocument();
    expect(screen.getByText("▸")).toBeInTheDocument();
  });

  it("calls onToggleCollapsed when chevron is clicked", () => {
    const onToggle = vi.fn();
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
        collapsed={false}
        onToggleCollapsed={onToggle}
      />,
    );
    fireEvent.click(screen.getByText("▾"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reflects aria-expanded on the chevron button based on collapsed prop", () => {
    const { rerender } = render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />,
    );
    const chevronExpanded = screen.getByRole("button", { name: /collapse/i });
    expect(chevronExpanded).toHaveAttribute("aria-expanded", "true");

    rerender(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
        collapsed={true}
        onToggleCollapsed={() => {}}
      />,
    );
    const chevronCollapsed = screen.getByRole("button", { name: /expand/i });
    expect(chevronCollapsed).toHaveAttribute("aria-expanded", "false");
  });

  it("calls onSelectTask when a task is clicked", () => {
    const onSelect = vi.fn();
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={onSelect}
        onSelectGoalSpace={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Track geometry"));
    expect(onSelect).toHaveBeenCalledWith("c-1");
  });

  it("calls onSelectGoalSpace when the section header is clicked (not the chevron)", () => {
    const onSelectGoalSpace = vi.fn();
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={onSelectGoalSpace}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Railway Metro 2026 Q1"));
    expect(onSelectGoalSpace).toHaveBeenCalledWith("gs-1");
  });
});
