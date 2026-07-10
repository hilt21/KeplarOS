/**
 * AppShell (F3) — top-level component test.
 *
 * Verifies the persistent shell renders its three rails:
 *   - TopBar (KEPLAR + token meter + CMD K)
 *   - MasterPane (workspaces rail)
 *   - DetailPane (workspace + AI panel zones)
 * and that the children passed by the page slot into <main>.
 *
 * AppShell depends on `next/navigation`, the shortcut provider,
 * stores seeded by the layout, and the command palette. We mock
 * next/navigation only (router/push) — the rest are harmless in
 * jsdom and the stores are idempotent under repeated setState.
 *
 * MasterPane does an in-render `useContextStore.setState` (it syncs
 * the URL → context on every render). When the AppShell test mounts
 * MasterPane via its real component, the AppShell effect that also
 * touches the context store creates a render loop. To keep the test
 * deterministic without modifying MasterPane, we stub MasterPane
 * here with a minimal placeholder and rely on MasterPane's own
 * dedicated test file for behavior coverage.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { AppShell, type AppShellCardRuntimeInfo } from "../app-shell";
import { useContextStore } from "@/lib/state/context-store";
import { tokensStore } from "@/lib/state/tokens-store";
import { boardStore } from "@/lib/state/board-store";
import { useAgentsStore } from "@/lib/state/agents-store";
import type { RealtimeEvent } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/goal-spaces/gs-alpha",
}));

vi.mock("../master-pane", () => ({
  MasterPane: ({
    user,
  }: {
    user: { name: string; role: string; workspace: string };
  }): ReactElement => (
    <div data-testid="master-pane-stub">
      <span data-testid="master-pane-user">{user.name}</span>
      <span>WORKSPACES</span>
      <input placeholder="filter tasks…" />
    </div>
  ),
}));

const user = { name: "Test User", role: "Engineer", workspace: "Keplar" };

const goalSpaces = [
  { id: "gs-alpha", name: "Alpha" },
  { id: "gs-beta", name: "Beta" },
] as const;

const tasksByGoalSpace = {
  "gs-alpha": [
    {
      id: "c-1",
      display_id: "A-001",
      title: "Alpha task one",
      state: "todo" as const,
      updated_at: "2026-06-20T00:00:00Z",
    },
  ],
} as const;

const card: AppShellCardRuntimeInfo = {
  cardId: "c-1",
  displayId: "A-001",
  title: "Alpha task one",
  state: "todo",
};

beforeEach(() => {
  useContextStore.setState({ current: { goalSpaceId: "", taskId: null } });
  tokensStore.setState({ used: 0, cap: 100000 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("renders TopBar, MasterPane, DetailPane and the children slot", () => {
    render(
      <AppShell
        user={user}
        goalSpaces={goalSpaces}
        tasksByGoalSpace={tasksByGoalSpace}
        currentGoalSpaceHeader={null}
        goalSpaceId={null}
        card={null}
        tokensUsed={2400}
        tokensCap={100000}
        env="dev"
      >
        <div data-testid="page-child">test-child</div>
      </AppShell>,
    );

    // TopBar: KEPLAR brand appears in the top bar (the brand label may
    // also appear in command palette items — check at least one).
    expect(screen.getAllByText("KEPLAR").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /open command palette/i })).toBeInTheDocument();

    // MasterPane stub: renders the user name and the WORKSPLACES label
    expect(screen.getByTestId("master-pane-stub")).toBeInTheDocument();
    expect(screen.getByTestId("master-pane-user")).toHaveTextContent("Test User");
    expect(screen.getByText("WORKSPACES")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("filter tasks…")).toBeInTheDocument();

    // DetailPane: WORKSPACE label + AI ROLES section header
    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
    expect(screen.getByText("AI ROLES")).toBeInTheDocument();

    // Children slotted into the page area
    expect(screen.getByTestId("page-child")).toBeInTheDocument();
    expect(screen.getByText("test-child")).toBeInTheDocument();
  });

  it("renders a card breadcrumb segment when a card is provided", () => {
    render(
      <AppShell
        user={user}
        goalSpaces={goalSpaces}
        tasksByGoalSpace={tasksByGoalSpace}
        currentGoalSpaceHeader={null}
        goalSpaceId="gs-alpha"
        card={card}
        tokensUsed={2400}
        tokensCap={100000}
        env="prod"
      >
        <div>child</div>
      </AppShell>,
    );

    // Card display id only appears in the breadcrumb; use a unique
    // text query (the breadcrumb also renders the goal-space name
    // "Alpha", which is duplicated in the workspace panel header).
    expect(screen.getByText("A-001")).toBeInTheDocument();
    expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(2);
    // env badge appears in the workspace panel
    expect(screen.getByText("prod")).toBeInTheDocument();
  });

  it("seeds the tokens store from the server-provided props", async () => {
    render(
      <AppShell
        user={user}
        goalSpaces={goalSpaces}
        tasksByGoalSpace={tasksByGoalSpace}
        currentGoalSpaceHeader={null}
        goalSpaceId={null}
        card={null}
        tokensUsed={7777}
        tokensCap={12345}
        env="dev"
      >
        <div>child</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(tokensStore.get().used).toBe(7777);
      expect(tokensStore.get().cap).toBe(12345);
    });
  });

  it("derives currentGoalSpaceHeader from goalSpaces prop + goalSpaceId", () => {
    render(
      <AppShell
        user={user}
        goalSpaces={[{ id: "gs-alpha", name: "Alpha Test" }]}
        tasksByGoalSpace={{}}
        currentGoalSpaceHeader={null}
        goalSpaceId="gs-alpha"
        card={null}
        tokensUsed={0}
        tokensCap={100000}
        env="dev"
      >
        <div data-testid="page-child">test-child</div>
      </AppShell>,
    );
    expect(screen.getAllByText("Alpha Test").length).toBeGreaterThanOrEqual(2);
  });

  it("forwards ai_role_started SSE events into agentsStore", () => {
    render(
      <AppShell
        user={user}
        goalSpaces={goalSpaces}
        tasksByGoalSpace={tasksByGoalSpace}
        currentGoalSpaceHeader={null}
        goalSpaceId="gs-alpha"
        card={null}
        tokensUsed={0}
        tokensCap={100000}
        env="dev"
      >
        <div data-testid="page-child">test-child</div>
      </AppShell>,
    );

    const evt: RealtimeEvent = {
      id: "evt-1",
      sequence: 1,
      goal_space_id: "gs-alpha",
      type: "ai_role_started",
      resource: { type: "ai_role", id: "dev_crafter" },
      actor: { type: "ai_role", id: "dev_crafter" },
      data: { cardId: "card-9" },
      occurred_at: new Date().toISOString(),
    };

    act(() => {
      boardStore.append("gs-alpha", evt);
    });

    expect(useAgentsStore.getState().byRole.dev_crafter.status).toBe("running");
    expect(useAgentsStore.getState().byRole.dev_crafter.currentTaskId).toBe("card-9");
  });
});
