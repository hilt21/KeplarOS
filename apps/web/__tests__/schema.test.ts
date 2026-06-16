/**
 * T-001: enum literal union 值集合与 3 个真相源文档完全一致
 *
 * 真相源:
 *   - docs/specs/database_design.md    § 1 § 3  (status / state / role / trigger 等)
 *   - docs/architecture/state_transition.md § 1 § 6  (transition actor / trigger)
 *   - docs/specs/authorization_matrix.md § 2         (userRole / actorType)
 *
 * 此测试是"防漂移"护栏:任何对 schema.ts 的 enum literal union 改动若与 3 个真相源
 * 不一致,此测试会失败。修改 enum 前必须先更新对应真相源文档。
 */

import { describe, it, expect } from "vitest";
import {
  GOAL_SPACE_STATUS_VALUES,
  CARD_STATES,
  NODE_BOARD_STATUS_VALUES,
  SESSION_STATUS_VALUES,
  AGENT_EXECUTION_STATUS_VALUES,
  TRANSITION_ACTOR_VALUES,
  CONFIRMATION_STATUS_VALUES,
  CONFIRMATION_TRIGGER_TYPE_VALUES,
  USER_ROLE_VALUES,
  ENTITY_TYPE_VALUES,
  ACTOR_TYPE_VALUES,
  RISK_LEVEL_VALUES,
  NODE_BOARD_MEMBER_ROLE_VALUES,
} from "@db/schema";

describe("T-001: enum literal unions align with truth source docs", () => {
  it("goalSpaceStatus (database_design.md § 3.1) = 4 values", () => {
    expect(GOAL_SPACE_STATUS_VALUES).toEqual(["draft", "active", "completed", "cancelled"]);
  });

  it("cardState (database_design.md § 3.6 + state_transition.md § 2) = 7 values", () => {
    expect(CARD_STATES).toEqual([
      "backlog",
      "todo",
      "dev",
      "review",
      "done",
      "blocked",
      "cancelled",
    ]);
  });

  it("nodeBoardStatus (database_design.md § 3.2) = 3 values", () => {
    expect(NODE_BOARD_STATUS_VALUES).toEqual(["active", "paused", "archived"]);
  });

  it("sessionStatus (database_design.md § 3.4) = 5 values", () => {
    expect(SESSION_STATUS_VALUES).toEqual(["active", "paused", "expired", "closed", "crashed"]);
  });

  it("agentExecutionStatus (database_design.md § 3.5) = 7 values", () => {
    expect(AGENT_EXECUTION_STATUS_VALUES).toEqual([
      "queued",
      "running",
      "completed",
      "failed",
      "blocked",
      "needs_confirmation",
      "cancelled",
    ]);
  });

  it("transitionActor (state_transition.md § 1) = 3 values", () => {
    expect(TRANSITION_ACTOR_VALUES).toEqual(["human", "ai_role", "system"]);
  });

  it("confirmationStatus (database_design.md § 3.8) = 4 values", () => {
    expect(CONFIRMATION_STATUS_VALUES).toEqual(["pending", "approved", "rejected", "cancelled"]);
  });

  it("confirmationTriggerType (database_design.md § 3.8) = 5 values", () => {
    expect(CONFIRMATION_TRIGGER_TYPE_VALUES).toEqual([
      "high_risk",
      "low_confidence",
      "external_write",
      "deployment",
      "irreversible",
    ]);
  });

  it("userRole (database_design.md § 3.11 + authorization_matrix.md § 2) = 3 values", () => {
    expect(USER_ROLE_VALUES).toEqual(["initiator", "chain_user", "viewer"]);
  });

  it("entityType (database_design.md § 3.9) = 7 values (audit-style, 'confirm' not 'confirmation')", () => {
    expect(ENTITY_TYPE_VALUES).toEqual([
      "goal_space",
      "node_board",
      "node_board_member",
      "card",
      "session",
      "agent_execution",
      "confirm",
    ]);
  });

  it("actorType (authorization_matrix.md § 2) is an alias of transitionActor", () => {
    expect(ACTOR_TYPE_VALUES).toEqual(TRANSITION_ACTOR_VALUES);
  });

  it("riskLevel (database_design.md § 3.8) = 4 values", () => {
    expect(RISK_LEVEL_VALUES).toEqual(["low", "medium", "high", "critical"]);
  });

  it("nodeBoardMemberRole (database_design.md § 3.3, helper enum) = 3 values", () => {
    expect(NODE_BOARD_MEMBER_ROLE_VALUES).toEqual(["editor", "viewer", "observer"]);
  });
});
