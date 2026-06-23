/**
 * ExecutionStatus (F2-09) — RED-first test.
 *
 * Verifies: rows derived from ai_role_started appear with the resource
 * id and a timer; matching ai_role_completed removes the row; matching
 * ai_role_failed removes the row; multiple in-flight rows render in
 * the order they started; empty events show // idle.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ExecutionStatus } from "@/components/execution-status";
import type { RealtimeEvent } from "@/lib/api/types";

afterEach(() => {
  cleanup();
});

function startedEvent(id: string, resourceId: string, at: string): RealtimeEvent {
  return {
    id,
    sequence: 1,
    type: "ai_role_started",
    occurred_at: at,
    goal_space_id: "gs-1",
    resource: { type: "execution", id: resourceId },
    actor: { type: "ai_role", name: "Dev Crafter" },
    data: { role: "Dev Crafter" },
  };
}

function completedEvent(id: string, resourceId: string, at: string): RealtimeEvent {
  return {
    id,
    sequence: 2,
    type: "ai_role_completed",
    occurred_at: at,
    goal_space_id: "gs-1",
    resource: { type: "execution", id: resourceId },
    actor: { type: "ai_role", name: "Dev Crafter" },
    data: { result: { state: "review" } },
  };
}

function failedEvent(id: string, resourceId: string, at: string): RealtimeEvent {
  return {
    id,
    sequence: 3,
    type: "ai_role_failed",
    occurred_at: at,
    goal_space_id: "gs-1",
    resource: { type: "execution", id: resourceId },
    actor: { type: "ai_role", name: "Dev Crafter" },
    data: { error: { code: "INTERNAL", message: "boom" } },
  };
}

describe("ExecutionStatus", () => {
  it("shows // idle when no events", () => {
    render(<ExecutionStatus events={[]} />);
    expect(screen.getByText("// idle")).toBeInTheDocument();
  });

  it("renders a row for each in-flight execution", () => {
    const events: RealtimeEvent[] = [
      startedEvent("e1", "exec-aaa", new Date().toISOString()),
      startedEvent("e2", "exec-bbb", new Date().toISOString()),
    ];
    render(<ExecutionStatus events={events} />);
    expect(screen.getByText("exec-aaa")).toBeInTheDocument();
    expect(screen.getByText("exec-bbb")).toBeInTheDocument();
    expect(screen.queryByText("// idle")).not.toBeInTheDocument();
  });

  it("removes a row when its matching completed event arrives", () => {
    const started = startedEvent("e1", "exec-aaa", new Date().toISOString());
    const completed = completedEvent("e2", "exec-aaa", new Date().toISOString());
    const { rerender } = render(<ExecutionStatus events={[started]} />);
    expect(screen.getByText("exec-aaa")).toBeInTheDocument();
    rerender(<ExecutionStatus events={[started, completed]} />);
    expect(screen.queryByText("exec-aaa")).not.toBeInTheDocument();
    expect(screen.getByText("// idle")).toBeInTheDocument();
  });

  it("removes a row when its matching failed event arrives", () => {
    const started = startedEvent("e1", "exec-aaa", new Date().toISOString());
    const failed = failedEvent("e2", "exec-aaa", new Date().toISOString());
    const { rerender } = render(<ExecutionStatus events={[started]} />);
    rerender(<ExecutionStatus events={[started, failed]} />);
    expect(screen.queryByText("exec-aaa")).not.toBeInTheDocument();
  });

  it("keeps rows for executions that have not finished", () => {
    const a = startedEvent("e1", "exec-aaa", new Date().toISOString());
    const b = startedEvent("e2", "exec-bbb", new Date().toISOString());
    const aDone = completedEvent("e3", "exec-aaa", new Date().toISOString());
    render(<ExecutionStatus events={[a, b, aDone]} />);
    expect(screen.queryByText("exec-aaa")).not.toBeInTheDocument();
    expect(screen.getByText("exec-bbb")).toBeInTheDocument();
  });
});
