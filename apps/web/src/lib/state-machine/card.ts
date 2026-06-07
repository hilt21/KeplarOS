/**
 * Card 状态机 (S2 F-002)
 *
 * 7 态 + 13 跨态转移(per state_transition.md § 4)+ 4 自环(per § 2 mermaid)
 * + 11 TransitionTriggers(per § 6)+ 终态拒绝(Done / Cancelled)。
 *
 * 真相源:
 *   - docs/architecture/state_transition.md § 1 § 2 § 4 § 6
 *   - 角色分类: § 4 子角色(Backlog Refiner / Todo Orchestrator / Dev Crafter /
 *     Review Guard / Blocked Resolver)→ TransitionActor.ai_role;
 *     "发起人" / "链路用户" → human; "系统" → system
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

// ─── 2. Card 转移规则(13 跨态 + 4 自环 = 17)───────────────────────

export interface CardTransitionRule {
  readonly from: CardState;
  readonly to: CardState;
  readonly triggers: readonly TransitionTrigger[];
  readonly actor: TransitionActor;
}

export const CARD_TRANSITIONS: readonly CardTransitionRule[] = [
  // § 4 normal flow(Backlog → Todo → Dev → Review → Done)
  {
    from: "backlog",
    to: "todo",
    triggers: ["dependencies_ready", "context_complete"],
    actor: "ai_role",
  },
  {
    from: "todo",
    to: "dev",
    triggers: ["execution_start"],
    actor: "ai_role",
  },
  {
    from: "dev",
    to: "review",
    triggers: ["evidence_submitted"],
    actor: "ai_role",
  },
  {
    from: "review",
    to: "done",
    triggers: ["review_passed", "human_confirm"],
    actor: "ai_role",
  },

  // § 4 blocked flow(任意 active 态 → Blocked)
  {
    from: "backlog",
    to: "blocked",
    triggers: ["task_cancelled", "review_failed", "human_reject"],
    actor: "ai_role",
  },
  {
    from: "todo",
    to: "blocked",
    triggers: ["task_cancelled", "review_failed", "human_reject"],
    actor: "ai_role",
  },
  {
    from: "dev",
    to: "blocked",
    triggers: ["task_cancelled", "review_failed", "human_reject"],
    actor: "ai_role",
  },
  {
    from: "review",
    to: "blocked",
    triggers: ["review_failed", "human_reject"],
    actor: "ai_role",
  },

  // § 4 blocked resolution(Blocked → {Backlog/Todo/Dev/Review}/Cancelled)
  {
    from: "blocked",
    to: "backlog",
    triggers: ["blocked_resolved"],
    actor: "ai_role",
  },
  {
    from: "blocked",
    to: "todo",
    triggers: ["blocked_resolved"],
    actor: "ai_role",
  },
  {
    from: "blocked",
    to: "dev",
    triggers: ["blocked_resolved"],
    actor: "ai_role",
  },
  {
    from: "blocked",
    to: "review",
    triggers: ["blocked_resolved"],
    actor: "ai_role",
  },
  {
    from: "blocked",
    to: "cancelled",
    triggers: ["task_cancelled", "human_confirm_timeout"],
    actor: "human",
  },

  // § 2 self-loops(4 个非终态的"关注/补充"自环)
  {
    from: "backlog",
    to: "backlog",
    triggers: ["context_complete"],
    actor: "human",
  },
  {
    from: "todo",
    to: "todo",
    triggers: ["context_complete"],
    actor: "human",
  },
  {
    from: "dev",
    to: "dev",
    triggers: ["evidence_submitted"],
    actor: "ai_role",
  },
  {
    from: "review",
    to: "review",
    triggers: ["evidence_submitted"],
    actor: "human",
  },
];

// ─── 3. 终态与查询辅助───────────────────────────────────────────

export function isValidState(state: string): state is CardState {
  return (CARD_STATES as readonly string[]).includes(state);
}

export function isTerminalState(state: CardState): boolean {
  return state === "done" || state === "cancelled";
}

function findRule(from: CardState, to: CardState): CardTransitionRule | undefined {
  return CARD_TRANSITIONS.find((r) => r.from === from && r.to === to);
}

// ─── 4. 公开 API(per F-002 AC-2.1)──────────────────────────────

/**
 * 是否允许从 `from` 转移到 `to`。
 * - 起始态为终态(done / cancelled)→ 永远 false
 * - 找不到 (from, to) 规则 → false
 * - 找到规则且未传 trigger → true(规则存在即合法)
 * - 找到规则且 trigger 在 rule.triggers 内 → true,否则 false
 */
export function canTransition(
  from: CardState,
  to: CardState,
  trigger?: TransitionTrigger,
): boolean {
  if (isTerminalState(from)) return false;
  const rule = findRule(from, to);
  if (!rule) return false;
  if (trigger === undefined) return true;
  return rule.triggers.includes(trigger);
}

/**
 * 强校验:非法转移 / 终态 → throw Error,合法 → void。
 * 给 S3 API handler 在业务变更前统一把关。
 */
export function assertTransition(
  from: CardState,
  to: CardState,
  trigger?: TransitionTrigger,
): void {
  if (!isValidState(from)) throw new Error(`Invalid card from state: ${from}`);
  if (!isValidState(to)) throw new Error(`Invalid card to state: ${to}`);
  if (isTerminalState(from)) {
    throw new Error(`Cannot transition from terminal card state: ${from}`);
  }
  if (!canTransition(from, to, trigger)) {
    const t = trigger !== undefined ? ` (trigger=${trigger})` : "";
    throw new Error(`Illegal card state transition: ${from} -> ${to}${t}`);
  }
}

/**
 * 取出 (from, to) 规则的主执行者(per § 4 子角色 → TransitionActor 映射)。
 * 无规则时 throw。S3 audit 写 actorType 时调用。
 */
export function getRequiredActor(from: CardState, to: CardState): TransitionActor {
  const rule = findRule(from, to);
  if (!rule) throw new Error(`No card transition rule: ${from} -> ${to}`);
  return rule.actor;
}

// Re-export schema 常量便于 S3 handler 单点 import
export { CARD_STATES, TRANSITION_ACTOR_VALUES };
