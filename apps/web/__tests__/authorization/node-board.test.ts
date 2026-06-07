/**
 * F-003 T-008: Node Board 权限单测
 *
 * 覆盖范围(per F-003 AC-3.4 / AC-3.5 + § 4 API 矩阵 nodeBoards 行):
 *   - canReadNodeBoard: initiator 全可见(own + cross);非 initiator 需 member
 *   - canManageNodeBoard: 仅 initiator(own goalSpace)
 *   - canManageNodeBoardMembers: 同 manage — 仅 initiator
 *   - 跨 goalSpace 防御:另一 goalSpace 的 initiator 不能 manage 本资源
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 资源归属 + § 4 API 矩阵
 */

import { describe, expect, it } from "vitest";

import {
  canManageNodeBoard,
  canManageNodeBoardMembers,
  canReadNodeBoard,
  type NodeBoardContext,
} from "@/lib/authorization";

// ─── fixtures ────────────────────────────────────────────────────────

const OWNER_A = "u-owner-a";
const OWNER_B = "u-owner-b";
const MEMBER = "u-member";
const STRANGER = "u-stranger";
const GOAL_A = "g-aaa";
const BOARD_A = "b-aaa";

function boardCtx(goalSpaceInitiatorId: string, memberIds: string[]): NodeBoardContext {
  return {
    nodeBoardId: BOARD_A,
    goalSpaceId: GOAL_A,
    goalSpaceInitiatorId,
    memberIds,
  };
}

const aBoard = boardCtx(OWNER_A, [MEMBER]);
const aBoardAlone = boardCtx(OWNER_A, []);
// 跨 goalSpace 防御:resource 仍属 GOAL_A(OWNER_A 拥有);actor OWNER_B 是另一 goalSpace 的 initiator
const aBoardOtherOwner = boardCtx(OWNER_A, []);

// ─── 1. canReadNodeBoard ─────────────────────────────────────────────

describe("canReadNodeBoard", () => {
  it("AC-3.4: initiator(goalSpaceInitiatorId)全可见 → true", () => {
    expect(canReadNodeBoard({ id: OWNER_A, role: "initiator" }, aBoardAlone)).toBe(true);
  });

  it("AC-3.4: chain_user 是 member → true", () => {
    expect(canReadNodeBoard({ id: MEMBER, role: "chain_user" }, aBoard)).toBe(true);
  });

  it("AC-3.4: viewer 是 member → true(per AC-3.6 注释:viewer 读限与 chain_user 同)", () => {
    expect(canReadNodeBoard({ id: MEMBER, role: "viewer" }, aBoard)).toBe(true);
  });

  it("AC-3.4: chain_user 非 member → false", () => {
    expect(canReadNodeBoard({ id: STRANGER, role: "chain_user" }, aBoard)).toBe(false);
  });

  it("AC-3.4 跨 goalSpace:另一 goalSpace 的 initiator 在本 board → false", () => {
    // OWNER_B 的 role=initiator,但 ctx.goalSpaceInitiatorId=OWNER_A → 不匹配
    expect(canReadNodeBoard({ id: OWNER_B, role: "initiator" }, aBoardOtherOwner)).toBe(false);
  });
});

// ─── 2. canManageNodeBoard / canManageNodeBoardMembers ───────────────

describe("canManageNodeBoard & canManageNodeBoardMembers", () => {
  it("AC-3.5: initiator == goalSpaceInitiatorId → manage & members 都 true", () => {
    expect(canManageNodeBoard({ id: OWNER_A, role: "initiator" }, aBoard)).toBe(true);
    expect(canManageNodeBoardMembers({ id: OWNER_A, role: "initiator" }, aBoard)).toBe(true);
  });

  it("AC-3.5: chain_user(member)不能 manage → false", () => {
    expect(canManageNodeBoard({ id: MEMBER, role: "chain_user" }, aBoard)).toBe(false);
    expect(canManageNodeBoardMembers({ id: MEMBER, role: "chain_user" }, aBoard)).toBe(false);
  });

  it("AC-3.5 跨 goalSpace:另一 goalSpace 的 initiator → false(无 manage 权)", () => {
    expect(canManageNodeBoard({ id: OWNER_B, role: "initiator" }, aBoardOtherOwner)).toBe(false);
    expect(canManageNodeBoardMembers({ id: OWNER_B, role: "initiator" }, aBoardOtherOwner)).toBe(
      false,
    );
  });
});
