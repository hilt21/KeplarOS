/**
 * 状态机共享异常类型(per TS-009)
 *
 * 抽离 IllegalTransitionError 到独立模块,使 card 状态机与 goal-space 状态机
 * 共享同一个 `STATE_CONFLICT` 错误契约。S3 handler 可用 `instanceof` 区分业务
 * 错误与其他异常,与 API 错误码契约一致(per F-002 AC-2.7 / AC-2.2)。
 *
 * 形态差异:
 *   - card 转移携带 (from, to, trigger) 三元组 → `trigger` 非空
 *   - goal-space 转移仅 (from, to) + 缺前置数组 → `trigger` 为 undefined,
 *     `missingPreconditions` 携带缺哪条前置的 keys(便于 S3 handler 把缺失项
 *     写进 audit_entries.details)
 */

import type { CardState } from "@db/schema";
import type { GoalSpaceStatus } from "@db/schema";

/**
 * 通用状态机非法转移异常。
 *
 * - `code: 'STATE_CONFLICT'` — 与 S3 API 错误码契约一致
 * - `from` / `to` — 起始态 / 目标态(由 string 字段保持通用,caller 用类型守卫约束)
 * - `trigger` — Card 状态机的 11 值 trigger 字面量;goal-space 转移无 trigger,传 undefined
 * - `missingPreconditions` — goal-space 完成前置 keys(hasPendingConfirmation / hasBlockedCard /
 *   allCardsDoneOrCancelled)或 cancel 缺 reason;card 转移通常为空数组
 */
export class IllegalTransitionError extends Error {
  readonly code = "STATE_CONFLICT" as const;
  readonly from: string;
  readonly to: string;
  readonly trigger: string | undefined;
  readonly missingPreconditions: readonly string[];

  constructor(
    from: string,
    to: string,
    trigger: string | undefined,
    missingPreconditions: readonly string[] = [],
    message?: string,
  ) {
    super(
      message ??
        `Illegal state transition: ${from} -> ${to}${
          trigger !== undefined ? ` (trigger=${trigger})` : ""
        }${missingPreconditions.length > 0 ? ` (missing=${missingPreconditions.join(",")})` : ""}`,
    );
    this.name = "IllegalTransitionError";
    this.from = from;
    this.to = to;
    this.trigger = trigger;
    this.missingPreconditions = missingPreconditions;
  }
}

// ─── 类型守卫(便于 caller 在 instanceof 后 narrowing)────────────────

/**
 * Narrowing 守卫:把 `IllegalTransitionError.from / to` 收敛到 CardState。
 * 已知是 card 转移抛出的异常可调用,其他 case 返回 false。
 */
export function isCardIllegalTransition(
  err: IllegalTransitionError,
): err is IllegalTransitionError & { readonly from: CardState; readonly to: CardState } {
  // 简单判定:trigger 是 11 个 TransitionTrigger 之一 + from/to 在 7 个 CardState 中。
  // 在 errors 模块内不直接 import 字面量集合(避免循环依赖),由 caller 在外部 narrowing
  return err.trigger !== undefined;
}

/**
 * Narrowing 守卫:把 `IllegalTransitionError.from / to` 收敛到 GoalSpaceStatus。
 * 已知是 goal-space 转移抛出的异常可调用。
 */
export function isGoalSpaceIllegalTransition(
  err: IllegalTransitionError,
): err is IllegalTransitionError & {
  readonly from: GoalSpaceStatus;
  readonly to: GoalSpaceStatus;
} {
  return err.trigger === undefined;
}