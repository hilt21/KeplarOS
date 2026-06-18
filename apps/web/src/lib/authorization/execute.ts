/**
 * S2 F-003 Execute Card 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4 + § 5
 *   - AC-3.9 canExecuteCard: viewer 一律 false;非 viewer 需可读卡(canReadCard)且
 *     hasPendingConfirmation == false 才 true(§ 5 强制门禁之 pending 拦截)
 *   - COR-006: 当前 state ∈ {backlog, todo, dev, review, blocked} 才允许执行;
 *     done / cancelled 终态一律拒绝(避免在已完成的卡上重新执行)
 *   - 组合: 卡片访问权 + 无 pending 确认 + 非终态;rejected 决策不阻塞新 confirmation 创建
 */

import type { Actor, CardState, ExecuteCardContext } from "./types";
import { canReadCard } from "./card";

/**
 * 允许执行 Card 的 state 集合(per COR-006):
 * 5 个非终态的"active"流程节点;done / cancelled 终态一律拒绝执行。
 */
export const EXECUTABLE_CARD_STATES: readonly CardState[] = [
  "backlog",
  "todo",
  "dev",
  "review",
  "blocked",
];

/**
 * 是否可执行 Card(POST /cards/:id/execute)。
 * - viewer: 一律 false
 * - chain_user / initiator: 需 canReadCard 通过(归属) + 无 pending confirmation +
 *   currentState ∈ EXECUTABLE_CARD_STATES(COR-006)
 */
export function canExecuteCard(actor: Actor, ctx: ExecuteCardContext): boolean {
  if (actor.role === "viewer") return false;
  if (!canReadCard(actor, ctx.card)) return false;
  if (ctx.hasPendingConfirmation) return false;
  if (!EXECUTABLE_CARD_STATES.includes(ctx.currentState)) return false;
  return true;
}
