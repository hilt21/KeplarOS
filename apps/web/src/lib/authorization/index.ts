/**
 * S2 F-003 权限矩阵 barrel
 *
 * 真相源: docs/specs/authorization_matrix.md
 *   - 9 can 函数 + Actor / Context 类型 + ForbiddenError + assertAccess
 *   - S3 handler 统一从 @/lib/authorization 导入;不直读子文件
 *
 * 9 can 函数(per AC-3.2..3.9 + AC-3.5 members 拆分):
 *   goal-space:    canReadGoalSpace, canManageGoalSpace
 *   node-board:    canReadNodeBoard, canManageNodeBoard, canManageNodeBoardMembers
 *   card:          canReadCard, canMutateCard
 *   confirmation:  canDecideConfirmation
 *   execute:       canExecuteCard
 */

export type { Actor, ActorRole, AccessResult } from "./types";
export type {
  GoalSpaceContext,
  NodeBoardContext,
  CardContext,
  ConfirmationContext,
  ExecuteCardContext,
} from "./types";

export { canReadGoalSpace, canManageGoalSpace } from "./goal-space";
export { canReadNodeBoard, canManageNodeBoard, canManageNodeBoardMembers } from "./node-board";
export { canReadCard, canMutateCard } from "./card";
export type { CardMutationAction } from "./card";
export { canDecideConfirmation } from "./confirmation";
export { canExecuteCard } from "./execute";
export { assertAccess, ForbiddenError } from "./assert";
