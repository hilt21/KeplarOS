/**
 * S2 F-003 Goal Space 权限(revised per PR #1 review)
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4
 *   - AC-3.2 canReadGoalSpace: initiator 只能读自己创建的 goalSpace;非 initiator 一律 false
 *     (S2 范围内 goalSpace 单层无成员关系 → 间接访问由 S3 handler 在调用前先 union
 *      nodeBoard canRead 结果;此处只做"单层 owner check")
 *   - AC-3.3 canManageGoalSpace: 仅 initiator == goal_spaces.initiator_id 才 true
 */

import type { Actor, GoalSpaceContext } from "./types";

/**
 * 是否可读 Goal Space。
 * - initiator: 仅 own goalSpace 可读(actor.id === ctx.initiatorId)
 * - chain_user / viewer: 需通过 node_board_members 间接获得;goalSpace 单层无成员关系 → false
 *   (S2 范围内不引入间接层;后续 S3 handler 调此函数前可先 union 多 nodeBoard canRead 结果)
 */
export function canReadGoalSpace(actor: Actor, ctx: GoalSpaceContext): boolean {
  if (actor.role === "initiator") return actor.id === ctx.initiatorId;
  return false;
}

/**
 * 是否可管理 Goal Space(PATCH / cancel / start / complete)。
 * 仅 goalSpace.initiator_id == actor.id 且 actor.role === "initiator" 才 true。
 */
export function canManageGoalSpace(actor: Actor, ctx: GoalSpaceContext): boolean {
  return actor.role === "initiator" && actor.id === ctx.initiatorId;
}
