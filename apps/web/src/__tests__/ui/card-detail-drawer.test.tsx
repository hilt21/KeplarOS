/**
 * CardDetailDrawer (F2-09) — RED-first test.
 *
 * Verifies: returns null when card is null; renders three tabs;
 * shows legal transitions as buttons per state; transition click
 * fires onTransition; terminal states show // terminal; close
 * button fires onClose.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CardDetailDrawer } from "@/components/card-detail-drawer";
import type { CardResponse } from "@/lib/api/types";

afterEach(() => {
  cleanup();
});

function makeCard(overrides: Partial<CardResponse> = {}): CardResponse {
  return {
    id: "card-1",
    display_id: "CARD-1",
    goal_space_id: "gs-1",
    node_board_id: "board-1",
    title: "Build login",
    description: "Implement OAuth login flow",
    state: "todo",
    assigned_to: null,
    priority: 1,
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

describe("CardDetailDrawer", () => {
  it("returns null when card is null", () => {
    const { container } = render(
      <CardDetailDrawer
        card={null}
        onClose={() => {}}
        onTransition={() => {}}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the card title and display_id in the header", () => {
    render(
      <CardDetailDrawer
        card={makeCard()}
        onClose={() => {}}
        onTransition={() => {}}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    expect(screen.getByText("Build login")).toBeInTheDocument();
    expect(screen.getByText("CARD-1")).toBeInTheDocument();
  });

  it("renders three tabs: OVERVIEW, TRANSITIONS, AUDIT", () => {
    render(
      <CardDetailDrawer
        card={makeCard()}
        onClose={() => {}}
        onTransition={() => {}}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    expect(screen.getByRole("tab", { name: "OVERVIEW" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "TRANSITIONS" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AUDIT" })).toBeInTheDocument();
  });

  it("shows legal transitions for the current state (todo → dev, blocked)", () => {
    render(
      <CardDetailDrawer
        card={makeCard({ state: "todo" })}
        onClose={() => {}}
        onTransition={() => {}}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    const devBtn = screen.getByRole("button", { name: /dev/ });
    const blockedBtn = screen.getByRole("button", { name: /blocked/ });
    expect(devBtn).toBeInTheDocument();
    expect(blockedBtn).toBeInTheDocument();
  });

  it("clicking a transition fires onTransition with the target state", () => {
    const onTransition = vi.fn();
    render(
      <CardDetailDrawer
        card={makeCard({ state: "backlog" })}
        onClose={() => {}}
        onTransition={onTransition}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /todo/ }));
    expect(onTransition).toHaveBeenCalledWith("todo");
  });

  it("shows // terminal when state has no legal transitions", () => {
    render(
      <CardDetailDrawer
        card={makeCard({ state: "done" })}
        onClose={() => {}}
        onTransition={() => {}}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    expect(screen.getByText("// terminal")).toBeInTheDocument();
  });

  it("clicking the close button fires onClose", () => {
    const onClose = vi.fn();
    render(
      <CardDetailDrawer
        card={makeCard()}
        onClose={onClose}
        onTransition={() => {}}
        transitions={[]}
        auditTrail={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
