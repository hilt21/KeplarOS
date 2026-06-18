/**
 * F-003 T-011: Execute Card 权限单测
 *
 * 覆盖范围(per F-003 AC-3.9 + § 5 强制门禁 pending confirmation + COR-006 state gate):
 *   - viewer 一律 false(即便是 member)
 *   - 可访问(chain_user 是 member) + 无 pending → true
 *   - 可访问 + 有 pending → false(§ 5 强制门禁)
 *   - 不可访问(非 member) + 无 pending → false
 *   - initiator 跨 goalSpace → false
 *   - COR-006: currentState ∈ {backlog, todo, dev, review, blocked} → 允许执行;
 *     done / cancelled 终态一律拒绝
 *
 * 真相源: docs/specs/authorization_matrix.md § 5 强制门禁 + § 4 execute 行
 */

import { describe, expect, it } from "vitest";

import {
  EXECUTABLE_CARD_STATES,
  canExecuteCard,
  type CardContext,
  type CardState,
  type ExecuteCardContext,
} from "@/lib/authorization";

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

function execCtx(
  card: CardContext,
  hasPendingConfirmation: boolean,
  currentState: CardState = "todo",
): ExecuteCardContext {
  return { card, hasPendingConfirmation, currentState };
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

  // ── COR-006: currentState gate ───────────────────────────────────
  it("COR-006: chain_user + currentState=todo + 可访问 → true", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "todo"))).toBe(true);
  });

  it("COR-006: chain_user + currentState=backlog + 可访问 → true", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "backlog"))).toBe(true);
  });

  it("COR-006: chain_user + currentState=dev + 可访问 → true", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "dev"))).toBe(true);
  });

  it("COR-006: chain_user + currentState=review + 可访问 → true", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "review"))).toBe(true);
  });

  it("COR-006: chain_user + currentState=blocked + 可访问 → true", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "blocked"))).toBe(true);
  });

  it("COR-006: chain_user + currentState=done + 可访问 → false(终态拒绝)", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "done"))).toBe(false);
  });

  it("COR-006: chain_user + currentState=cancelled + 可访问 → false(终态拒绝)", () => {
    expect(canExecuteCard({ id: MEMBER, role: "chain_user" }, execCtx(cardAccessible, false, "cancelled"))).toBe(false);
  });

  it("COR-006: initiator(本 goalSpace 发起人)+ currentState=done → false(终态拒绝,即便 initiator)", () => {
    expect(canExecuteCard({ id: OWNER, role: "initiator" }, execCtx(cardAccessible, false, "done"))).toBe(false);
  });

  it("COR-006: EXECUTABLE_CARD_STATES 暴露 5 个非终态(backlog/todo/dev/review/blocked)", () => {
    expect([...EXECUTABLE_CARD_STATES]).toEqual([
      "backlog",
      "todo",
      "dev",
      "review",
      "blocked",
    ]);
  });
});
