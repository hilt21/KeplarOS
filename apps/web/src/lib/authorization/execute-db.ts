/**
 * F-003 SEC-009: DB-aware convenience for canExecuteCard
 *
 * 真相源:
 *   - docs/specs/authorization_matrix.md § 5 (强制门禁 pending confirmation)
 *   - docs/review/2026-06-08-full-repo-review/REVIEW.md SEC-009
 *
 * 目的:消除 "caller must precompute hasPendingConfirmation" 的脆弱性。
 * 对于最常见的 "按 cardId 决策是否可执行" 路径,直接调用本函数即可,
 * pending confirmation 检查由本函数集中处理,避免 S3 handler 各自重复 +
 * 漏检查。纯 canExecuteCard 仍然可用,供已自行组装 ctx 的高级调用方。
 *
 * 设计原则:本函数只负责"查 DB + 组装 ctx",决策逻辑完全委托给纯 canExecuteCard。
 * 同步函数 vs async:本函数读取多张表,用 async + Promise<boolean> 暴露。
 */

import { and, eq, isNull } from "drizzle-orm";
import type { DrizzleDb } from "@/lib/db/client";
import { cards, goalSpaces, humanConfirmations, nodeBoardMembers, nodeBoards } from "@db/schema";
import { canExecuteCard } from "./execute";
import type { Actor, CardContext, ExecuteCardContext } from "./types";

/**
 * 按 cardId 决策 actor 是否可执行该 card。
 *
 * 流程:
 *   1. 读 cards + 关联 goalSpaces(取 initiatorId)+ 关联 nodeBoards(校验)
 *   2. 查 node_board_members 取该 card 所属 node board 的有效成员并集
 *   3. 查 human_confirmations 中是否存在 status='pending' 的确认
 *   4. 组装 CardContext + hasPendingConfirmation,委托 canExecuteCard
 *
 * 返回 false 的场景:
 *   - card 不存在
 *   - 关联的 goalSpace 不存在(数据损坏)
 *   - 存在 pending confirmation(§ 5 强制门禁)
 *   - canReadCard 不通过(actor 无卡片访问权)
 *   - actor 是 viewer(canExecuteCard 一律 false)
 */
export async function canExecuteCardForCardId(
  db: DrizzleDb,
  actor: Actor,
  cardId: string,
): Promise<boolean> {
  // 1. Load card + goal space initiator (left join safety: card.id is unique PK so we expect 1 row)
  const rows = await db
    .select({
      cardId: cards.id,
      goalSpaceId: cards.goalSpaceId,
      nodeBoardId: cards.nodeBoardId,
      assignedTo: cards.assignedTo,
      goalSpaceInitiatorId: goalSpaces.initiatorId,
    })
    .from(cards)
    .innerJoin(goalSpaces, eq(cards.goalSpaceId, goalSpaces.id))
    .where(eq(cards.id, cardId))
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  // 2. Effective members of the card's node board (removed_at IS NULL)
  const members = await db
    .select({ userId: nodeBoardMembers.userId })
    .from(nodeBoardMembers)
    .innerJoin(nodeBoards, eq(nodeBoards.id, nodeBoardMembers.boardId))
    .where(and(eq(nodeBoards.id, row.nodeBoardId), isNull(nodeBoardMembers.removedAt)));

  // De-dupe via Set (in practice one user has at most one active row, but the schema permits
  // many node boards per goal space — keep it generic).
  const memberIds = Array.from(new Set(members.map((m) => m.userId)));

  // 3. Pending confirmation?
  const pending = await db
    .select({ id: humanConfirmations.id })
    .from(humanConfirmations)
    .where(and(eq(humanConfirmations.cardId, cardId), eq(humanConfirmations.status, "pending")))
    .limit(1);
  const hasPendingConfirmation = pending.length > 0;

  // 4. Delegate
  const cardCtx: CardContext = {
    cardId: row.cardId,
    goalSpaceId: row.goalSpaceId,
    nodeBoardId: row.nodeBoardId,
    goalSpaceInitiatorId: row.goalSpaceInitiatorId,
    assignedTo: row.assignedTo,
    nodeBoardMemberIds: memberIds,
    hasPendingConfirmation,
  };
  const execCtx: ExecuteCardContext = { card: cardCtx, hasPendingConfirmation };

  return canExecuteCard(actor, execCtx);
}
