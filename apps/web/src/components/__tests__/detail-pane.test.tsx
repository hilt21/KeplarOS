/**
 * DetailPane — right-rail component test.
 *
 * The detail pane stacks three zones inside a single scrollable column:
 *   1. WorkspacePanel  (workspace metadata + token meter)
 *   2. AIPanel         (six AI role status indicators)
 *   3. CardRuntime     (only when a `card` prop is provided)
 *
 * We assert each zone is rendered, that the WorkspacePanel shows the
 * expected token-meter values, and that the optional CardRuntime is
 * omitted when no card is passed.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { DetailPane } from "../detail-pane";
import { resetTokensStore, tokensStore } from "@/lib/state/tokens-store";

const baseWorkspace = {
  goalSpaceName: "Alpha",
  boardName: "Board A",
  userName: "Test User",
  userRole: "Engineer",
  runtime: "Next.js · React",
  apiBase: "/api/v1",
  tokensUsed: 50000,
  tokensCap: 100000,
};

beforeEach(() => {
  resetTokensStore();
});

afterEach(() => {
  cleanup();
});

describe("DetailPane", () => {
  it("renders the workspace panel zone with the seeded metadata", () => {
    tokensStore.setState({ used: 50000, cap: 100000 });
    render(<DetailPane workspace={baseWorkspace} env="dev" card={null} />);

    // Zone 1: WorkspacePanel header + key fields
    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Board A")).toBeInTheDocument();
    expect(screen.getByText("Test User · Engineer")).toBeInTheDocument();
    expect(screen.getByText("Next.js · React")).toBeInTheDocument();
    expect(screen.getByText("/api/v1")).toBeInTheDocument();
  });

  it("renders the AI panel zone with all six agent roles", () => {
    render(<DetailPane workspace={baseWorkspace} env="dev" card={null} />);

    // Zone 2: AIPanel header + each role label
    expect(screen.getByText("AI ROLES")).toBeInTheDocument();
    expect(screen.getByText("Backlog Refiner")).toBeInTheDocument();
    expect(screen.getByText("Todo Orchestrator")).toBeInTheDocument();
    expect(screen.getByText("Dev Crafter")).toBeInTheDocument();
    expect(screen.getByText("Review Guard")).toBeInTheDocument();
    expect(screen.getByText("Done Reporter")).toBeInTheDocument();
    expect(screen.getByText("Blocked Resolver")).toBeInTheDocument();
  });

  it("renders the env badge and token meter from workspace info", () => {
    tokensStore.setState({ used: 50000, cap: 100000 });
    render(<DetailPane workspace={baseWorkspace} env="prod" card={null} />);

    // env badge in workspace panel header
    expect(screen.getByText("prod")).toBeInTheDocument();

    // Token count text — toLocaleString-formatted values
    expect(screen.getByText("50,000 / 100,000")).toBeInTheDocument();
  });

  it("omits the CardRuntime zone when no card is passed", () => {
    render(<DetailPane workspace={baseWorkspace} env="dev" card={null} />);

    // CardRuntime renders a "CARD" header — it must not appear when no
    // card is passed. We check by absence of any runtime-specific
    // markers rather than the parent shell wrapper.
    expect(screen.queryByText("CARD RUNTIME")).toBeNull();
    // Sanity: the workspace + AI zones are still present.
    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
    expect(screen.getByText("AI ROLES")).toBeInTheDocument();
  });
});
