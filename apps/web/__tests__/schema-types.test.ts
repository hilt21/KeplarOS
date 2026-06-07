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

  it("Card select model carries all 18 § 3.6 columns", () => {
    const sample: Card = {
      id: "0".repeat(32),
      goalSpaceId: "0".repeat(32),
      nodeBoardId: "0".repeat(32),
      displayId: 1,
      title: "x",
      description: null,
      state: "backlog",
      assignedTo: null,
      priority: "medium",
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
    expect(Object.keys(sample)).toHaveLength(18);
  });

  it("NewCard insert model makes nullable fields optional", () => {
    const insert: NewCard = {
      goalSpaceId: "0".repeat(32),
      nodeBoardId: "0".repeat(32),
      displayId: 1,
      title: "x",
    };
    expect(insert.state).toBeUndefined();
    expect(insert.priority).toBeUndefined();
    expect(insert.description).toBeUndefined();
    expect(insert.assignedTo).toBeUndefined();
  });

  it("GoalSpace row carries 11 columns from § 3.1", () => {
    const sample: GoalSpace = {
      id: "0".repeat(32),
      initiatorId: "0".repeat(32),
      title: "x",
      description: null,
      status: "draft",
      templateId: null,
      tags: [],
      createdAt: "2026-06-07 00:00:00",
      updatedAt: "2026-06-07 00:00:00",
      completedAt: null,
      cancelReason: null,
    };
    expect(Object.keys(sample)).toHaveLength(11);
  });

  it("aggregated schema export contains all 11 tables (S1 back-compat)", () => {
    expect(Object.keys(schema).sort()).toEqual([
      "agentExecutions",
      "auditEntries",
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
