import { describe, expect, it, beforeEach } from "vitest";
import { useContextStore, parseContextFromPath } from "../context-store";

describe("contextStore", () => {
  beforeEach(() => {
    useContextStore.setState({ current: { goalSpaceId: "", taskId: null } });
  });

  it("parseContextFromPath returns goal-space context for /goal-spaces/[id]", () => {
    expect(parseContextFromPath("/goal-spaces/abc123")).toEqual({
      goalSpaceId: "abc123",
      taskId: null,
    });
  });

  it("parseContextFromPath returns task context for /goal-spaces/[id]/tasks/[taskId]", () => {
    expect(parseContextFromPath("/goal-spaces/abc123/tasks/xyz789")).toEqual({
      goalSpaceId: "abc123",
      taskId: "xyz789",
    });
  });

  it("setContext updates partial fields", () => {
    useContextStore.setState({
      current: { goalSpaceId: "abc", taskId: null },
    });
    useContextStore.getState().setContext({ taskId: "xyz" });
    expect(useContextStore.getState().current).toEqual({
      goalSpaceId: "abc",
      taskId: "xyz",
    });
  });
});
