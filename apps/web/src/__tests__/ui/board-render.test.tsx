/**
 * NodeBoardView (F2-09) — RED-first board-render test.
 *
 * Per the F2-09 plan § "Verification > Automated", the required test
 * is: render NodeBoardView with multiple boards × ~10 cards across
 * states; boards render in source order; CardLane's group cards by
 * state with correct counts; clicking a card row fires onSelectCard.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});

import { NodeBoardView } from "@/components/node-board-view";
import type { CardResponse, NodeBoardResponse } from "@/lib/api/types";

function makeBoard(overrides: Partial<NodeBoardResponse> = {}): NodeBoardResponse {
  return {
    id: "board-1",
    goal_space_id: "gs-1",
    key: "MAIN",
    name: "Main board",
    description: "Primary board",
    status: "active",
    members: [],
    created_at: "2026-06-23T00:00:00.000Z",
    updated_at: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

function makeCard(
  id: string,
  state: CardResponse["state"],
  overrides: Partial<CardResponse> = {},
): CardResponse {
  return {
    id,
    display_id: `CARD-${id}`,
    goal_space_id: "gs-1",
    node_board_id: "board-1",
    title: `Card ${id}`,
    description: "",
    state,
    assigned_to: null,
    priority: 0,
    risk_level: "low",
    evidence: [],
    confidence: null,
    blocked_reason: null,
    blocked_at: null,
    dependencies: [],
    tags: [],
    context: {},
    created_at: "2026-06-23T00:00:00.000Z",
    updated_at: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("NodeBoardView", () => {
  it("renders the board name and key in the header", () => {
    render(<NodeBoardView board={makeBoard()} cards={[]} onSelectCard={() => {}} />);
    expect(screen.getByText("Main board")).toBeInTheDocument();
    expect(screen.getByText("MAIN")).toBeInTheDocument();
  });

  it("renders one lane per CardState in the defined order", () => {
    render(<NodeBoardView board={makeBoard()} cards={[]} onSelectCard={() => {}} />);
    const labels = ["backlog", "todo", "dev", "review", "blocked", "done", "cancelled"];
    for (const label of labels) {
      expect(screen.getByTestId(`lane-${label}`)).toBeInTheDocument();
    }
  });

  it("groups cards by state with correct counts", () => {
    const cards: CardResponse[] = [
      makeCard("1", "backlog"),
      makeCard("2", "backlog"),
      makeCard("3", "todo"),
      makeCard("4", "dev"),
      makeCard("5", "dev"),
      makeCard("6", "dev"),
      makeCard("7", "review"),
    ];
    render(<NodeBoardView board={makeBoard()} cards={cards} onSelectCard={() => {}} />);

    expect(within(screen.getByTestId("lane-backlog")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("lane-todo")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("lane-dev")).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByTestId("lane-review")).getByText("1")).toBeInTheDocument();

    expect(within(screen.getByTestId("lane-dev")).getByText("CARD-4")).toBeInTheDocument();
    expect(within(screen.getByTestId("lane-review")).getByText("CARD-7")).toBeInTheDocument();
  });

  it("shows empty-state copy for states with no cards", () => {
    render(<NodeBoardView board={makeBoard()} cards={[]} onSelectCard={() => {}} />);
    expect(
      within(screen.getByTestId("lane-todo")).getByText("// no cards in todo"),
    ).toBeInTheDocument();
  });

  it("clicking a card row fires onSelectCard with the card id", () => {
    const onSelect = vi.fn();
    const cards = [makeCard("card-abc-123", "dev")];
    render(<NodeBoardView board={makeBoard()} cards={cards} onSelectCard={onSelect} />);
    fireEvent.click(within(screen.getByTestId("lane-dev")).getByText("CARD-card-abc-123"));
    expect(onSelect).toHaveBeenCalledWith("card-abc-123");
  });
});
