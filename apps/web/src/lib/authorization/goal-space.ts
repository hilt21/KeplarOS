/**
 * S2 F-003 Goal Space 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4
 *   - AC-3.2 canReadGoalSpace: initiator 全可见;非 initiator 需通过 node_board_members 获得访问权
 *     (S2 范围内 goalSpace 单层不需成员关系 → 非 initiator 一律 false)
 *   - AC-3.3 canManageGoalSpace: 仅 initiator == goal_spaces.initiator_id 才 true
 */

import type { Actor, GoalSpaceContext } from "./types";

/**
 * 是否可读 Goal Space。
 * - initiator: 全可见(包括他人的 goalSpace)
 * - chain_user / viewer: 需通过 node_board_members 间接获得;goalSpace 单层无成员关系 → false
 *   (S2 范围内不引入间接层;后续 S3 handler 调此函数前可先 union 多 nodeBoard canRead 结果)
 *   ctx 暂未引用,以 `_` 前缀标注避免 lint 警告;间接层落地后此处读 ctx。
 */
export function canReadGoalSpace(actor: Actor, _ctx: GoalSpaceContext): boolean {
  if (actor.role === "initiator") return true;
  return false;
}

/**
 * 是否可管理 Goal Space(PATCH / cancel / start / complete)。
 * 仅 goalSpace.initiator_id == actor.id 且 actor.role === "initiator" 才 true。
 */
export function canManageGoalSpace(actor: Actor, ctx: GoalSpaceContext): boolean {
  return actor.role === "initiator" && actor.id === ctx.initiatorId;
}
