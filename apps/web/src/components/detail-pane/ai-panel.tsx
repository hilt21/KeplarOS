"use client";

import type { ReactElement } from "react";
import { useAgentsStore, type AgentRoleId, type AgentStatus } from "@/lib/state/agents-store";

const ROLE_LABELS: Record<AgentRoleId, string> = {
  backlog_refiner: "Backlog Refiner",
  todo_orchestrator: "Todo Orchestrator",
  dev_crafter: "Dev Crafter",
  review_guard: "Review Guard",
  done_reporter: "Done Reporter",
  blocked_resolver: "Blocked Resolver",
};

const STATE_COLOR: Record<AgentStatus, string> = {
  idle: "var(--color-success)",
  queued: "var(--color-warning)",
  running: "var(--color-info)",
  error: "var(--color-error)",
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ROLE_ORDER: AgentRoleId[] = [
  "backlog_refiner",
  "todo_orchestrator",
  "dev_crafter",
  "review_guard",
  "done_reporter",
  "blocked_resolver",
];

export function AIPanel(): ReactElement {
  const byRole = useAgentsStore((s) => s.byRole);
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          marginBottom: 8,
        }}
      >
        AI ROLES
      </div>
      {ROLE_ORDER.map((role) => {
        const state = byRole[role];
        return (
          <div
            key={role}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 0",
              fontSize: 11,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                background: STATE_COLOR[state.status],
                borderRadius: "50%",
                flexShrink: 0,
                animation: state.status === "running" ? "pulse 1.6s ease-in-out infinite" : undefined,
              }}
            />
            <span style={{ color: "var(--color-text-secondary)", flex: 1 }}>{ROLE_LABELS[role]}</span>
            <span
              style={{
                color: state.status === "running" ? "var(--color-info)" : "var(--color-text-muted)",
                fontFamily: "var(--font-jetbrains-mono,monospace)",
                fontSize: 9,
              }}
            >
              {state.status === "running" && state.elapsedMs > 0
                ? formatElapsed(state.elapsedMs)
                : state.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
