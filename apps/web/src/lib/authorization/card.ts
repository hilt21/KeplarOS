/**
 * S2 F-003 Card 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4
 *   - AC-3.6 canReadCard: initiator 全可见;非 initiator 需为卡片 node_board 的有效成员 OR assigned_to == actor.id
 *   - AC-3.7 canMutateCard: viewer 一律 false;chain_user 限本节点/本人;initiator 全 true
 */

import type { Actor, CardContext } from "./types";

/**
 * 是否可读 Card。
 * - initiator: 所属 goalSpace 的发起人 → 全可见
 * - chain_user / viewer: 需为 nodeBoardMemberIds 一员 OR assignedTo == actor.id
 *   (viewer 读限制与 chain_user 同 — § 4 API 矩阵 GET cards/:id 允许 viewer,前提是
 *   "需卡片访问权" 通过 node_board 成员 / 分配关系间接获得)
 */
export function canReadCard(actor: Actor, ctx: CardContext): boolean {
  if (actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId) return true;
  return ctx.nodeBoardMemberIds.includes(actor.id) || ctx.assignedTo === actor.id;
}

/**
 * 是否可修改 Card(PATCH / assign / block / unblock / transition)。
 * - viewer: 一律 false
 * - initiator: 所属 goalSpace 发起人 → true
 * - chain_user: 需为 nodeBoardMemberIds 一员 OR assignedTo == actor.id
 */
export function canMutateCard(actor: Actor, ctx: CardContext): boolean {
  if (actor.role === "viewer") return false;
  if (actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId) return true;
  return ctx.nodeBoardMemberIds.includes(actor.id) || ctx.assignedTo === actor.id;
}
