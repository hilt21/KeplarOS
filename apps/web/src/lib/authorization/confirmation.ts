/**
 * S2 F-003 Human Confirmation 权限
 *
 * 真相源:
 *   - docs/specs/authorization_matrix.md § 3 + § 4
 *     AC-3.8: 仅 initiator == goal_spaces.initiator_id 才 true
 *     (per § 3 资源归属:"只有目标空间发起人可做最终确认决策")
 *   - docs/specs/interface_spec.md §6.2 (处理确认)
 *     仅 status='pending' 的 confirmation 可被决策;approved / rejected / timed_out 一律 false
 *     (注:DB-013 (Task 2.7) 将 schema 的 'timed_out' 改为 spec 的 'cancelled')
 */

import type { Actor, ConfirmationContext } from "./types";

/**
 * 是否可决定 Human Confirmation(POST /confirmations/:id/decide)。
 * 仅所属 goalSpace 的发起人;chain_user / viewer 一律 false。
 * §6.2: 仅 status='pending' 可决策(避免对已 approved/rejected/cancelled 的 confirmation 重复决策)。
 */
export function canDecideConfirmation(actor: Actor, ctx: ConfirmationContext): boolean {
  if (ctx.confirmationStatus !== "pending") return false;
  return actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId;
}
