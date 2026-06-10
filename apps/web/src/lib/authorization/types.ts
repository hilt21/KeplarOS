/**
 * S2 F-003 权限矩阵类型
 *
 * 真相源:
 *   - docs/specs/authorization_matrix.md § 2 角色 / § 3 资源归属 / § 4 API 矩阵 / § 5 强制门禁
 *   - apps/web/db/schema.ts(F-001)UserRole 枚举
 *
 * 角色复用 F-001 的 UserRole(initiator / chain_user / viewer),不另开。
 * Actor 抽象 { id, role } + 各资源 Context;can 函数接 (actor, ctx) 返回 boolean。
 *
 * 跨 goal_space_id 防御:每个 can 函数只检查 actor 与 ctx 的归属关系,
 * 不另存 actor.goalSpaceId 字段;非 initiator 缺成员关系即 false(隐式跨域保护)。
 * initiator 读全可见(per AC-3.2:initiator 全可见),写仅自己 goalSpace(per AC-3.3)。
 */

import type { UserRole } from "@db/schema";

// ─── 1. Actor 与角色────────────────────────────────────────────

export type ActorRole = UserRole;

export interface Actor {
  readonly id: string;
  readonly role: ActorRole;
}

// ─── 2. 资源 Context(纯数据,不依赖 Drizzle 实例)────────────────────

/**
 * Goal Space 上下文
 * - goalSpaceId:    资源 ID
 * - initiatorId:   goal_spaces.initiator_id(决定 initiator 写权限)
 */
export interface GoalSpaceContext {
  readonly goalSpaceId: string;
  readonly initiatorId: string;
}

/**
 * Node Board 上下文
 * - nodeBoardId:           资源 ID
 * - goalSpaceId:           所属 goal space(冗余,便于跨 goalSpace 防御)
 * - goalSpaceInitiatorId:  所属 goal space 的发起人(决定 initiator 权限)
 * - memberIds:             node_board_members.user_id 列表(removed_at IS NULL)
 */
export interface NodeBoardContext {
  readonly nodeBoardId: string;
  readonly goalSpaceId: string;
  readonly goalSpaceInitiatorId: string;
  readonly memberIds: readonly string[];
}

/**
 * Card 上下文
 * - cardId:                 资源 ID
 * - goalSpaceId:            所属 goal space
 * - nodeBoardId:            所属 node board
 * - goalSpaceInitiatorId:   所属 goal space 的发起人
 * - assignedTo:             cards.assigned_to(可为 null)
 * - nodeBoardMemberIds:     所属 node board 的有效成员(冗余,便于 canReadCard / canMutateCard 单函数决策)
 * - hasPendingConfirmation: 该 card 下是否存在 status='pending' 的 human_confirmation
 *                           (per spec authorization_matrix.md §5 (unblock + complete gated))
 */
export interface CardContext {
  readonly cardId: string;
  readonly goalSpaceId: string;
  readonly nodeBoardId: string;
  readonly goalSpaceInitiatorId: string;
  readonly assignedTo: string | null;
  readonly nodeBoardMemberIds: readonly string[];
  readonly hasPendingConfirmation: boolean;
}

/**
 * Human Confirmation 上下文
 * - confirmationId:        资源 ID
 * - cardId:                所属 card
 * - goalSpaceId:           所属 goal space
 * - goalSpaceInitiatorId:  所属 goal space 的发起人
 * - nodeBoardMemberIds:    所属 node board 的有效成员(冗余)
 */
export interface ConfirmationContext {
  readonly confirmationId: string;
  readonly cardId: string;
  readonly goalSpaceId: string;
  readonly goalSpaceInitiatorId: string;
  readonly nodeBoardMemberIds: readonly string[];
}

/**
 * Execute Card 上下文(组合 canReadCard + hasPendingConfirmation 检查)
 * - card:                  卡片上下文
 * - hasPendingConfirmation: 该 card 下是否存在 status='pending' 的 human_confirmation
 */
export interface ExecuteCardContext {
  readonly card: CardContext;
  readonly hasPendingConfirmation: boolean;
}

// ─── 3. AccessResult 类型──────────────────────────────────────

export type AccessResult = boolean;
