/**
 * F-003 T-009: Card 权限单测
 *
 * 覆盖范围(per F-003 AC-3.6 / AC-3.7 + § 4 API 矩阵 cards 行 + AC-3.9 跨域):
 *   - canReadCard: initiator 全可见;chain_user 需 member 或 assignedTo;viewer 同 chain_user(读)
 *   - canMutateCard: viewer 一律 false;chain_user 限本节点/本人;initiator 全 true
 *   - 跨 goalSpace:另一 goalSpace 的 initiator 也只能通过 member / assignedTo 间接访问
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 资源归属 + § 4 API 矩阵
 */

import { describe, expect, it } from "vitest";

import { canMutateCard, canReadCard, type CardContext } from "@/lib/authorization";

// ─── fixtures ────────────────────────────────────────────────────────

const OWNER_A = "u-owner-a";
const OWNER_B = "u-owner-b";
const MEMBER = "u-member";
const STRANGER = "u-stranger";
const GOAL_A = "g-aaa";
const BOARD_A = "b-aaa";
const CARD_X = "c-xxx";

function cardCtx(opts: {
  goalSpaceInitiatorId: string;
  goalSpaceId?: string;
  nodeBoardMemberIds: string[];
  assignedTo: string | null;
}): CardContext {
  return {
    cardId: CARD_X,
    goalSpaceId: opts.goalSpaceId ?? GOAL_A,
    nodeBoardId: BOARD_A,
    goalSpaceInitiatorId: opts.goalSpaceInitiatorId,
    assignedTo: opts.assignedTo,
    nodeBoardMemberIds: opts.nodeBoardMemberIds,
  };
}

const cardOwned = cardCtx({
  goalSpaceInitiatorId: OWNER_A,
  nodeBoardMemberIds: [MEMBER],
  assignedTo: null,
});
const cardCross = cardCtx({
  // 资源在 GOAL_A(OWNER_A 拥有);OWNER_B 是 GOAL_B 的 initiator,非本资源发起人
  goalSpaceInitiatorId: OWNER_A,
  goalSpaceId: GOAL_A,
  nodeBoardMemberIds: [MEMBER],
  assignedTo: null,
});
const cardMemberNoAssign = cardCtx({
  goalSpaceInitiatorId: OWNER_A,
  nodeBoardMemberIds: [MEMBER],
  assignedTo: null,
});
const cardAssignedToMe = cardCtx({
  goalSpaceInitiatorId: OWNER_A,
  nodeBoardMemberIds: [],
  assignedTo: STRANGER,
});
const cardEmpty = cardCtx({
  goalSpaceInitiatorId: OWNER_A,
  nodeBoardMemberIds: [],
  assignedTo: null,
});

// ─── 1. canReadCard ──────────────────────────────────────────────────

describe("canReadCard", () => {
  it("AC-3.6: initiator(goalSpaceInitiatorId)全可见 → true", () => {
    expect(canReadCard({ id: OWNER_A, role: "initiator" }, cardOwned)).toBe(true);
  });

  it("AC-3.6: chain_user 是 nodeBoardMember → true", () => {
    expect(canReadCard({ id: MEMBER, role: "chain_user" }, cardMemberNoAssign)).toBe(true);
  });

  it("AC-3.6: chain_user 是 assignedTo(非 member)→ true", () => {
    expect(canReadCard({ id: STRANGER, role: "chain_user" }, cardAssignedToMe)).toBe(true);
  });

  it("AC-3.6: viewer 是 nodeBoardMember → true(读限与 chain_user 同)", () => {
    expect(canReadCard({ id: MEMBER, role: "viewer" }, cardMemberNoAssign)).toBe(true);
  });

  it("AC-3.6: chain_user 既非 member 也非 assignedTo → false", () => {
    expect(canReadCard({ id: STRANGER, role: "chain_user" }, cardEmpty)).toBe(false);
  });

  it("AC-3.9 跨 goalSpace:另一 goalSpace 的 initiator 在本 card → false", () => {
    expect(canReadCard({ id: OWNER_B, role: "initiator" }, cardCross)).toBe(false);
  });
});

// ─── 2. canMutateCard ────────────────────────────────────────────────

describe("canMutateCard", () => {
  it("AC-3.7: viewer 一律 false(即便是 member)", () => {
    expect(canMutateCard({ id: MEMBER, role: "viewer" }, cardMemberNoAssign)).toBe(false);
  });

  it("AC-3.7: viewer 若是 assignedTo 也 false(写不通过分配关系授权 viewer)", () => {
    expect(canMutateCard({ id: STRANGER, role: "viewer" }, cardAssignedToMe)).toBe(false);
  });

  it("AC-3.7: initiator(goalSpaceInitiatorId)全 mutate → true", () => {
    expect(canMutateCard({ id: OWNER_A, role: "initiator" }, cardOwned)).toBe(true);
  });

  it("AC-3.7: chain_user 是 nodeBoardMember → true", () => {
    expect(canMutateCard({ id: MEMBER, role: "chain_user" }, cardMemberNoAssign)).toBe(true);
  });

  it("AC-3.7: chain_user 是 assignedTo(非 member)→ true", () => {
    expect(canMutateCard({ id: STRANGER, role: "chain_user" }, cardAssignedToMe)).toBe(true);
  });

  it("AC-3.7: chain_user 既非 member 也非 assignedTo → false", () => {
    expect(canMutateCard({ id: STRANGER, role: "chain_user" }, cardEmpty)).toBe(false);
  });

  it("AC-3.9 跨 goalSpace:另一 goalSpace 的 initiator mutate 本 card → false", () => {
    expect(canMutateCard({ id: OWNER_B, role: "initiator" }, cardCross)).toBe(false);
  });
});
