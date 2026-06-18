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

import type { CardState, ConfirmationStatus, UserRole } from "@db/schema";

// ─── 1. Actor 与角色────────────────────────────────────────────

export type ActorRole = UserRole;

export interface Actor {
  readonly id: string;
  readonly role: ActorRole;
}

// ─── 2. 资源 Context(纯数据,不依赖 Drizzle 实例)────────────────────

/**
 * Goal Space 上下文
 * - goalSpaceId:           资源 ID
 * - initiatorId:           goal_spaces.initiator_id(决定 initiator 写权限)
 * - nodeBoardMemberIds:    该 goalSpace 下所有 node_board 的有效成员并集
 *                          (per ADR-001: chain_user/viewer 是成员即可读 goalSpace)
 */
export interface GoalSpaceContext {
  readonly goalSpaceId: string;
  readonly initiatorId: string;
  readonly nodeBoardMemberIds: readonly string[];
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
 * - nodeBoardMemberIds:    所属 node board 的有效成员
 *                          当前 S2 由 canDecideConfirmation 一律不读(决策权归 initiator 单点);
 *                          COR-012 决定保留该字段,作为 S4+ per-member node-board check 的
 *                          forward-looking 槽位(per spec §3 资源归属预留节点成员关系,
 *                          供未来 S4 引入"非发起人亦可表达意见 / 联署决策"功能时复用,
 *                          避免 S4 改动 ConfirmationContext 接口签名导致 audit log schema
 *                          breaking change)。
 * - confirmationStatus:    当前确认状态(per spec interface_spec.md §6.2:仅 'pending' 可决策)
 */
export interface ConfirmationContext {
  readonly confirmationId: string;
  readonly cardId: string;
  readonly goalSpaceId: string;
  readonly goalSpaceInitiatorId: string;
  readonly nodeBoardMemberIds: readonly string[];
  readonly confirmationStatus: ConfirmationStatus;
}

/**
 * Execute Card 上下文(组合 canReadCard + hasPendingConfirmation + 当前状态检查)
 * - card:                  卡片上下文
 * - hasPendingConfirmation: 该 card 下是否存在 status='pending' 的 human_confirmation
 * - currentState:          卡片当前 state(per COR-006:仅非终态的 active 状态
 *                          {backlog, todo, dev, review, blocked} 可执行;
 *                          done / cancelled 一律拒绝执行)
 */
export interface ExecuteCardContext {
  readonly card: CardContext;
  readonly hasPendingConfirmation: boolean;
  readonly currentState: CardState;
}

// ─── 3. AccessResult 类型──────────────────────────────────────

export type AccessResult = boolean;
