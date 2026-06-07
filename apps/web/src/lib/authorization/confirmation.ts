/**
 * S2 F-003 Human Confirmation 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4
 *   - AC-3.8 canDecideConfirmation: 仅 initiator == goal_spaces.initiator_id 才 true
 *     (per § 3 资源归属:"只有目标空间发起人可做最终确认决策")
 */

import type { Actor, ConfirmationContext } from "./types";

/**
 * 是否可决定 Human Confirmation(POST /confirmations/:id/decide)。
 * 仅所属 goalSpace 的发起人;chain_user / viewer 一律 false。
 */
export function canDecideConfirmation(actor: Actor, ctx: ConfirmationContext): boolean {
  return actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId;
}
