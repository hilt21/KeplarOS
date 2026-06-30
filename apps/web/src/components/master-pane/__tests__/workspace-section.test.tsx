import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { WorkspaceSection } from "../workspace-section";

afterEach(() => {
  cleanup();
});

const baseGoalSpace = { id: "gs-1", name: "Railway Metro 2026 Q1" };
const baseTasks = [
  { id: "c-1", display_id: "CARD-001", title: "Track geometry", state: "review" as const, updated_at: "2026-06-20T00:00:00Z" },
  { id: "c-2", display_id: "CARD-002", title: "Risk register", state: "backlog" as const, updated_at: "2026-06-15T00:00:00Z" },
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
      />,
    );
    expect(screen.getByText("Railway Metro 2026 Q1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders all tasks by default (expanded)", () => {
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
      />,
    );
    expect(screen.getByText("Track geometry")).toBeInTheDocument();
    expect(screen.getByText("Risk register")).toBeInTheDocument();
  });

  it("collapses children on chevron click", () => {
    render(
      <WorkspaceSection
        goalSpace={baseGoalSpace}
        tasks={baseTasks}
        selectedTaskId={null}
        onSelectTask={() => {}}
        onSelectGoalSpace={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("▾"));
    expect(screen.queryByText("Track geometry")).not.toBeInTheDocument();
    expect(screen.getByText("▸")).toBeInTheDocument();
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
      />,
    );
    fireEvent.click(screen.getByText("Railway Metro 2026 Q1"));
    expect(onSelectGoalSpace).toHaveBeenCalledWith("gs-1");
  });
});
