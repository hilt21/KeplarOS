/**
 * S2 F-003 Card 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4 + § 5
 *   - AC-3.6 canReadCard: initiator 全可见;非 initiator 需为卡片 node_board 的有效成员 OR assigned_to == actor.id
 *   - AC-3.7 canMutateCard: viewer 一律 false;chain_user 限本节点/本人;initiator 全 true
 *   - § 5 强制门禁:unblock / complete 在 hasPendingConfirmation=true 时必须 false
 */

import type { Actor, CardContext } from "./types";

/**
 * 是否可读 Card。
 * - initiator: 所属 goalSpace 的发起人 → 全可见
 * - chain_user / viewer: 需为 nodeBoardMemberIds 一员 OR assignedTo == actor.id
 *   (viewer 读限制与 chain_user 同 — § 4 API 矩阵 GET cards/:id 允许 viewer,前提是
 *   "需卡片访问权" 通过 node_board 成员 / 分配关系间接获得)
 *
 * COR-009 pinned behavior (spec §4 / authorization_matrix.md §3):
 *   - viewer 经 `assignedTo === actor.id` 路径读 card 是 SPEC-ALLOWED 的(读权限
 *     间接通过分配关系获得;per § 4 API 矩阵 GET cards/:id)。
 *   - 写路径(canMutateCard)对 viewer 一律 false — 即便 viewer 是 assignedTo 也
 *     不能 mutate,这条不变式由 canMutateCard 第一行 `if role === viewer` 守护。
 *   - 测试见 `__tests__/authorization/card.test.ts` "COR-009 viewer read pin" 块。
 *
 * spec ambiguous point: 是否允许 viewer 通过 node-board 成员路径(非 assignedTo)读 card
 * 已在 COR-009 期间确认 — 与 chain_user 同,因此本函数两条路径同权处理。
 */
export function canReadCard(actor: Actor, ctx: CardContext): boolean {
  if (actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId) return true;
  return ctx.nodeBoardMemberIds.includes(actor.id) || ctx.assignedTo === actor.id;
}

/**
 * 卡片可执行的变更动作。
 * - update:   PATCH / assign / block / transition(一般变更)
 * - unblock:  POST /api/v1/cards/:id/unblock(§ 5 门禁)
 * - complete: POST /api/v1/goal-spaces/:id/complete(§ 5 门禁)
 */
export type CardMutationAction = "update" | "unblock" | "complete";

/**
 * 是否可修改 Card。
 * - viewer: 一律 false
 * - initiator: 所属 goalSpace 发起人 → true(§ 5 门禁仍适用 — pending confirmation 优先阻断)
 * - chain_user: 需为 nodeBoardMemberIds 一员 OR assignedTo == actor.id
 *
 * § 5 强制门禁(per spec authorization_matrix.md):
 *   当 ctx.hasPendingConfirmation=true 时,unblock / complete 动作一律 false。
 *   update 不在 § 5 列表,不受此门禁影响。
 */
export function canMutateCard(
  actor: Actor,
  action: CardMutationAction,
  ctx: CardContext,
): boolean {
  if (actor.role === "viewer") return false;

  // § 5 mandatory gate: pending confirmation blocks unblock and complete
  if (ctx.hasPendingConfirmation && (action === "unblock" || action === "complete")) {
    return false;
  }

  if (actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId) return true;
  return ctx.nodeBoardMemberIds.includes(actor.id) || ctx.assignedTo === actor.id;
}
