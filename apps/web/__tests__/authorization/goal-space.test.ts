/**
 * F-003 T-007: Goal Space 权限单测
 *
 * 覆盖范围(per F-003 AC-3.2 / AC-3.3 + § 4 API 矩阵 goalSpaces 行 + ADR-001):
 *   - initiator 仅 own goalSpace 可读(canReadGoalSpace own=true / cross-owner=false)
 *   - initiator 写仅 own goalSpace(canManageGoalSpace own=true / other=false)
 *   - chain_user / viewer:作为 goalSpace 内 node_board 成员可读(S2 "一律 false"已撤销)
 *   - chain_user / viewer 非成员:仍 deny
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 资源归属 + § 4 API 矩阵
 *         docs/superpowers/decisions/2026-06-10-001-can-read-goal-space.md
 * 修订: PR #1 review P1 #1 — cross-owner 读取从 true 改为 false。
 * 修订: ADR-001 — 引入 nodeBoardMemberIds,允许成员读 goalSpace。
 */

import { describe, expect, it } from "vitest";

import { canManageGoalSpace, canReadGoalSpace } from "@/lib/authorization";
import type { GoalSpaceContext } from "@/lib/authorization";

// ─── fixtures ────────────────────────────────────────────────────────

const OWNER = "u-owner";
const OTHER_OWNER = "u-other-owner";
const GOAL_A = "g-aaa";
const GOAL_B = "g-bbb";

function goalCtx(goalSpaceId: string, initiatorId: string): GoalSpaceContext {
  return { goalSpaceId, initiatorId, nodeBoardMemberIds: [] };
}

const aOwn = goalCtx(GOAL_A, OWNER);
const bOther = goalCtx(GOAL_B, OTHER_OWNER); // 资源在 B,B 由 OTHER_OWNER 拥有;actor OWNER 只拥有 A

// ─── 1. canReadGoalSpace ─────────────────────────────────────────────

describe("canReadGoalSpace", () => {
  it("AC-3.2: initiator 读 own goalSpace → true", () => {
    expect(canReadGoalSpace({ id: OWNER, role: "initiator" }, aOwn)).toBe(true);
  });

  it("AC-3.2 (revised): initiator 只能读自己创建的 goalSpace,跨 owner 一律 false", () => {
    expect(canReadGoalSpace({ id: OWNER, role: "initiator" }, bOther)).toBe(false);
  });

  it("AC-3.2: chain_user 一律 false(S2 范围不引入间接访问)", () => {
    expect(canReadGoalSpace({ id: "u-chain", role: "chain_user" }, aOwn)).toBe(false);
  });

  it("AC-3.2: viewer 一律 false", () => {
    expect(canReadGoalSpace({ id: "u-view", role: "viewer" }, aOwn)).toBe(false);
  });

  // ─── ADR-001: node-board member access (spec §3, §4) ──────────────
  // SEC-001 / SEC-007 / COR-005: chain_user / viewer 必须是 goalSpace 内
  // 任意 nodeBoard 的成员方可读 goalSpace 单层。S2 的"non-initiator 一律 false"
  // 边界按 ADR-001 撤销。

  it("ADR-001: chain_user 是 node-board 成员 → 可读 goalSpace", () => {
    const ctx: GoalSpaceContext = {
      goalSpaceId: GOAL_A,
      initiatorId: OWNER,
      nodeBoardMemberIds: ["u-chain", "u-other"],
    };
    expect(canReadGoalSpace({ id: "u-chain", role: "chain_user" }, ctx)).toBe(true);
  });

  it("ADR-001: viewer 是 node-board 成员 → 可读 goalSpace", () => {
    const ctx: GoalSpaceContext = {
      goalSpaceId: GOAL_A,
      initiatorId: OWNER,
      nodeBoardMemberIds: ["u-view"],
    };
    expect(canReadGoalSpace({ id: "u-view", role: "viewer" }, ctx)).toBe(true);
  });

  it("ADR-001: chain_user 不是 node-board 成员 → 仍 deny", () => {
    const ctx: GoalSpaceContext = {
      goalSpaceId: GOAL_A,
      initiatorId: OWNER,
      nodeBoardMemberIds: ["u-other-1", "u-other-2"],
    };
    expect(canReadGoalSpace({ id: "u-chain", role: "chain_user" }, ctx)).toBe(false);
  });

  it("ADR-001: viewer 且 memberIds 为空 → 仍 deny", () => {
    const ctx: GoalSpaceContext = {
      goalSpaceId: GOAL_A,
      initiatorId: OWNER,
      nodeBoardMemberIds: [],
    };
    expect(canReadGoalSpace({ id: "u-view", role: "viewer" }, ctx)).toBe(false);
  });

  it("ADR-001: initiator 读 own goalSpace 行为保留(空 memberIds 仍 true)", () => {
    const ctx: GoalSpaceContext = {
      goalSpaceId: GOAL_A,
      initiatorId: OWNER,
      nodeBoardMemberIds: [],
    };
    expect(canReadGoalSpace({ id: OWNER, role: "initiator" }, ctx)).toBe(true);
  });

  it("ADR-001: initiator 读 other goalSpace 行为保留", () => {
    const ctx: GoalSpaceContext = {
      goalSpaceId: GOAL_B,
      initiatorId: OTHER_OWNER,
      nodeBoardMemberIds: [OWNER], // 即便 OWNER 是成员,initiator 路径不依赖 memberIds
    };
    expect(canReadGoalSpace({ id: OWNER, role: "initiator" }, ctx)).toBe(false);
  });
});

// ─── 2. canManageGoalSpace ───────────────────────────────────────────

describe("canManageGoalSpace", () => {
  it("AC-3.3: initiator == ctx.initiatorId → true(own goalSpace)", () => {
    expect(canManageGoalSpace({ id: OWNER, role: "initiator" }, aOwn)).toBe(true);
  });

  it("AC-3.3: initiator 但不是 ctx.initiatorId → false(other goalSpace)", () => {
    expect(canManageGoalSpace({ id: OWNER, role: "initiator" }, bOther)).toBe(false);
  });

  it("AC-3.3: chain_user 一律 false(即便是 own goalSpace 内的 chain_user)", () => {
    expect(canManageGoalSpace({ id: "u-chain", role: "chain_user" }, aOwn)).toBe(false);
  });
});
