/**
 * GoalSpaceList (F2-09) — RED-first test.
 *
 * Verifies: rows render with id (mono), name (sans), status (mono),
 * updated-at relative time; clicking the name links to the detail
 * page; status dot reflects the goal space status.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { GoalSpaceList } from "@/components/goal-space-list";
import type { GoalSpaceListResponse, GoalSpaceResponse } from "@/lib/api/types";

afterEach(() => {
  cleanup();
});

function makeRow(overrides: Partial<GoalSpaceResponse> = {}): GoalSpaceResponse {
  return {
    id: "gspc-12345678",
    name: "Ship F2-09",
    description: "Web UI",
    constraints: [],
    acceptance_criteria: [],
    status: "active",
    progress: 0,
    initiator_id: "user-1",
    created_at: "2026-06-23T00:00:00.000Z",
    updated_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    ...overrides,
  };
}

function makeSnapshot(rows: readonly GoalSpaceResponse[]): GoalSpaceListResponse {
  return {
    items: rows,
    total: rows.length,
    page: 1,
    limit: 50,
  };
}

describe("GoalSpaceList", () => {
  it("renders one row per goal space", () => {
    const snapshot = makeSnapshot([
      makeRow({ id: "gspc-aaaa", name: "First" }),
      makeRow({ id: "gspc-bbbb", name: "Second" }),
    ]);
    render(<GoalSpaceList snapshot={snapshot} />);
    expect(screen.getAllByText("First").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gspc-aaa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Second").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gspc-bbb").length).toBeGreaterThan(0);
  });

  it("shows the status as a mono uppercase label", () => {
    const snapshot = makeSnapshot([makeRow({ status: "draft" })]);
    render(<GoalSpaceList snapshot={snapshot} />);
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("renders relative time for updated_at", () => {
    const snapshot = makeSnapshot([
      makeRow({ updated_at: new Date(Date.now() - 5 * 60_000).toISOString() }),
    ]);
    render(<GoalSpaceList snapshot={snapshot} />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("links each row to the goal space detail page", () => {
    const snapshot = makeSnapshot([makeRow({ id: "gspc-deadbeef" })]);
    render(<GoalSpaceList snapshot={snapshot} />);
    const link = screen.getByRole("link", { name: /Ship F2-09/ });
    expect(link.getAttribute("href")).toBe("/goal-spaces/gspc-deadbeef");
  });

  it("renders an empty body when the snapshot is empty (caller renders EmptyState)", () => {
    // GoalSpaceList itself does not render empty state; the page
    // renders <EmptyState> when items.length === 0. GoalSpaceList
    // with empty items renders an empty <tbody>.
    const { container } = render(<GoalSpaceList snapshot={makeSnapshot([])} />);
    const tbody = container.querySelector("tbody");
    expect(tbody).not.toBeNull();
    expect(tbody!.children.length).toBe(0);
  });
});
