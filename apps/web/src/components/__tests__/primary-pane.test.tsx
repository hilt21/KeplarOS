/**
 * PrimaryPane (F4) — route-switching component test.
 *
 * PrimaryPane decides between:
 *   - GoalSpaceKanbanView  (when context.taskId is null)
 *   - TaskTimelineView    (when context.taskId AND taskData are set)
 *
 * The route decision is driven by `useContextStore` so it reacts to
 * URL changes pushed by AppShell. We exercise both branches and
 * verify the store-driven transition.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { PrimaryPane } from "../primary-pane";
import { useContextStore } from "@/lib/state/context-store";

// Stub the heavy children — GoalSpaceShell wires SSE / replay / drawer
// (lots of fetch + EventSource plumbing) and TaskTimelineView already
// has its own dedicated test file. Stubbing keeps the route-switch
// surface area small and the test deterministic.
vi.mock("../primary-pane/goal-space-kanban-view", () => ({
  GoalSpaceKanbanView: ({ snapshot }: { snapshot: { id: string } }): ReactElement => (
    <div data-testid="goal-space-kanban-view">goal-space-kanban:{snapshot.id}</div>
  ),
}));

vi.mock("../timeline/task-timeline-view", () => ({
  TaskTimelineView: ({ cardId }: { cardId: string }): ReactElement => (
    <div data-testid="task-timeline-view">task-timeline:{cardId}</div>
  ),
}));

const snapshot = {
  id: "gs-alpha",
  name: "Alpha",
  description: "Test goal space",
  constraints: [],
  acceptance_criteria: [],
  status: "active" as const,
  progress: 0,
  initiator_id: "user-1",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-20T00:00:00Z",
  cards: [],
};

const boards = [
  {
    id: "board-1",
    goal_space_id: "gs-alpha",
    key: "ALPHA",
    name: "Alpha Board",
    description: "",
    members: [],
    status: "active" as const,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-20T00:00:00Z",
  },
];

const confirmations = [
  {
    id: "conf-1",
    card_id: "card-1",
    card_title: "Card 1",
    status: "pending" as const,
    trigger_type: "deploy",
    trigger_reason: null,
    triggered_by: null,
    triggered_at: "2026-06-20T00:00:00Z",
    ai_summary: null,
    risk_factors: [],
    recommendations: [],
    ai_confidence: null,
    target_state: null,
    expires_at: "2026-06-21T00:00:00Z",
    created_at: "2026-06-20T00:00:00Z",
  },
];

beforeEach(() => {
  useContextStore.setState({ current: { goalSpaceId: "gs-alpha", taskId: null } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PrimaryPane", () => {
  it("renders GoalSpaceKanbanView when no taskId is set", () => {
    render(
      <PrimaryPane
        goalSpaceId="gs-alpha"
        snapshot={snapshot}
        boards={boards}
        confirmations={confirmations}
        onSendTaskMessage={() => undefined}
      />,
    );

    expect(screen.getByTestId("goal-space-kanban-view")).toBeInTheDocument();
    expect(screen.queryByTestId("task-timeline-view")).toBeNull();
    expect(screen.getByText("goal-space-kanban:gs-alpha")).toBeInTheDocument();
  });

  it("renders TaskTimelineView when taskId is set and taskData is provided", () => {
    useContextStore.setState({ current: { goalSpaceId: "gs-alpha", taskId: "card-1" } });

    render(
      <PrimaryPane
        goalSpaceId="gs-alpha"
        snapshot={snapshot}
        boards={boards}
        confirmations={confirmations}
        taskId="card-1"
        taskData={{
          displayId: "A-001",
          title: "Wire SSE",
          state: "dev",
          assignee: "Dev Crafter",
          entries: [],
        }}
        onSendTaskMessage={() => undefined}
      />,
    );

    expect(screen.getByTestId("task-timeline-view")).toBeInTheDocument();
    expect(screen.queryByTestId("goal-space-kanban-view")).toBeNull();
    expect(screen.getByText("task-timeline:card-1")).toBeInTheDocument();
  });

  it("reacts to useContextStore changes — switches back to kanban when taskId clears", () => {
    useContextStore.setState({ current: { goalSpaceId: "gs-alpha", taskId: "card-1" } });

    const { rerender } = render(
      <PrimaryPane
        goalSpaceId="gs-alpha"
        snapshot={snapshot}
        boards={boards}
        confirmations={confirmations}
        taskId="card-1"
        taskData={{
          displayId: "A-001",
          title: "Wire SSE",
          state: "dev",
          assignee: "Dev Crafter",
          entries: [],
        }}
        onSendTaskMessage={() => undefined}
      />,
    );
    expect(screen.getByTestId("task-timeline-view")).toBeInTheDocument();

    // Simulate navigation back to the goal-space root: clear taskId in
    // the shared store and remove taskData from props.
    useContextStore.setState({ current: { goalSpaceId: "gs-alpha", taskId: null } });

    rerender(
      <PrimaryPane
        goalSpaceId="gs-alpha"
        snapshot={snapshot}
        boards={boards}
        confirmations={confirmations}
        onSendTaskMessage={() => undefined}
      />,
    );

    expect(screen.getByTestId("goal-space-kanban-view")).toBeInTheDocument();
    expect(screen.queryByTestId("task-timeline-view")).toBeNull();
  });
});
