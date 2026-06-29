import { describe, expect, it, beforeEach } from "vitest";
import { useAgentsStore, type AgentRoleId } from "../agents-store";

describe("agentsStore", () => {
  beforeEach(() => {
    useAgentsStore.setState({
      byRole: {
        backlog_refiner: { status: "idle", elapsedMs: 0, currentTaskId: null },
        todo_orchestrator: { status: "idle", elapsedMs: 0, currentTaskId: null },
        dev_crafter: { status: "idle", elapsedMs: 0, currentTaskId: null },
        review_guard: { status: "idle", elapsedMs: 0, currentTaskId: null },
        done_reporter: { status: "idle", elapsedMs: 0, currentTaskId: null },
        blocked_resolver: { status: "idle", elapsedMs: 0, currentTaskId: null },
      },
    });
  });

  it("setStatus updates one role and is idempotent for same status", () => {
    useAgentsStore.getState().setStatus("dev_crafter", "running", "card-1");
    expect(useAgentsStore.getState().byRole.dev_crafter).toEqual({
      status: "running",
      elapsedMs: 0,
      currentTaskId: "card-1",
    });
    useAgentsStore.getState().setStatus("dev_crafter", "running", "card-1");
    expect(useAgentsStore.getState().byRole.dev_crafter.elapsedMs).toBe(0);
  });

  it("setStatus to idle clears currentTaskId", () => {
    useAgentsStore.getState().setStatus("dev_crafter", "running", "card-1");
    useAgentsStore.getState().setStatus("dev_crafter", "idle");
    expect(useAgentsStore.getState().byRole.dev_crafter.currentTaskId).toBe(null);
  });
});