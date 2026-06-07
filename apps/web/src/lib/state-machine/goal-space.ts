/**
 * Goal Space 状态机 (S2 F-002)
 *
 * 4 态(draft / active / completed / cancelled)+ 4 跨态转移:
 *   - draft → active
 *   - active → completed(需 hasPendingConfirmation=false AND hasBlockedCard=false AND allCardsDoneOrCancelled=true)
 *   - active → cancelled(需 cancelReason 非空)
 *   - draft → cancelled(需 cancelReason 非空)
 *
 * 终态: completed / cancelled(无进一步流转)。
 *
 * 真相源:
 *   - docs/specs/phase1_scope.md § 5 (S2 = 领域核心,不含 UI / API)
 *   - docs/specs/database_design.md § 3.1 (goal_spaces.status 4 值)
 *   - docs/architecture/state_transition.md(术语一致)
 *
 * 不依赖 Drizzle 实例,纯函数;S3 handler 在事务内调用,
 * `opts` 由 F-004 审计事务 wrapper 在事务内 select 填充后传入。
 */

import { GOAL_SPACE_STATUS_VALUES, type GoalSpaceStatus } from "@db/schema";

// Re-export schema 常量
export { GOAL_SPACE_STATUS_VALUES };
export type { GoalSpaceStatus };

// ─── 1. Goal Space 转移规则(4 跨态)─────────────────────────────

export interface GoalSpaceTransitionRule {
  readonly from: GoalSpaceStatus;
  readonly to: GoalSpaceStatus;
}

export const GOAL_SPACE_TRANSITIONS: readonly GoalSpaceTransitionRule[] = [
  { from: "draft", to: "active" },
  { from: "active", to: "completed" },
  { from: "active", to: "cancelled" },
  { from: "draft", to: "cancelled" },
];

// ─── 2. complete 前置 + cancel reason 参数────────────────────────

/**
 * active → completed 的前置条件,F-004 事务内 select 填充。
 * 字段语义:
 *   - hasPendingConfirmation: 是否有任何 card 存在 status='pending' 的 human_confirmation
 *     (true = 阻塞,完成时必须为 false)
 *   - hasBlockedCard: 该 goal_space 下是否有任何 card.state='blocked'
 *     (true = 阻塞,完成时必须为 false)
 *   - allCardsDoneOrCancelled: 该 goal_space 下所有 non-deleted card 是否都已 done / cancelled
 *     (false = 还有非终态,完成时必须为 true)
 */
export interface GoalSpaceCompleteOpts {
  readonly hasPendingConfirmation: boolean;
  readonly hasBlockedCard: boolean;
  readonly allCardsDoneOrCancelled: boolean;
}

/**
 * *→cancelled 的强制参数,任何非终态 → cancelled 必须传非空 cancelReason。
 */
export interface GoalSpaceCancelOpts {
  readonly cancelReason: string;
}

export type GoalSpaceAssertOpts = GoalSpaceCompleteOpts | GoalSpaceCancelOpts;

// ─── 3. 终态与查询辅助───────────────────────────────────────────

export function isValidGoalSpaceState(state: string): state is GoalSpaceStatus {
  return (GOAL_SPACE_STATUS_VALUES as readonly string[]).includes(state);
}

export function isGoalSpaceTerminal(state: GoalSpaceStatus): boolean {
  return state === "completed" || state === "cancelled";
}

function findGoalSpaceRule(
  from: GoalSpaceStatus,
  to: GoalSpaceStatus,
): GoalSpaceTransitionRule | undefined {
  return GOAL_SPACE_TRANSITIONS.find((r) => r.from === from && r.to === to);
}

// ─── 4. 公开 API(per F-002 AC-2.2)──────────────────────────────

/**
 * 是否允许从 `from` 转移到 `to`。
 * - 起始态为终态(completed / cancelled)→ 永远 false
 * - 找不到 (from, to) 规则 → false
 * - 否则 true(complete / cancel 前置由 assertGoalSpaceTransition 单独校验)
 */
export function canGoalSpaceTransition(from: GoalSpaceStatus, to: GoalSpaceStatus): boolean {
  if (isGoalSpaceTerminal(from)) return false;
  return findGoalSpaceRule(from, to) !== undefined;
}

/**
 * 强校验 + 返回缺哪条前置的列表(per F-002 AC-2.6):
 *   - 非法 from/to 枚举值 → throw
 *   - 起始态为终态 → throw
 *   - 找不到 (from, to) 规则 → throw
 *   - active → completed:返回 string[] 缺失前置 keys
 *     · hasPendingConfirmation=true → ['hasPendingConfirmation']
 *     · hasBlockedCard=true → ['hasBlockedCard']
 *     · allCardsDoneOrCancelled=false → ['allCardsDoneOrCancelled']
 *     · 全缺 → 三条都在
 *     · 全满足 → []
 *   - 任意非终态 → cancelled:opts.cancelReason 必须非空 trim,否则 throw
 *   - 其他合法转移(draft → active)→ 返回 []
 *
 * 设计:返回 string[] 而非 throw,便于 F-004 事务包装器把"缺哪条前置"
 * 写进 audit_entries.details,而不只是抛错。S3 handler 拿到非空数组
 * 时再决定如何向客户端呈现(409 Conflict + missing[] body)。
 */
export function assertGoalSpaceTransition(
  from: GoalSpaceStatus,
  to: GoalSpaceStatus,
  opts?: GoalSpaceAssertOpts,
): string[] {
  if (!isValidGoalSpaceState(from)) {
    throw new Error(`Invalid goal space from state: ${from}`);
  }
  if (!isValidGoalSpaceState(to)) {
    throw new Error(`Invalid goal space to state: ${to}`);
  }
  if (isGoalSpaceTerminal(from)) {
    throw new Error(`Cannot transition from terminal goal space state: ${from}`);
  }
  if (!canGoalSpaceTransition(from, to)) {
    throw new Error(`Illegal goal space state transition: ${from} -> ${to}`);
  }

  // active → completed:返回缺失前置 keys
  if (from === "active" && to === "completed") {
    if (!opts || !isCompleteOpts(opts)) {
      throw new Error(
        "assertGoalSpaceTransition(active, completed) requires opts with " +
          "{ hasPendingConfirmation, hasBlockedCard, allCardsDoneOrCancelled }",
      );
    }
    const missing: string[] = [];
    if (opts.hasPendingConfirmation) missing.push("hasPendingConfirmation");
    if (opts.hasBlockedCard) missing.push("hasBlockedCard");
    if (!opts.allCardsDoneOrCancelled) missing.push("allCardsDoneOrCancelled");
    return missing;
  }

  // 任意非终态 → cancelled:校验 cancelReason 非空
  if (to === "cancelled") {
    if (!opts || !isCancelOpts(opts) || opts.cancelReason.trim().length === 0) {
      throw new Error("assertGoalSpaceTransition(*, cancelled) requires non-empty cancelReason");
    }
  }

  return [];
}

// ─── 5. opts 类型守卫(运行时区分 Complete vs Cancel)───────────────

function isCompleteOpts(o: GoalSpaceAssertOpts): o is GoalSpaceCompleteOpts {
  return (
    typeof (o as GoalSpaceCompleteOpts).hasPendingConfirmation === "boolean" &&
    typeof (o as GoalSpaceCompleteOpts).hasBlockedCard === "boolean" &&
    typeof (o as GoalSpaceCompleteOpts).allCardsDoneOrCancelled === "boolean"
  );
}

function isCancelOpts(o: GoalSpaceAssertOpts): o is GoalSpaceCancelOpts {
  return typeof (o as GoalSpaceCancelOpts).cancelReason === "string";
}
