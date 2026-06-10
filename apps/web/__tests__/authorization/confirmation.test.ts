/**
 * F-003 T-010: Confirmation 权限单测
 *
 * 覆盖范围(per F-003 AC-3.8 + § 4 API 矩阵 confirmations/:id/decide 行):
 *   - initiator == ctx.goalSpaceInitiatorId → true(goalSpace 发起人唯一决策权)
 *   - initiator 跨 goalSpace → false
 *   - chain_user / viewer 一律 false
 *   - spec §6.2: 仅 status='pending' 的 confirmation 可决策(approved/rejected/timed_out 一律 false)
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 资源归属 + § 4 API 矩阵
 *        + docs/specs/interface_spec.md §6.2 (处理确认)
 *
 * NOTE(cancelled 漂移): spec §6.2 列出 "approved / rejected / cancelled";DB schema 当前
 * 使用 "timed_out"。DB-013 (Task 2.7) 将统一 schema。本单测用 schema 现状值覆盖拒绝路径,
 * 并附 pending → true 案例,语义与 spec 完全一致。
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

function confCtx(
  goalSpaceInitiatorId: string,
  confirmationStatus: ConfirmationContext["confirmationStatus"] = "pending",
): ConfirmationContext {
  return {
    confirmationId: CONF_X,
    cardId: CARD_X,
    goalSpaceId: GOAL_A,
    goalSpaceInitiatorId,
    nodeBoardMemberIds: [CHAIN, VIEWER],
    confirmationStatus,
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

// ─── canDecideConfirmation — status gate (spec §6.2) ─────────────────

describe("canDecideConfirmation — status gate (spec §6.2)", () => {
  it("denies decide when confirmation is approved", () => {
    const ctx = confCtx(OWNER, "approved");
    expect(canDecideConfirmation({ id: OWNER, role: "initiator" }, ctx)).toBe(false);
  });

  it("denies decide when confirmation is rejected", () => {
    const ctx = confCtx(OWNER, "rejected");
    expect(canDecideConfirmation({ id: OWNER, role: "initiator" }, ctx)).toBe(false);
  });

  it("denies decide when confirmation is timed_out (DB-013 → 'cancelled')", () => {
    const ctx = confCtx(OWNER, "timed_out");
    expect(canDecideConfirmation({ id: OWNER, role: "initiator" }, ctx)).toBe(false);
  });

  it("allows decide when confirmation is pending AND actor is goalSpace initiator", () => {
    const ctx = confCtx(OWNER, "pending");
    expect(canDecideConfirmation({ id: OWNER, role: "initiator" }, ctx)).toBe(true);
  });

  it("denies decide when confirmation is pending but actor is NOT the goalSpace initiator", () => {
    const ctx = confCtx(OWNER, "pending");
    expect(canDecideConfirmation({ id: OTHER_OWNER, role: "initiator" }, ctx)).toBe(false);
  });
});
