/**
 * TaskTimelineView (F8) — RED-first test.
 *
 * Verifies:
 *  - Initial render shows the `entries` prop.
 *  - When liveStream receives a new event, a TimelineMessage is appended.
 *  - When total entries exceed 200, oldest are dropped.
 *  - When user is scrolled up, the "↓ new messages" indicator appears.
 *  - Clicking the indicator scrolls to bottom + clears the badge.
 *  - aria-live="polite" is present on the log container.
 *  - liveStream entries for other cards are filtered out.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { TaskTimelineView } from "../task-timeline-view";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/api/types";

// Mock the confirmation API to avoid touching the network in tests.
vi.mock("@/lib/api/confirmations", () => ({
  decideConfirmation: vi.fn().mockResolvedValue({
    id: "conf-1",
    status: "approved",
    decided_by: "user-1",
    decided_at: "2026-06-28T00:00:00Z",
    card_state_changed: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeRealtimeEvent(
  id: string,
  type: RealtimeEventType,
  overrides: Partial<RealtimeEvent> = {},
): RealtimeEvent {
  return {
    id,
    sequence: Number(id.replace(/\D/g, "")) || 0,
    type,
    goal_space_id: "gs-1",
    resource: { type: "card", id: "card-1" },
    actor: { type: "ai_role", name: "Dev Crafter" },
    data: {},
    occurred_at: "2026-06-28T00:00:00Z",
    ...overrides,
  };
}

interface RenderOpts {
  readonly entries?: ReadonlyArray<{
    readonly id: string;
    readonly variant:
      | "user"
      | "agent-thinking"
      | "agent-streaming"
      | "tool"
      | "confirmation"
      | "system";
    readonly body: string;
  }>;
  readonly liveStream?: readonly RealtimeEvent[];
  readonly cardId?: string;
}

function build(opts: RenderOpts): {
  cardId: string;
  entries: RenderOpts["entries"];
  liveStream?: readonly RealtimeEvent[];
} {
  return {
    cardId: opts.cardId ?? "card-1",
    entries: opts.entries ?? [],
    ...(opts.liveStream ? { liveStream: opts.liveStream } : {}),
  };
}

function renderTimeline(opts: RenderOpts = {}): ReturnType<typeof render> {
  const props = build(opts);
  return render(
    <TaskTimelineView
      cardId={props.cardId}
      displayId="CARD-1"
      title="Wire SSE"
      state="dev"
      assignee="Dev Crafter"
      entries={props.entries ?? []}
      {...(props.liveStream ? { liveStream: props.liveStream } : {})}
      onSend={() => undefined}
    />,
  );
}

function jsxRenderTimeline(r: ReturnType<typeof render>, opts: RenderOpts = {}): void {
  const props = build(opts);
  r.rerender(
    <TaskTimelineView
      cardId={props.cardId}
      displayId="CARD-1"
      title="Wire SSE"
      state="dev"
      assignee="Dev Crafter"
      entries={props.entries ?? []}
      {...(props.liveStream ? { liveStream: props.liveStream } : {})}
      onSend={() => undefined}
    />,
  );
}

describe("TaskTimelineView — F8 SSE wiring", () => {
  it("renders the initial entries prop", () => {
    renderTimeline({
      entries: [
        { id: "1", variant: "system", body: "card created" },
        { id: "2", variant: "user", body: "hello" },
      ],
    });
    expect(screen.getByText("card created")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("merges a new SSE event into the rendered timeline", async () => {
    const initial: RealtimeEvent[] = [
      makeRealtimeEvent("evt-1", "card_state_changed", {
        resource: { type: "card", id: "card-1" },
        data: { state: "todo" },
      }),
    ];
    const r = renderTimeline({ liveStream: initial });
    expect(screen.getAllByText(/state → todo/).length).toBeGreaterThanOrEqual(1);

    const next: RealtimeEvent[] = [
      ...initial,
      makeRealtimeEvent("evt-2", "ai_role_started", {
        resource: { type: "card", id: "card-1" },
        data: { role: "Dev Crafter" },
      }),
    ];
    jsxRenderTimeline(r, { liveStream: next });

    await waitFor(() => {
      expect(screen.getAllByText(/Dev Crafter started/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("caps the merged timeline at 200 entries (oldest dropped)", () => {
    // Render with 199 entries already, then push one more via SSE.
    const seed = Array.from({ length: 199 }, (_, i) => ({
      id: `seed-${i}`,
      variant: "system" as const,
      body: `seed #${i}`,
    }));
    const initial: RealtimeEvent[] = [
      makeRealtimeEvent("evt-x", "card_state_changed", {
        resource: { type: "card", id: "card-1" },
        data: { state: "dev" },
        sequence: 1000,
      }),
    ];
    const r = renderTimeline({ entries: seed, liveStream: initial });
    // Trim boundary = exactly 200 → no drop yet.
    expect(screen.getByText(/seed #0/)).toBeInTheDocument();
    expect(screen.getAllByText(/state → dev/).length).toBeGreaterThanOrEqual(1);

    // Now bump liveStream to push total past 200 — the oldest
    // seeded entry must drop.
    const next: RealtimeEvent[] = [
      ...initial,
      makeRealtimeEvent("evt-y", "card_state_changed", {
        resource: { type: "card", id: "card-1" },
        data: { state: "review" },
        sequence: 1001,
      }),
    ];
    jsxRenderTimeline(r, { entries: seed, liveStream: next });
    // After re-render with 201 sources, the oldest seeded entry
    // should now be pruned.
    expect(screen.queryByText(/seed #0/)).toBeNull();
    // The fresh state → review entry must remain.
    expect(screen.getAllByText(/state → review/).length).toBeGreaterThanOrEqual(1);
  });

  it("ignores liveStream events for other cards", () => {
    const stream: RealtimeEvent[] = [
      makeRealtimeEvent("other", "card_state_changed", {
        resource: { type: "card", id: "card-2" },
        data: { state: "todo" },
      }),
      makeRealtimeEvent("mine", "card_state_changed", {
        resource: { type: "card", id: "card-1" },
        data: { state: "todo" },
      }),
    ];
    renderTimeline({ cardId: "card-1", liveStream: stream });
    // Exactly one "state → todo" body — the matching card only.
    expect(screen.getAllByText(/state → todo/)).toHaveLength(1);
  });

  it("exposes aria-live=polite on the log container", () => {
    renderTimeline();
    const scroller = screen.getByTestId("timeline-scroller");
    expect(scroller.getAttribute("role")).toBe("log");
    expect(scroller.getAttribute("aria-live")).toBe("polite");
  });

  it("shows the new-messages indicator when scrolled up", async () => {
    // First render with empty liveStream — pre-stubs the scroll metrics
    // BEFORE any state update so the merge effect sees
    // isAtBottomRef.current === false on rerender.
    const r = renderTimeline({ liveStream: [] });
    const scroller = screen.getByTestId("timeline-scroller");

    // Large scrolled-up geometry: user is 4900px above bottom.
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => 5000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => 0,
      set: () => undefined,
    });

    // Force the rAF-callback in the resize effect to re-evaluate
    // bottom-ness with the new geometry.
    fireEvent.scroll(scroller);
    await waitFor(() => {
      expect(r).toBeTruthy();
    });

    // Rerender with one matching live event — the merge effect will
    // see isAtBottomRef.current === false and bump unreadCount.
    jsxRenderTimeline(r, {
      liveStream: [
        makeRealtimeEvent("evt-a", "ai_role_started", {
          resource: { type: "card", id: "card-1" },
          data: { role: "Review Guard" },
          sequence: 42,
        }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId("timeline-new-messages-indicator")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/new message/).length).toBeGreaterThanOrEqual(1);
  });

  it("clicking the indicator scrolls to bottom and clears the badge", async () => {
    const r = renderTimeline({ liveStream: [] });
    const scroller = screen.getByTestId("timeline-scroller");

    let scrollTop = 0;
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => 5000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
    });

    fireEvent.scroll(scroller);

    jsxRenderTimeline(r, {
      liveStream: [
        makeRealtimeEvent("evt-a", "ai_role_completed", {
          resource: { type: "card", id: "card-1" },
          data: { role: "Backlog Refiner" },
          sequence: 7,
        }),
        makeRealtimeEvent("evt-b", "ai_role_completed", {
          resource: { type: "card", id: "card-1" },
          data: { role: "Todo Orchestrator" },
          sequence: 8,
        }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId("timeline-new-messages-indicator")).toBeInTheDocument();
    });

    // The click handler should scrollTop = scrollHeight (5000).
    fireEvent.click(screen.getByTestId("timeline-new-messages-indicator"));
    expect(scrollTop).toBe(5000);

    // Indicator disappears after clearing.
    await waitFor(() => {
      expect(screen.queryByTestId("timeline-new-messages-indicator")).toBeNull();
    });
  });
});
