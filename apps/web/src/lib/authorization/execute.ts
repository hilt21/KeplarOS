/**
 * S2 F-003 Execute Card 权限
 *
 * 真相源: docs/specs/authorization_matrix.md § 3 + § 4 + § 5
 *   - AC-3.9 canExecuteCard: viewer 一律 false;非 viewer 需可读卡(canReadCard)且
 *     hasPendingConfirmation == false 才 true(§ 5 强制门禁之 pending 拦截)
 *   - 组合: 卡片访问权 + 无 pending 确认;rejected 决策不阻塞新 confirmation 创建
 */

import type { Actor, ExecuteCardContext } from "./types";
import { canReadCard } from "./card";

/**
 * 是否可执行 Card(POST /cards/:id/execute)。
 * - viewer: 一律 false
 * - chain_user / initiator: 需 canReadCard 通过(归属)且无 pending confirmation
 */
export function canExecuteCard(actor: Actor, ctx: ExecuteCardContext): boolean {
  if (actor.role === "viewer") return false;
  if (!canReadCard(actor, ctx.card)) return false;
  if (ctx.hasPendingConfirmation) return false;
  return true;
}
