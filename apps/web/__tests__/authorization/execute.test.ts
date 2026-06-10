/**
 * F-003 T-011: Execute Card 权限单测
 *
 * 覆盖范围(per F-003 AC-3.9 + § 5 强制门禁 pending confirmation):
 *   - viewer 一律 false(即便是 member)
 *   - 可访问(chain_user 是 member) + 无 pending → true
 *   - 可访问 + 有 pending → false(§ 5 强制门禁)
 *   - 不可访问(非 member) + 无 pending → false
 *   - initiator 跨 goalSpace → false
 *
 * 真相源: docs/specs/authorization_matrix.md § 5 强制门禁 + § 4 execute 行
 */

import { describe, expect, it } from "vitest";

import { canExecuteCard, type CardContext, type ExecuteCardContext } from "@/lib/authorization";

// ─── fixtures ────────────────────────────────────────────────────────

const OWNER = "u-owner";
const OTHER_OWNER = "u-owner-other";
const MEMBER = "u-member";
const VIEWER = "u-viewer";
const GOAL_A = "g-aaa";
const BOARD_A = "b-aaa";
const CARD_X = "c-xxx";

function cardCtx(opts: {
  goalSpaceInitiatorId: string;
  goalSpaceId?: string;
  nodeBoardMemberIds: string[];
  assignedTo: string | null;
  hasPendingConfirmation?: boolean;
}): CardContext {
  return {
    cardId: CARD_X,
    goalSpaceId: opts.goalSpaceId ?? GOAL_A,
    nodeBoardId: BOARD_A,
    goalSpaceInitiatorId: opts.goalSpaceInitiatorId,
    assignedTo: opts.assignedTo,
    nodeBoardMemberIds: opts.nodeBoardMemberIds,
    hasPendingConfirmation: opts.hasPendingConfirmation ?? false,
  };
}

function execCtx(card: CardContext, hasPendingConfirmation: boolean): ExecuteCardContext {
  return { card, hasPendingConfirmation };
}

const cardAccessible = cardCtx({
  goalSpaceInitiatorId: OWNER,
  nodeBoardMemberIds: [MEMBER],
  assignedTo: null,
});
const cardCross = cardCtx({
  // 资源在 GOAL_A(OWNER 拥有);OTHER_OWNER 是另一 goalSpace 的 initiator
  goalSpaceInitiatorId: OWNER,
  goalSpaceId: GOAL_A,
  nodeBoardMemberIds: [MEMBER],
  assignedTo: null,
});
const cardEmpty = cardCtx({
  goalSpaceInitiatorId: OWNER,
  nodeBoardMemberIds: [],
  assignedTo: null,
});

// ─── canExecuteCard ──────────────────────────────────────────────────

describe("canExecuteCard", () => {
  it("AC-3.9: chain_user 是 member + 无 pending → true", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false))).toBe(
      true,
    );
  });

  it("AC-3.9 + § 5: 可访问 + 有 pending confirmation → false(强制门禁)", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, true))).toBe(
      false,
    );
  });

  it("AC-3.9: viewer(即便是 member)+ 无 pending → false(写权限)", () => {
    expect(canExecuteCard({ id: VIEWER, role: "viewer" }, execCtx(cardAccessible, false))).toBe(
      false,
    );
  });

  it("AC-3.9: chain_user 非 member + 无 pending → false(无访问权)", () => {
    expect(
      canExecuteCard({ id: "u-stranger", role: "chain_user" }, execCtx(cardEmpty, false)),
    ).toBe(false);
  });

  it("AC-3.9 跨 goalSpace:另一 goalSpace 的 initiator + 无 pending → false", () => {
    expect(canExecuteCard({ id: OTHER_OWNER, role: "initiator" }, execCtx(cardCross, false))).toBe(
      false,
    );
  });
});
