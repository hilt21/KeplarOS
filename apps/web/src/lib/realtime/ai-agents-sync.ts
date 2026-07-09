/**
 * useAIAgentsSync — bridge from boardStore SSE events to agentsStore.
 *
 * The AIPanel reads agent status from agentsStore, but the store had
 * no production writer (only tests called setStatus). This hook
 * subscribes to the goal-space boardStore and forwards ai_role_*
 * events to agentsStore.setStatus so the panel reflects reality.
 *
 * Mount this hook once per AppShell render (it is idempotent across
 * re-renders). It is a pure effect; no return value.
 */

import { useEffect } from "react";
import { boardStore } from "@/lib/state/board-store";
import { useAgentsStore, type AgentRoleId, type AgentStatus } from "@/lib/state/agents-store";
import type { RealtimeEvent } from "@/lib/api/types";

const VALID_ROLES: ReadonlySet<AgentRoleId> = new Set<AgentRoleId>([
  "backlog_refiner",
  "todo_orchestrator",
  "dev_crafter",
  "review_guard",
  "done_reporter",
  "blocked_resolver",
]);

type AiRoleEvent =
  | { type: "ai_role_started"; data: { cardId?: string } }
  | { type: "ai_role_completed"; data: { cardId?: string } }
  | { type: "ai_role_failed"; data: { cardId?: string; reason?: string } };

function mapToAgentStatus(type: AiRoleEvent["type"]): AgentStatus {
  switch (type) {
    case "ai_role_started":
      return "running";
    case "ai_role_completed":
      return "idle";
    case "ai_role_failed":
      return "error";
  }
}

function isAiRoleEvent(event: RealtimeEvent): event is RealtimeEvent & AiRoleEvent {
  return (
    event.type === "ai_role_started" ||
    event.type === "ai_role_completed" ||
    event.type === "ai_role_failed"
  );
}

function applyEvent(event: RealtimeEvent & AiRoleEvent): void {
  const role = event.resource.id as AgentRoleId;
  if (!VALID_ROLES.has(role)) {
    // eslint-disable-next-line no-console -- warned only on misconfigured events
    console.warn(`useAIAgentsSync: ignoring event with unknown role id "${role}"`);
    return;
  }
  const cardId = typeof event.data?.cardId === "string" ? event.data.cardId : undefined;
  useAgentsStore.getState().setStatus(role, mapToAgentStatus(event.type), cardId);
}

export function useAIAgentsSync(goalSpaceId: string | null): void {
  useEffect(() => {
    if (!goalSpaceId) return;
    const unsubscribe = boardStore.subscribe(goalSpaceId, () => {
      const snapshot = boardStore.getSnapshot(goalSpaceId);
      for (const event of snapshot.events) {
        if (isAiRoleEvent(event)) applyEvent(event);
      }
    });
    // Replay any events that arrived before we attached.
    const initial = boardStore.getSnapshot(goalSpaceId);
    for (const event of initial.events) {
      if (isAiRoleEvent(event)) applyEvent(event);
    }
    return unsubscribe;
  }, [goalSpaceId]);
}
