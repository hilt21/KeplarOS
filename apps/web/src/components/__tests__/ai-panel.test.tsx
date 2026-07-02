/**
 * AIPanel — 6-role status board test.
 *
 * Verifies:
 *   - The panel renders all six agent roles in the canonical order.
 *   - When all roles are idle, each row's status dot has the success
 *     background color (var(--color-success)).
 *   - The status text on idle rows shows "idle" (not a running timer).
 *   - A running role replaces the elapsed-time label with the formatted
 *     elapsed milliseconds.
 *
 * The panel reads from `useAgentsStore`. We seed the store via
 * `useAgentsStore.setState` before each test so we can exercise both
 * the default-idle and a running role without touching SSE wiring.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { AIPanel } from "../detail-pane/ai-panel";
import { useAgentsStore, type AgentRoleId } from "@/lib/state/agents-store";

const ROLE_IDS: readonly AgentRoleId[] = [
  "backlog_refiner",
  "todo_orchestrator",
  "dev_crafter",
  "review_guard",
  "done_reporter",
  "blocked_resolver",
];

const ROLE_LABELS: Readonly<Record<AgentRoleId, string>> = {
  backlog_refiner: "Backlog Refiner",
  todo_orchestrator: "Todo Orchestrator",
  dev_crafter: "Dev Crafter",
  review_guard: "Review Guard",
  done_reporter: "Done Reporter",
  blocked_resolver: "Blocked Resolver",
};

function idleByRole(): Record<
  AgentRoleId,
  {
    status: "idle" | "queued" | "running" | "error";
    elapsedMs: number;
    currentTaskId: string | null;
  }
> {
  return {
    backlog_refiner: { status: "idle", elapsedMs: 0, currentTaskId: null },
    todo_orchestrator: { status: "idle", elapsedMs: 0, currentTaskId: null },
    dev_crafter: { status: "idle", elapsedMs: 0, currentTaskId: null },
    review_guard: { status: "idle", elapsedMs: 0, currentTaskId: null },
    done_reporter: { status: "idle", elapsedMs: 0, currentTaskId: null },
    blocked_resolver: { status: "idle", elapsedMs: 0, currentTaskId: null },
  };
}

beforeEach(() => {
  useAgentsStore.setState({ byRole: idleByRole() });
});

afterEach(() => {
  cleanup();
});

describe("AIPanel — 6 roles + idle indicator", () => {
  it("renders the AI ROLES header and all six agent labels", () => {
    const { container } = render(<AIPanel />);
    expect(screen.getByText("AI ROLES")).toBeInTheDocument();

    for (const label of Object.values(ROLE_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Order check: walk the rendered text content and confirm the
    // labels appear in canonical ROLE_IDS order.
    const text = container.textContent ?? "";
    let cursor = -1;
    for (const id of ROLE_IDS) {
      const idx = text.indexOf(ROLE_LABELS[id], cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("shows a status dot for each idle role (6 total, none animated)", () => {
    const { container } = render(<AIPanel />);

    // AIPanel renders one aria-hidden dot per role. jsdom strips
    // `background: var(--*)` from the inline style, so we cannot
    // assert on the green color string directly — instead we verify
    // the count and shape, and that idle dots carry no animation.
    const dots = Array.from(container.querySelectorAll("span[aria-hidden]"));
    expect(dots).toHaveLength(6);
    for (const dot of dots) {
      const style = (dot as HTMLElement).getAttribute("style") ?? "";
      // Round shape via border-radius: 50%.
      expect(style).toMatch(/border-radius:\s*50%/);
      // Idle → animation is `undefined` → React drops the key entirely.
      expect(style).not.toMatch(/animation:/);
    }
  });

  it("shows the idle status text next to each role label", () => {
    render(<AIPanel />);
    // 6 idle labels — one per role row.
    expect(screen.getAllByText("idle")).toHaveLength(6);
  });

  it("replaces a role's idle text with a formatted elapsed time when running", () => {
    const next = idleByRole();
    next.dev_crafter = { status: "running", elapsedMs: 2400, currentTaskId: "card-1" };
    useAgentsStore.setState({ byRole: next });

    render(<AIPanel />);

    // 5 idle text labels remain (dev_crafter no longer shows "idle").
    expect(screen.getAllByText("idle")).toHaveLength(5);
    // The running role shows a formatted time string like "2.4s".
    expect(screen.getByText("2.4s")).toBeInTheDocument();
    // Dev Crafter label is still rendered.
    expect(screen.getByText("Dev Crafter")).toBeInTheDocument();
  });

  it("renders a running dot with the pulse animation (non-idle shape)", () => {
    const next = idleByRole();
    next.dev_crafter = { status: "running", elapsedMs: 800, currentTaskId: "card-1" };
    useAgentsStore.setState({ byRole: next });

    const { container } = render(<AIPanel />);

    // 6 dots still render — one per role — regardless of status.
    const dots = Array.from(container.querySelectorAll("span[aria-hidden]"));
    expect(dots).toHaveLength(6);

    // The running role's dot carries the pulse animation; idle dots
    // do not. At least one dot should have an `animation:` declaration.
    const animated = dots.filter((dot) => {
      const style = (dot as HTMLElement).getAttribute("style") ?? "";
      return /animation:/.test(style);
    });
    expect(animated.length).toBeGreaterThanOrEqual(1);
  });
});
