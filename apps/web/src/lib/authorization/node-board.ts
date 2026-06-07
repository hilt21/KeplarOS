/**
 * S2 F-003 Node Board 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4
 *   - AC-3.4 canReadNodeBoard: initiator 全可见;非 initiator 需为有效成员
 *   - AC-3.5 canManageNodeBoard / canManageNodeBoardMembers: 仅 initiator
 */

import type { Actor, NodeBoardContext } from "./types";

/**
 * 是否可读 Node Board。
 * - initiator: 所属 goalSpace 的发起人 → 全可见
 * - 非 initiator: 需在 memberIds(removed_at IS NULL) 中
 */
export function canReadNodeBoard(actor: Actor, ctx: NodeBoardContext): boolean {
  if (actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId) return true;
  return ctx.memberIds.includes(actor.id);
}

/**
 * 是否可管理 Node Board(PATCH / DELETE)。
 * 仅所属 goalSpace 的发起人。
 */
export function canManageNodeBoard(actor: Actor, ctx: NodeBoardContext): boolean {
  return actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId;
}

/**
 * 是否可管理 Node Board 成员(POST /members, DELETE /members/:userId)。
 * 同 manage:仅所属 goalSpace 的发起人,且需写审计(per § 4 资源约束)。
 */
export function canManageNodeBoardMembers(actor: Actor, ctx: NodeBoardContext): boolean {
  return canManageNodeBoard(actor, ctx);
}
