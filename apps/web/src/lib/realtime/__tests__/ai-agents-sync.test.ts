/**
 * useAIAgentsSync — bridge from boardStore SSE events to agentsStore.
 *
 * The AIPanel reads from agentsStore but no production code writes
 * to it. This hook subscribes to boardStore and forwards
 * ai_role_started/completed/failed to agentsStore.setStatus so the
 * panel reflects real AI status.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { useAIAgentsSync } from "../ai-agents-sync";
import { boardStore } from "@/lib/state/board-store";
import { useAgentsStore, type AgentRoleId } from "@/lib/state/agents-store";
import type { RealtimeEvent } from "@/lib/api/types";

function event(
  over: Partial<RealtimeEvent> & Pick<RealtimeEvent, "type" | "resource">,
): RealtimeEvent {
  return {
    id: over.id ?? `evt-${Math.random().toString(36).slice(2)}`,
    sequence: over.sequence ?? 1,
    goal_space_id: "gs-1",
    actor: over.actor ?? { type: "ai_role", id: "dev_crafter" },
    data: over.data ?? {},
    occurred_at: over.occurred_at ?? new Date().toISOString(),
    ...over,
  } as RealtimeEvent;
}

function idleByRole() {
  return {
    backlog_refiner: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    todo_orchestrator: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    dev_crafter: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    review_guard: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    done_reporter: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
    blocked_resolver: { status: "idle" as const, elapsedMs: 0, currentTaskId: null },
  };
}

beforeEach(() => {
  boardStore.clear("gs-1");
  useAgentsStore.setState({ byRole: idleByRole() });
});

afterEach(() => {
  boardStore.clear("gs-1");
});

describe("useAIAgentsSync", () => {
  it("forwards ai_role_started to agentsStore as 'running'", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append(
        "gs-1",
        event({
          type: "ai_role_started",
          resource: { type: "ai_role", id: "dev_crafter" },
          actor: { type: "ai_role", id: "dev_crafter" },
          data: { cardId: "card-1" },
        }),
      );
    });

    const state = useAgentsStore.getState();
    expect(state.byRole.dev_crafter.status).toBe("running");
    expect(state.byRole.dev_crafter.currentTaskId).toBe("card-1");
    expect(state.byRole.backlog_refiner.status).toBe("idle");
  });

  it("forwards ai_role_completed to agentsStore as 'idle'", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append(
        "gs-1",
        event({
          type: "ai_role_started",
          resource: { type: "ai_role", id: "review_guard" },
          actor: { type: "ai_role", id: "review_guard" },
          data: { cardId: "card-2" },
        }),
      );
      boardStore.append(
        "gs-1",
        event({
          type: "ai_role_completed",
          resource: { type: "ai_role", id: "review_guard" },
          actor: { type: "ai_role", id: "review_guard" },
          data: { cardId: "card-2" },
        }),
      );
    });

    const state = useAgentsStore.getState();
    expect(state.byRole.review_guard.status).toBe("idle");
    expect(state.byRole.review_guard.currentTaskId).toBeNull();
  });

  it("forwards ai_role_failed to agentsStore as 'error'", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append(
        "gs-1",
        event({
          type: "ai_role_failed",
          resource: { type: "ai_role", id: "todo_orchestrator" },
          actor: { type: "ai_role", id: "todo_orchestrator" },
          data: { cardId: "card-3", reason: "timeout" },
        }),
      );
    });

    expect(useAgentsStore.getState().byRole.todo_orchestrator.status).toBe("error");
  });

  it("ignores events for other goal spaces", () => {
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append(
        "gs-other",
        event({
          type: "ai_role_started",
          resource: { type: "ai_role", id: "dev_crafter" },
          actor: { type: "ai_role", id: "dev_crafter" },
          data: { cardId: "card-9" },
          goal_space_id: "gs-other",
        }),
      );
    });

    expect(useAgentsStore.getState().byRole.dev_crafter.status).toBe("idle");
  });

  it("ignores events whose role id is not in AgentRoleId", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useAIAgentsSync("gs-1"));

    act(() => {
      boardStore.append(
        "gs-1",
        event({
          type: "ai_role_started",
          resource: { type: "ai_role", id: "unknown_role" as AgentRoleId },
          actor: { type: "ai_role", id: "unknown_role" },
          data: { cardId: "card-9" },
        }),
      );
    });

    for (const role of Object.keys(useAgentsStore.getState().byRole) as AgentRoleId[]) {
      expect(useAgentsStore.getState().byRole[role].status).toBe("idle");
    }
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
