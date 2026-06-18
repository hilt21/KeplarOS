/**
 * Card 状态机 (S2 F-002)
 *
 * 7 态 + 13 跨态转移(per state_transition.md § 4)+ 4 自环(per § 2 mermaid)
 * + 11 TransitionTriggers(per § 6)+ 终态拒绝(Done / Cancelled)。
 *
 * CARD_TRANSITIONS 以 (from, to, trigger) 三元组为键,共 27 条(S2→S3 ADR-002
 * 由 17 条 (from, to) 规则展开而来);actor 字段精确归属每条三元组。
 * human_ 前缀的 trigger → actor: 'human';其余由 § 4 子角色 → TransitionActor 映射。
 *
 * 真相源:
 *   - docs/architecture/state_transition.md § 1 § 2 § 4 § 6
 *   - 角色分类: § 4 子角色(Backlog Refiner / Todo Orchestrator / Dev Crafter /
 *     Review Guard / Blocked Resolver)→ TransitionActor.ai_role;
 *     "发起人" / "链路用户" / human_* trigger → human; "系统" → system
 *
 * 不依赖 Drizzle 实例,纯函数;S3 handler 在事务内调用,F-004 审计 wrapper
 * 与 state_transitions / audit_entries 同事务写。
 */

import {
  CARD_STATES,
  TRANSITION_ACTOR_VALUES,
  type CardState,
  type TransitionActor,
} from "@db/schema";

import { IllegalTransitionError } from "./errors";

// Re-export shared error class for back-compat with existing imports
export { IllegalTransitionError };

// ─── 1. TransitionTrigger 11 值(per state_transition.md § 6)────────

export const TRANSITION_TRIGGERS = [
  "dependencies_ready",
  "context_complete",
  "execution_start",
  "evidence_submitted",
  "review_passed",
  "review_failed",
  "human_confirm",
  "human_reject",
  "human_confirm_timeout",
  "blocked_resolved",
  "task_cancelled",
] as const;

export type TransitionTrigger = (typeof TRANSITION_TRIGGERS)[number];

// ─── 2. Card 转移规则(13 跨态 + 4 自环展开为 27 条 (from,to,trigger) 三元组)────

export interface CardTransitionRule {
  readonly from: CardState;
  readonly to: CardState;
  readonly trigger: TransitionTrigger;
  readonly actor: TransitionActor;
}

export const CARD_TRANSITIONS: readonly CardTransitionRule[] = [
  // § 4 normal flow(Backlog → Todo → Dev → Review → Done)
  { from: "backlog", to: "todo", trigger: "dependencies_ready", actor: "ai_role" },
  { from: "backlog", to: "todo", trigger: "context_complete", actor: "ai_role" },
  { from: "todo", to: "dev", trigger: "execution_start", actor: "ai_role" },
  { from: "dev", to: "review", trigger: "evidence_submitted", actor: "ai_role" },
  { from: "review", to: "done", trigger: "review_passed", actor: "ai_role" },
  // per ADR-002: human_confirm 触发时 actor 必须是 human(审计归属)
  { from: "review", to: "done", trigger: "human_confirm", actor: "human" },

  // § 4 blocked flow(任意 active 态 → Blocked)
  { from: "backlog", to: "blocked", trigger: "task_cancelled", actor: "ai_role" },
  { from: "backlog", to: "blocked", trigger: "review_failed", actor: "ai_role" },
  // per ADR-002: human_reject 触发时 actor 必须是 human
  { from: "backlog", to: "blocked", trigger: "human_reject", actor: "human" },

  { from: "todo", to: "blocked", trigger: "task_cancelled", actor: "ai_role" },
  { from: "todo", to: "blocked", trigger: "review_failed", actor: "ai_role" },
  { from: "todo", to: "blocked", trigger: "human_reject", actor: "human" },

  { from: "dev", to: "blocked", trigger: "task_cancelled", actor: "ai_role" },
  { from: "dev", to: "blocked", trigger: "review_failed", actor: "ai_role" },
  { from: "dev", to: "blocked", trigger: "human_reject", actor: "human" },

  { from: "review", to: "blocked", trigger: "review_failed", actor: "ai_role" },
  { from: "review", to: "blocked", trigger: "human_reject", actor: "human" },

  // § 4 blocked resolution(Blocked → {Backlog/Todo/Dev/Review}/Cancelled)
  // per spec §10: blocked → cancelled 仅 task_cancelled 一种触发方式。
  // human_confirm_timeout 不应将卡片移出 blocked(超时后卡片保持或回到 blocked),
  // 因此这里没有 human_confirm_timeout 触发的 blocked→cancelled 规则。
  // COR-004 (Task 2.4) 移除了原先的 human_confirm_timeout 三元组。
  { from: "blocked", to: "backlog", trigger: "blocked_resolved", actor: "ai_role" },
  { from: "blocked", to: "todo", trigger: "blocked_resolved", actor: "ai_role" },
  { from: "blocked", to: "dev", trigger: "blocked_resolved", actor: "ai_role" },
  { from: "blocked", to: "review", trigger: "blocked_resolved", actor: "ai_role" },
  { from: "blocked", to: "cancelled", trigger: "task_cancelled", actor: "human" },

  // § 2 self-loops(4 个非终态的"关注/补充"自环)
  { from: "backlog", to: "backlog", trigger: "context_complete", actor: "human" },
  { from: "todo", to: "todo", trigger: "context_complete", actor: "human" },
  { from: "dev", to: "dev", trigger: "evidence_submitted", actor: "ai_role" },
  { from: "review", to: "review", trigger: "evidence_submitted", actor: "human" },
];

// ─── 3. 终态与查询辅助───────────────────────────────────────────

export function isValidState(state: string): state is CardState {
  return (CARD_STATES as readonly string[]).includes(state);
}

export function isTerminalState(state: CardState): boolean {
  return state === "done" || state === "cancelled";
}

function findRule(
  from: CardState,
  to: CardState,
  trigger: TransitionTrigger,
): CardTransitionRule | undefined {
  return CARD_TRANSITIONS.find((r) => r.from === from && r.to === to && r.trigger === trigger);
}

// ─── 4. 公开 API(per F-002 AC-2.1)──────────────────────────────

/**
 * 是否允许从 `from` 转移到 `to`(per (from, to, trigger) 三元组,ADR-002)。
 * - 起始态为终态(done / cancelled)→ 永远 false
 * - 找不到 (from, to, trigger) 三元组 → false
 * - 找到三元组 → true
 */
export function canTransition(from: CardState, to: CardState, trigger: TransitionTrigger): boolean {
  if (isTerminalState(from)) return false;
  return findRule(from, to, trigger) !== undefined;
}

/**
 * 强校验:非法转移 / 终态 → throw `IllegalTransitionError`,合法 → void。
 * 给 S3 API handler 在业务变更前统一把关,可 `instanceof IllegalTransitionError` 区分。
 */
export function assertTransition(from: CardState, to: CardState, trigger: TransitionTrigger): void {
  if (!isValidState(from)) {
    throw new IllegalTransitionError(
      from,
      to,
      trigger,
      [],
      `Invalid card from state: ${from}`,
    );
  }
  if (!isValidState(to)) {
    throw new IllegalTransitionError(
      from,
      to,
      trigger,
      [],
      `Invalid card to state: ${to}`,
    );
  }
  if (isTerminalState(from)) {
    throw new IllegalTransitionError(
      from,
      to,
      trigger,
      [],
      `Cannot transition from terminal card state: ${from}`,
    );
  }
  if (!canTransition(from, to, trigger)) {
    throw new IllegalTransitionError(from, to, trigger);
  }
}

/**
 * 取出 (from, to, trigger) 三元组的主执行者(per § 4 子角色 → TransitionActor 映射)。
 * 无规则时 throw。S3 audit 写 actorType 时调用。
 */
export function getRequiredActor(
  from: CardState,
  to: CardState,
  trigger: TransitionTrigger,
): TransitionActor {
  const rule = findRule(from, to, trigger);
  if (!rule) throw new Error(`No card transition rule: ${from} -> ${to} (trigger=${trigger})`);
  return rule.actor;
}

// Re-export schema 常量便于 S3 handler 单点 import
export { CARD_STATES, TRANSITION_ACTOR_VALUES };
