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
 *
 * COR-012 — nodeBoardMemberIds currently unused:
 *   ConfirmationContext.nodeBoardMemberIds 当前**不**被本函数引用(S2 决策权严格
 *   收敛到 initiator 单点;per spec §3 资源归属)。该字段保留在 ctx 是有意为之,
 *   作为 S4+ "per-member node-board co-sign / approval thread" 功能的预留槽位;
 *   见 `types.ts` ConfirmationContext JSDoc。未来 S4 引入成员联署决策时,
 *   本函数签名不变,只需在内部增加 `nodeBoardMemberIds.includes(actor.id)` 分支。
 */
export function canDecideConfirmation(actor: Actor, ctx: ConfirmationContext): boolean {
  if (ctx.confirmationStatus !== "pending") return false;
  return actor.role === "initiator" && actor.id === ctx.goalSpaceInitiatorId;
}
