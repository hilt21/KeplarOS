/**
 * F-003 T-010: Confirmation 权限单测
 *
 * 覆盖范围(per F-003 AC-3.8 + § 4 API 矩阵 confirmations/:id/decide 行):
 *   - initiator == ctx.goalSpaceInitiatorId → true(goalSpace 发起人唯一决策权)
 *   - initiator 跨 goalSpace → false
 *   - chain_user / viewer 一律 false
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 资源归属 + § 4 API 矩阵
 */

import { describe, expect, it } from "vitest";

import { canDecideConfirmation, type ConfirmationContext } from "@/lib/authorization";

// ─── fixtures ────────────────────────────────────────────────────────

const OWNER = "u-owner";
const OTHER_OWNER = "u-owner-other";
const CHAIN = "u-chain";
const VIEWER = "u-viewer";
const GOAL_A = "g-aaa";
const CARD_X = "c-xxx";
const CONF_X = "cf-xxx";

function confCtx(goalSpaceInitiatorId: string): ConfirmationContext {
  return {
    confirmationId: CONF_X,
    cardId: CARD_X,
    goalSpaceId: GOAL_A,
    goalSpaceInitiatorId,
    nodeBoardMemberIds: [CHAIN, VIEWER],
  };
}

const ownGoal = confCtx(OWNER);

// ─── canDecideConfirmation ───────────────────────────────────────────

describe("canDecideConfirmation", () => {
  it("AC-3.8: initiator == ctx.goalSpaceInitiatorId → true", () => {
    expect(canDecideConfirmation({ id: OWNER, role: "initiator" }, ownGoal)).toBe(true);
  });

  it("AC-3.8: initiator 但不是 ctx.goalSpaceInitiatorId → false(跨 goalSpace)", () => {
    expect(canDecideConfirmation({ id: OTHER_OWNER, role: "initiator" }, ownGoal)).toBe(false);
  });

  it("AC-3.8: chain_user(即便是 nodeBoardMember)→ false", () => {
    expect(canDecideConfirmation({ id: CHAIN, role: "chain_user" }, ownGoal)).toBe(false);
  });

  it("AC-3.8: viewer → false", () => {
    expect(canDecideConfirmation({ id: VIEWER, role: "viewer" }, ownGoal)).toBe(false);
  });
});
