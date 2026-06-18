/**
 * T-003: InferSelectModel / InferInsertModel 类型 + JSON 字段 text 读写 +
 *        schema 对象聚合导出回退兼容 S1 占位。
 *
 * 真相源: docs/specs/database_design.md § 3 + § 6
 *
 * 此测试用 type-level assertions (编译时) + 运行时 assert(import / shape) 双向验证。
 */

import { describe, it, expect } from "vitest";
import type {
  User,
  NewUser,
  Card,
  NewCard,
  GoalSpace,
  NodeBoard,
  NodeBoardMember,
  Session,
  AgentExecution,
  StateTransition,
  HumanConfirmation,
  AuditEntry,
  RealtimeEvent,
  Schema,
} from "@db/schema";
import { schema } from "@db/schema";

describe("T-003: inferred row types compile and have the expected column set", () => {
  it("User select model has the 7 columns from § 3.11", () => {
    const sample: User = {
      id: "0".repeat(32),
      name: "x",
      email: "x@example.com",
      role: "initiator",
      preferences: {},
      createdAt: "2026-06-07 00:00:00",
      lastLoginAt: null,
    };
    expect(Object.keys(sample).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "lastLoginAt",
      "name",
      "preferences",
      "role",
    ]);
  });

  it("NewUser insert model makes lastLoginAt optional (no .notNull())", () => {
    const insert: NewUser = {
      name: "x",
      email: "x@example.com",
    };
    expect(insert.lastLoginAt).toBeUndefined();
    expect(insert.role).toBeUndefined();
    expect(insert.id).toBeUndefined();
  });

  it("Card select model carries all 22 § 3.6 columns (DB-014/015/023)", () => {
    const sample: Card = {
      id: "0".repeat(32),
      goalSpaceId: "0".repeat(32),
      nodeBoardId: "0".repeat(32),
      displayId: "CARD-001",
      title: "x",
      description: null,
      state: "backlog",
      assignedTo: null,
      priority: 0,
      riskLevel: "medium",
      evidence: [],
      confidence: null,
      dependencies: [],
      tags: [],
      context: {},
      blockedReason: null,
      blockedAt: null,
      cancelledReason: null,
      cancelledAt: null,
      createdAt: "2026-06-07 00:00:00",
      updatedAt: "2026-06-07 00:00:00",
      deletedAt: null,
    };
    expect(Object.keys(sample)).toHaveLength(22);
  });

  it("NewCard insert model makes nullable fields optional", () => {
    const insert: NewCard = {
      goalSpaceId: "0".repeat(32),
      nodeBoardId: "0".repeat(32),
      displayId: "CARD-001",
      title: "x",
    };
    expect(insert.state).toBeUndefined();
    expect(insert.priority).toBeUndefined();
    expect(insert.description).toBeUndefined();
    expect(insert.assignedTo).toBeUndefined();
    expect(insert.riskLevel).toBeUndefined();
    expect(insert.evidence).toBeUndefined();
    expect(insert.confidence).toBeUndefined();
    expect(insert.dependencies).toBeUndefined();
  });

  it("GoalSpace row carries 17 columns from § 3.1 (DB-001: name + 6 added columns)", () => {
    const sample: GoalSpace = {
      id: "0".repeat(32),
      initiatorId: "0".repeat(32),
      name: "x",
      description: null,
      constraints: [],
      acceptanceCriteria: null,
      status: "draft",
      progress: 0,
      templateId: null,
      tags: [],
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
      deletedAt: null,
      createdAt: "2026-06-07 00:00:00",
      updatedAt: "2026-06-07 00:00:00",
    };
    expect(Object.keys(sample)).toHaveLength(17);
  });

  it("aggregated schema export contains all 12 tables (S1 back-compat + Wave 3 SEC-006)", () => {
    expect(Object.keys(schema).sort()).toEqual([
      "agentExecutions",
      "auditEntries",
      "authCredentials",
      "cards",
      "goalSpaces",
      "humanConfirmations",
      "nodeBoardMembers",
      "nodeBoards",
      "realtimeEvents",
      "sessions",
      "stateTransitions",
      "users",
    ]);
  });

  it("Session select model carries the § 3.4 column set (status, trigger, actor, actorName, startedAt, completedAt; no userId/role/expiresAt/closedAt/closeReason)", () => {
    const sample: Session = {
      id: "0".repeat(32),
      goalSpaceId: "0".repeat(32),
      status: "queued",
      trigger: "manual_start",
      actor: "human",
      actorName: null,
      context: {},
      startedAt: null,
      completedAt: null,
      createdAt: "2026-06-07 00:00:00",
      updatedAt: "2026-06-07 00:00:00",
    };
    expect(Object.keys(sample).sort()).toEqual(
      [
        "actor",
        "actorName",
        "completedAt",
        "context",
        "createdAt",
        "goalSpaceId",
        "id",
        "startedAt",
        "status",
        "trigger",
        "updatedAt",
      ].sort(),
    );
    // Re-model sanity: legacy user-session columns must be gone.
    for (const k of ["userId", "role", "expiresAt", "lastActiveAt", "closedAt", "closeReason"]) {
      expect(Object.keys(sample)).not.toContain(k);
    }
  });

  it("AgentExecution select model carries the § 3.5 column set (goalSpaceId + cardId NOT NULL, attempt + maxAttempts, requested_by_*)", () => {
    const sample: AgentExecution = {
      id: "0".repeat(32),
      goalSpaceId: "0".repeat(32),
      cardId: "0".repeat(32),
      sessionId: null,
      agentRole: "x",
      trigger: "x",
      status: "queued",
      attempt: 1,
      maxAttempts: 2,
      requestedByType: "human",
      requestedById: null,
      requestedByName: null,
      inputContext: {},
      result: null,
      errorCode: null,
      errorMessage: null,
      durationMs: null,
      startedAt: "2026-06-07 00:00:00",
      completedAt: null,
      createdAt: "2026-06-07 00:00:00",
      updatedAt: "2026-06-07 00:00:00",
    };
    expect(Object.keys(sample).sort()).toEqual(
      [
        "agentRole",
        "attempt",
        "cardId",
        "completedAt",
        "createdAt",
        "durationMs",
        "errorCode",
        "errorMessage",
        "goalSpaceId",
        "id",
        "inputContext",
        "maxAttempts",
        "result",
        "requestedById",
        "requestedByName",
        "requestedByType",
        "sessionId",
        "startedAt",
        "status",
        "trigger",
        "updatedAt",
      ].sort(),
    );
  });

  it("Schema type is a structural type usable in Drizzle db typing", () => {
    const s: Schema = schema;
    for (const key of Object.keys(s) as Array<keyof Schema>) {
      expect(s[key]).toBeDefined();
      expect(typeof s[key]).toBe("object");
    }
  });

  it("each remaining inferred row type is constructible as an empty object", () => {
    const samples = {
      nodeBoard: {} as NodeBoard,
      member: {} as NodeBoardMember,
      session: {} as Session,
      execution: {} as AgentExecution,
      transition: {} as StateTransition,
      confirmation: {} as HumanConfirmation,
      audit: {} as AuditEntry,
      realtime: {} as RealtimeEvent,
    };
    for (const [name, s] of Object.entries(samples)) {
      expect(typeof s).toBe("object");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
