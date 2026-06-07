/**
 * F-002 T-004: Card 状态机单测
 *
 * 覆盖范围(per F-002 AC-2.7):
 *   - 全部 17 条合法转移(13 跨态 + 4 自环)→ canTransition = true / assertTransition 不抛
 *   - ≥ 10 条非法转移 → canTransition = false / assertTransition 抛
 *   - 终态(Done / Cancelled)→ 任何 to 都拒绝
 *   - 全部 11 个 TransitionTrigger 字面量都在 TRANSITION_TRIGGERS 数组
 *   - 角色分类正确(Backlog→Todo 需 ai_role 等)
 *
 * 真相源: docs/architecture/state_transition.md § 1 § 2 § 4 § 6
 */

import { describe, expect, it } from "vitest";

import {
  CARD_STATES,
  CARD_TRANSITIONS,
  TRANSITION_ACTOR_VALUES,
  TRANSITION_TRIGGERS,
  assertTransition,
  canTransition,
  getRequiredActor,
  isTerminalState,
  isValidState,
  type CardState,
  type TransitionActor,
  type TransitionTrigger,
} from "@/lib/state-machine";

// ─── 1. 常量与字面量集合一致性────────────────────────────────────

describe("constants & literal unions", () => {
  it("CARD_STATES 导出 7 个状态(backlog/todo/dev/review/done/blocked/cancelled)", () => {
    expect([...CARD_STATES]).toEqual([
      "backlog",
      "todo",
      "dev",
      "review",
      "done",
      "blocked",
      "cancelled",
    ]);
  });

  it("TRANSITION_TRIGGERS 导出 11 个 trigger 字面量(per state_transition.md § 6)", () => {
    expect([...TRANSITION_TRIGGERS]).toEqual([
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
    ]);
  });

  it("TRANSITION_ACTOR_VALUES = 3 值(human / ai_role / system)", () => {
    expect([...TRANSITION_ACTOR_VALUES]).toEqual(["human", "ai_role", "system"]);
  });

  it("CARD_TRANSITIONS 包含 17 条规则(13 跨态 + 4 自环)", () => {
    expect(CARD_TRANSITIONS.length).toBe(17);
  });
});

// ─── 2. isValidState / isTerminalState─────────────────────────────

describe("isValidState / isTerminalState", () => {
  it("isValidState 对 CARD_STATES 中 7 个值返回 true", () => {
    for (const s of CARD_STATES) {
      expect(isValidState(s)).toBe(true);
    }
  });

  it("isValidState 对非法字符串返回 false", () => {
    expect(isValidState("invalid")).toBe(false);
    expect(isValidState("Done")).toBe(false); // case-sensitive
    expect(isValidState("")).toBe(false);
  });

  it("isTerminalState 仅 done / cancelled 返回 true", () => {
    expect(isTerminalState("done")).toBe(true);
    expect(isTerminalState("cancelled")).toBe(true);
    expect(isTerminalState("backlog")).toBe(false);
    expect(isTerminalState("todo")).toBe(false);
    expect(isTerminalState("dev")).toBe(false);
    expect(isTerminalState("review")).toBe(false);
    expect(isTerminalState("blocked")).toBe(false);
  });
});

// ─── 3. 合法转移(13 跨态 + 4 自环 = 17)─────────────────────────

describe("canTransition 合法转移(17 条)", () => {
  // ── § 4 normal flow
  it("backlog → todo 允许", () => {
    expect(canTransition("backlog", "todo")).toBe(true);
  });
  it("todo → dev 允许", () => {
    expect(canTransition("todo", "dev")).toBe(true);
  });
  it("dev → review 允许", () => {
    expect(canTransition("dev", "review")).toBe(true);
  });
  it("review → done 允许", () => {
    expect(canTransition("review", "done")).toBe(true);
  });

  // ── § 4 blocked flow
  it("backlog → blocked 允许", () => {
    expect(canTransition("backlog", "blocked")).toBe(true);
  });
  it("todo → blocked 允许", () => {
    expect(canTransition("todo", "blocked")).toBe(true);
  });
  it("dev → blocked 允许", () => {
    expect(canTransition("dev", "blocked")).toBe(true);
  });
  it("review → blocked 允许", () => {
    expect(canTransition("review", "blocked")).toBe(true);
  });

  // ── § 4 blocked resolution
  it("blocked → backlog 允许", () => {
    expect(canTransition("blocked", "backlog")).toBe(true);
  });
  it("blocked → todo 允许", () => {
    expect(canTransition("blocked", "todo")).toBe(true);
  });
  it("blocked → dev 允许", () => {
    expect(canTransition("blocked", "dev")).toBe(true);
  });
  it("blocked → review 允许", () => {
    expect(canTransition("blocked", "review")).toBe(true);
  });
  it("blocked → cancelled 允许", () => {
    expect(canTransition("blocked", "cancelled")).toBe(true);
  });

  // ── § 2 self-loops
  it("backlog → backlog 自环允许", () => {
    expect(canTransition("backlog", "backlog")).toBe(true);
  });
  it("todo → todo 自环允许", () => {
    expect(canTransition("todo", "todo")).toBe(true);
  });
  it("dev → dev 自环允许", () => {
    expect(canTransition("dev", "dev")).toBe(true);
  });
  it("review → review 自环允许", () => {
    expect(canTransition("review", "review")).toBe(true);
  });
});

// ─── 4. 非法转移(≥ 10 条)────────────────────────────────────

describe("canTransition 非法转移(≥ 10 条)", () => {
  // 倒退
  it("todo → backlog 拒绝(倒退)", () => {
    expect(canTransition("todo", "backlog")).toBe(false);
  });
  it("dev → todo 拒绝(倒退)", () => {
    expect(canTransition("dev", "todo")).toBe(false);
  });
  it("dev → backlog 拒绝(倒退)", () => {
    expect(canTransition("dev", "backlog")).toBe(false);
  });
  it("review → dev 拒绝(倒退)", () => {
    expect(canTransition("review", "dev")).toBe(false);
  });
  it("review → todo 拒绝(倒退)", () => {
    expect(canTransition("review", "todo")).toBe(false);
  });
  it("review → backlog 拒绝(倒退)", () => {
    expect(canTransition("review", "backlog")).toBe(false);
  });
  // 跳跃
  it("backlog → dev 拒绝(跨级)", () => {
    expect(canTransition("backlog", "dev")).toBe(false);
  });
  it("backlog → review 拒绝(跨级)", () => {
    expect(canTransition("backlog", "review")).toBe(false);
  });
  it("backlog → done 拒绝(直接跳终态)", () => {
    expect(canTransition("backlog", "done")).toBe(false);
  });
  it("todo → done 拒绝(跨级)", () => {
    expect(canTransition("todo", "done")).toBe(false);
  });
  it("todo → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("todo", "cancelled")).toBe(false);
  });
  it("backlog → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("backlog", "cancelled")).toBe(false);
  });
  it("dev → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("dev", "cancelled")).toBe(false);
  });
  it("review → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("review", "cancelled")).toBe(false);
  });
  // 自环限 4 个非终态
  it("done → done 自环拒绝(终态)", () => {
    expect(canTransition("done", "done")).toBe(false);
  });
  it("cancelled → cancelled 自环拒绝(终态)", () => {
    expect(canTransition("cancelled", "cancelled")).toBe(false);
  });
});

// ─── 5. 终态拒绝─────────────────────────────────────────────

describe("终态拒绝", () => {
  it("done → 任何状态都拒绝", () => {
    for (const to of CARD_STATES) {
      expect(canTransition("done", to)).toBe(false);
    }
  });

  it("cancelled → 任何状态都拒绝", () => {
    for (const to of CARD_STATES) {
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("assertTransition 从终态抛出", () => {
    expect(() => assertTransition("done", "backlog")).toThrow(/terminal/);
    expect(() => assertTransition("cancelled", "backlog")).toThrow(/terminal/);
  });
});

// ─── 6. trigger 过滤─────────────────────────────────────────

describe("trigger 过滤", () => {
  it("合法 trigger:backlog → todo + dependencies_ready 允许", () => {
    expect(canTransition("backlog", "todo", "dependencies_ready")).toBe(true);
  });

  it("合法 trigger:backlog → todo + context_complete 允许", () => {
    expect(canTransition("backlog", "todo", "context_complete")).toBe(true);
  });

  it("非法 trigger:backlog → todo + evidence_submitted 拒绝(trigger 不在规则中)", () => {
    expect(canTransition("backlog", "todo", "evidence_submitted")).toBe(false);
  });

  it("未传 trigger 时,只要规则存在即允许", () => {
    expect(canTransition("dev", "review")).toBe(true);
  });

  it("终态传 trigger 仍拒绝(短路在 trigger 之前)", () => {
    expect(canTransition("done", "backlog", "context_complete")).toBe(false);
  });
});

// ─── 7. assertTransition 抛错版本───────────────────────────────

describe("assertTransition 抛错版本", () => {
  it("合法转移不抛", () => {
    expect(() => assertTransition("backlog", "todo")).not.toThrow();
    expect(() => assertTransition("dev", "review", "evidence_submitted")).not.toThrow();
  });

  it("非法 from 抛", () => {
    expect(() => assertTransition("invalid" as CardState, "todo")).toThrow(/Invalid/);
  });

  it("非法 to 抛", () => {
    expect(() => assertTransition("backlog", "invalid" as CardState)).toThrow(/Invalid/);
  });

  it("非法转移(无规则)抛", () => {
    expect(() => assertTransition("todo", "backlog")).toThrow(/Illegal/);
  });

  it("trigger 不在规则中抛", () => {
    expect(() => assertTransition("backlog", "todo", "evidence_submitted")).toThrow(/Illegal/);
  });
});

// ─── 8. getRequiredActor 角色分类(per F-002 AC-2.4)───────────────

describe("getRequiredActor 角色分类", () => {
  it("backlog → todo = ai_role(对应 Todo Orchestrator)", () => {
    expect(getRequiredActor("backlog", "todo")).toBe<TransitionActor>("ai_role");
  });

  it("todo → dev = ai_role(Dev Crafter)", () => {
    expect(getRequiredActor("todo", "dev")).toBe<TransitionActor>("ai_role");
  });

  it("dev → review = ai_role(Dev Crafter)", () => {
    expect(getRequiredActor("dev", "review")).toBe<TransitionActor>("ai_role");
  });

  it("review → done = ai_role(Review Guard / 发起人合并取主)", () => {
    expect(getRequiredActor("review", "done")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → backlog = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "backlog")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → todo = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "todo")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → dev = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "dev")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → review = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "review")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → cancelled = human(对应 发起人 / 系统,合并取主)", () => {
    expect(getRequiredActor("blocked", "cancelled")).toBe<TransitionActor>("human");
  });

  it("backlog → blocked = ai_role(Backlog Refiner)", () => {
    expect(getRequiredActor("backlog", "blocked")).toBe<TransitionActor>("ai_role");
  });

  it("dev → blocked = ai_role(Dev Crafter)", () => {
    expect(getRequiredActor("dev", "blocked")).toBe<TransitionActor>("ai_role");
  });

  it("无规则时 getRequiredActor 抛", () => {
    expect(() => getRequiredActor("backlog", "done")).toThrow(/No card transition/);
    expect(() => getRequiredActor("done", "backlog")).toThrow(/No card transition/);
  });
});

// ─── 9. trigger 集合完整性(per F-002 AC-2.5)────────────────────

describe("trigger 集合覆盖(per AC-2.5:11 trigger 全部存在)", () => {
  it("11 trigger 字面量全部出现在 CARD_TRANSITIONS 至少一条规则中", () => {
    const allTriggers = new Set<TransitionTrigger>();
    for (const rule of CARD_TRANSITIONS) {
      for (const t of rule.triggers) allTriggers.add(t);
    }
    for (const t of TRANSITION_TRIGGERS) {
      expect(allTriggers.has(t)).toBe(true);
    }
  });

  it("每条 TRANSITION_TRIGGERS 都至少有 1 条规则使用", () => {
    const usage = new Map<TransitionTrigger, number>();
    for (const t of TRANSITION_TRIGGERS) usage.set(t, 0);
    for (const rule of CARD_TRANSITIONS) {
      for (const t of rule.triggers) {
        usage.set(t, (usage.get(t) ?? 0) + 1);
      }
    }
    for (const [t, n] of usage) {
      expect(n, `trigger ${t} 至少出现在 1 条规则`).toBeGreaterThanOrEqual(1);
    }
  });
});
