/**
 * S2 F-003 Goal Space 权限(revised per PR #1 review + ADR-001)
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4
 *   - AC-3.2 canReadGoalSpace(revised per ADR-001):
 *       initiator 仅 own goalSpace 可读;chain_user / viewer 若为该 goalSpace 内
 *       任一 node_board 成员同样可读(nodeBoardMemberIds 命中 actor.id)。
 *       真相源: docs/superpowers/decisions/2026-06-10-001-can-read-goal-space.md
 *   - AC-3.3 canManageGoalSpace: 仅 initiator == goal_spaces.initiator_id 才 true
 */

import type { Actor, GoalSpaceContext } from "./types";

/**
 * 是否可读 Goal Space。
 * - initiator: 仅 own goalSpace 可读(actor.id === ctx.initiatorId)
 * - chain_user / viewer: 需为该 goalSpace 内任一 node_board 的成员
 *   (actor.id ∈ ctx.nodeBoardMemberIds)。S2 的"non-initiator 一律 false"边界
 *   已按 ADR-001 撤销。
 */
export function canReadGoalSpace(actor: Actor, ctx: GoalSpaceContext): boolean {
  if (actor.role === "initiator") return actor.id === ctx.initiatorId;
  // per ADR-001: chain_user / viewer 是 node-board 成员即可读
  return ctx.nodeBoardMemberIds.includes(actor.id);
}

/**
 * 是否可管理 Goal Space(PATCH / cancel / start / complete)。
 * 仅 goalSpace.initiator_id == actor.id 且 actor.role === "initiator" 才 true。
 */
export function canManageGoalSpace(actor: Actor, ctx: GoalSpaceContext): boolean {
  return actor.role === "initiator" && actor.id === ctx.initiatorId;
}
