/**
 * F-003 T-007: Goal Space 权限单测
 *
 * 覆盖范围(per F-003 AC-3.2 / AC-3.3 + § 4 API 矩阵 goalSpaces 行):
 *   - initiator 仅 own goalSpace 可读(canReadGoalSpace own=true / cross-owner=false)
 *   - initiator 写仅 own goalSpace(canManageGoalSpace own=true / other=false)
 *   - chain_user / viewer 一律 false(读 / 写)
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 资源归属 + § 4 API 矩阵
 * 修订: PR #1 review P1 #1 — cross-owner 读取从 true 改为 false。
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
  return { goalSpaceId, initiatorId };
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
