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

// ─── 0. helpers(per TS-010)────────────────────────────────────

/**
 * 把任意字符串"伪装"成 CardState,以测试 assertTransition / isValidState 在收到
 * 非法输入时的行为。比直接 `as CardState` 内联 cast 更可读,也避免 ts-prune / lint
 * 误报"unused expression"。
 */
function invalidState(s: string): CardState {
  return s as unknown as CardState;
}

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

  it("CARD_TRANSITIONS 包含 26 条三元组(17 (from,to) 展开为 (from,to,trigger) 三元组;COR-004 移除 1 条 human_confirm_timeout)", () => {
    expect(CARD_TRANSITIONS.length).toBe(26);
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
    expect(canTransition("backlog", "todo", "dependencies_ready")).toBe(true);
  });
  it("todo → dev 允许", () => {
    expect(canTransition("todo", "dev", "execution_start")).toBe(true);
  });
  it("dev → review 允许", () => {
    expect(canTransition("dev", "review", "evidence_submitted")).toBe(true);
  });
  it("review → done 允许", () => {
    expect(canTransition("review", "done", "review_passed")).toBe(true);
  });

  // ── § 4 blocked flow
  it("backlog → blocked 允许", () => {
    expect(canTransition("backlog", "blocked", "task_cancelled")).toBe(true);
  });
  it("todo → blocked 允许", () => {
    expect(canTransition("todo", "blocked", "task_cancelled")).toBe(true);
  });
  it("dev → blocked 允许", () => {
    expect(canTransition("dev", "blocked", "task_cancelled")).toBe(true);
  });
  it("review → blocked 允许", () => {
    expect(canTransition("review", "blocked", "review_failed")).toBe(true);
  });

  // ── § 4 blocked resolution
  it("blocked → backlog 允许", () => {
    expect(canTransition("blocked", "backlog", "blocked_resolved")).toBe(true);
  });
  it("blocked → todo 允许", () => {
    expect(canTransition("blocked", "todo", "blocked_resolved")).toBe(true);
  });
  it("blocked → dev 允许", () => {
    expect(canTransition("blocked", "dev", "blocked_resolved")).toBe(true);
  });
  it("blocked → review 允许", () => {
    expect(canTransition("blocked", "review", "blocked_resolved")).toBe(true);
  });
  it("blocked → cancelled 允许", () => {
    expect(canTransition("blocked", "cancelled", "task_cancelled")).toBe(true);
  });

  // ── § 2 self-loops
  it("backlog → backlog 自环允许", () => {
    expect(canTransition("backlog", "backlog", "context_complete")).toBe(true);
  });
  it("todo → todo 自环允许", () => {
    expect(canTransition("todo", "todo", "context_complete")).toBe(true);
  });
  it("dev → dev 自环允许", () => {
    expect(canTransition("dev", "dev", "evidence_submitted")).toBe(true);
  });
  it("review → review 自环允许", () => {
    expect(canTransition("review", "review", "evidence_submitted")).toBe(true);
  });
});

// ─── 4. 非法转移(≥ 10 条)────────────────────────────────────

describe("canTransition 非法转移(≥ 10 条)", () => {
  // 倒退
  it("todo → backlog 拒绝(倒退)", () => {
    expect(canTransition("todo", "backlog", "context_complete")).toBe(false);
  });
  it("dev → todo 拒绝(倒退)", () => {
    expect(canTransition("dev", "todo", "context_complete")).toBe(false);
  });
  it("dev → backlog 拒绝(倒退)", () => {
    expect(canTransition("dev", "backlog", "context_complete")).toBe(false);
  });
  it("review → dev 拒绝(倒退)", () => {
    expect(canTransition("review", "dev", "context_complete")).toBe(false);
  });
  it("review → todo 拒绝(倒退)", () => {
    expect(canTransition("review", "todo", "context_complete")).toBe(false);
  });
  it("review → backlog 拒绝(倒退)", () => {
    expect(canTransition("review", "backlog", "context_complete")).toBe(false);
  });
  // 跳跃
  it("backlog → dev 拒绝(跨级)", () => {
    expect(canTransition("backlog", "dev", "context_complete")).toBe(false);
  });
  it("backlog → review 拒绝(跨级)", () => {
    expect(canTransition("backlog", "review", "context_complete")).toBe(false);
  });
  it("backlog → done 拒绝(直接跳终态)", () => {
    expect(canTransition("backlog", "done", "context_complete")).toBe(false);
  });
  it("todo → done 拒绝(跨级)", () => {
    expect(canTransition("todo", "done", "context_complete")).toBe(false);
  });
  it("todo → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("todo", "cancelled", "context_complete")).toBe(false);
  });
  it("backlog → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("backlog", "cancelled", "context_complete")).toBe(false);
  });
  it("dev → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("dev", "cancelled", "context_complete")).toBe(false);
  });
  it("review → cancelled 拒绝(无 blocked 中转)", () => {
    expect(canTransition("review", "cancelled", "context_complete")).toBe(false);
  });
  // 自环限 4 个非终态
  it("done → done 自环拒绝(终态)", () => {
    expect(canTransition("done", "done", "context_complete")).toBe(false);
  });
  it("cancelled → cancelled 自环拒绝(终态)", () => {
    expect(canTransition("cancelled", "cancelled", "context_complete")).toBe(false);
  });
});

// ─── 5. 终态拒绝─────────────────────────────────────────────

describe("终态拒绝", () => {
  it("done → 任何状态都拒绝", () => {
    for (const to of CARD_STATES) {
      expect(canTransition("done", to, "context_complete")).toBe(false);
    }
  });

  it("cancelled → 任何状态都拒绝", () => {
    for (const to of CARD_STATES) {
      expect(canTransition("cancelled", to, "context_complete")).toBe(false);
    }
  });

  it("assertTransition 从终态抛出", () => {
    expect(() => assertTransition("done", "backlog", "context_complete")).toThrow(/terminal/);
    expect(() => assertTransition("cancelled", "backlog", "context_complete")).toThrow(/terminal/);
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

  it("dev → review + evidence_submitted 允许(三元组命中)", () => {
    expect(canTransition("dev", "review", "evidence_submitted")).toBe(true);
  });

  it("终态传 trigger 仍拒绝(短路在 trigger 之前)", () => {
    expect(canTransition("done", "backlog", "context_complete")).toBe(false);
  });
});

// ─── 7. assertTransition 抛错版本───────────────────────────────

describe("assertTransition 抛错版本", () => {
  it("合法转移不抛", () => {
    expect(() => assertTransition("backlog", "todo", "dependencies_ready")).not.toThrow();
    expect(() => assertTransition("dev", "review", "evidence_submitted")).not.toThrow();
  });

  it("非法 from 抛", () => {
    expect(() => assertTransition(invalidState("invalid"), "todo", "context_complete")).toThrow(
      /Invalid/,
    );
  });

  it("非法 to 抛", () => {
    expect(() => assertTransition("backlog", invalidState("invalid"), "context_complete")).toThrow(
      /Invalid/,
    );
  });

  it("非法转移(无规则)抛", () => {
    expect(() => assertTransition("todo", "backlog", "context_complete")).toThrow(/Illegal/);
  });

  it("trigger 不在规则中抛", () => {
    expect(() => assertTransition("backlog", "todo", "evidence_submitted")).toThrow(/Illegal/);
  });
});

// ─── 8. getRequiredActor 角色分类(per F-002 AC-2.4)───────────────

describe("getRequiredActor 角色分类", () => {
  it("backlog → todo (dependencies_ready) = ai_role(对应 Todo Orchestrator)", () => {
    expect(getRequiredActor("backlog", "todo", "dependencies_ready")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("todo → dev (execution_start) = ai_role(Dev Crafter)", () => {
    expect(getRequiredActor("todo", "dev", "execution_start")).toBe<TransitionActor>("ai_role");
  });

  it("dev → review (evidence_submitted) = ai_role(Dev Crafter)", () => {
    expect(getRequiredActor("dev", "review", "evidence_submitted")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("review → done (review_passed) = ai_role(Review Guard / 发起人合并取主)", () => {
    expect(getRequiredActor("review", "done", "review_passed")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → backlog (blocked_resolved) = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "backlog", "blocked_resolved")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("blocked → todo (blocked_resolved) = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "todo", "blocked_resolved")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("blocked → dev (blocked_resolved) = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "dev", "blocked_resolved")).toBe<TransitionActor>("ai_role");
  });

  it("blocked → review (blocked_resolved) = ai_role(Blocked Resolver)", () => {
    expect(getRequiredActor("blocked", "review", "blocked_resolved")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("blocked → cancelled (task_cancelled) = human(对应 发起人 / 系统,合并取主)", () => {
    expect(getRequiredActor("blocked", "cancelled", "task_cancelled")).toBe<TransitionActor>(
      "human",
    );
  });

  it("backlog → blocked (task_cancelled) = ai_role(Backlog Refiner)", () => {
    expect(getRequiredActor("backlog", "blocked", "task_cancelled")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("dev → blocked (task_cancelled) = ai_role(Dev Crafter)", () => {
    expect(getRequiredActor("dev", "blocked", "task_cancelled")).toBe<TransitionActor>("ai_role");
  });

  it("无规则时 getRequiredActor 抛", () => {
    expect(() => getRequiredActor("backlog", "done", "context_complete")).toThrow(
      /No card transition/,
    );
    expect(() => getRequiredActor("done", "backlog", "context_complete")).toThrow(
      /No card transition/,
    );
  });
});

// ─── 9. trigger 集合完整性(per F-002 AC-2.5)────────────────────

describe("trigger 集合覆盖(per AC-2.5:11 trigger 全部存在)", () => {
  it("10 trigger 字面量出现在 CARD_TRANSITIONS 至少一条规则中(human_confirm_timeout 是 COR-004 显式未使用的 trigger)", () => {
    const allTriggers = new Set<TransitionTrigger>();
    for (const rule of CARD_TRANSITIONS) {
      allTriggers.add(rule.trigger);
    }
    // 10 个在用的 trigger
    const usedTriggers = [...TRANSITION_TRIGGERS].filter((t) => t !== "human_confirm_timeout");
    for (const t of usedTriggers) {
      expect(allTriggers.has(t), `trigger ${t} 应至少出现在 1 条规则`).toBe(true);
    }
  });

  it("每条非 COR-004 排除的 trigger 至少有 1 条规则使用", () => {
    const usage = new Map<TransitionTrigger, number>();
    for (const t of TRANSITION_TRIGGERS) usage.set(t, 0);
    for (const rule of CARD_TRANSITIONS) {
      usage.set(rule.trigger, (usage.get(rule.trigger) ?? 0) + 1);
    }
    // COR-004 (spec §10) 显式规定 human_confirm_timeout 不应触发任何转移,因此
    // usage 计数为 0 是正确的不变式;其他 10 个 trigger 必须 >= 1。
    for (const [t, n] of usage) {
      if (t === "human_confirm_timeout") {
        expect(n, "human_confirm_timeout per COR-004 / spec §10 is intentionally unused").toBe(0);
      } else {
        expect(n, `trigger ${t} 至少出现在 1 条规则`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ─── 10. actor attribution per ADR-002 (spec §4)─────────────────

describe("actor attribution per ADR-002 (spec §4)", () => {
  it("human_reject trigger 记录 actor='human'(from=dev → blocked)", () => {
    expect(getRequiredActor("dev", "blocked", "human_reject")).toBe<TransitionActor>("human");
  });

  it("human_reject trigger 记录 actor='human'(from=review → blocked)", () => {
    expect(getRequiredActor("review", "blocked", "human_reject")).toBe<TransitionActor>("human");
  });

  it("human_reject trigger 记录 actor='human'(from=backlog → blocked)", () => {
    expect(getRequiredActor("backlog", "blocked", "human_reject")).toBe<TransitionActor>("human");
  });

  it("human_reject trigger 记录 actor='human'(from=todo → blocked)", () => {
    expect(getRequiredActor("todo", "blocked", "human_reject")).toBe<TransitionActor>("human");
  });

  it("human_confirm trigger 记录 actor='human'(from=review → done)", () => {
    expect(getRequiredActor("review", "done", "human_confirm")).toBe<TransitionActor>("human");
  });

  it("非 human_ trigger 保持原 actor:dependencies_ready (backlog → todo) 仍为 ai_role", () => {
    expect(getRequiredActor("backlog", "todo", "dependencies_ready")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("非 human_ trigger 保持原 actor:review_passed (review → done) 仍为 ai_role", () => {
    expect(getRequiredActor("review", "done", "review_passed")).toBe<TransitionActor>("ai_role");
  });

  it("非 human_ trigger 保持原 actor:code_review_failed (backlog → blocked) 仍为 ai_role", () => {
    expect(getRequiredActor("backlog", "blocked", "review_failed")).toBe<TransitionActor>(
      "ai_role",
    );
  });

  it("getRequiredActor 3-arg 签名:无 (from, to, trigger) 三元组时 throw", () => {
    expect(() => getRequiredActor("backlog", "done", "context_complete")).toThrow(
      /No card transition/,
    );
  });
});

// ─── 11. COR-004: human_confirm_timeout from blocked is invalid (spec §10)────

describe("COR-004: human_confirm_timeout from blocked is invalid (spec §10)", () => {
  it("rejects human_confirm_timeout transition from blocked via canTransition (no rule should match)", () => {
    expect(canTransition("blocked", "cancelled", "human_confirm_timeout")).toBe(false);
  });

  it("rejects human_confirm_timeout transition from blocked via assertTransition (throws Illegal)", () => {
    expect(() => assertTransition("blocked", "cancelled", "human_confirm_timeout")).toThrow(
      /Illegal/,
    );
  });

  it("rejects human_confirm_timeout transition from blocked via getRequiredActor (throws No card transition)", () => {
    expect(() => getRequiredActor("blocked", "cancelled", "human_confirm_timeout")).toThrow(
      /No card transition/,
    );
  });

  it("keeps task_cancelled as the only valid trigger for blocked → cancelled", () => {
    expect(canTransition("blocked", "cancelled", "task_cancelled")).toBe(true);
    expect(getRequiredActor("blocked", "cancelled", "task_cancelled")).toBe<TransitionActor>(
      "human",
    );
  });
});

// ─── 12. COR-010: 自环幂等性契约(per state_transition.md § 2)───────────
// assertTransition 对合法自环三元组**不会**主动校验"自环字段是否发生了变化"。
// 本块锁定这一契约:同一自环三元组反复调用 assertTransition 永远合法,
// 由 caller(handler + audit wrapper)负责"未变更则短路"的幂等决策。

describe("COR-010: self-loop idempotency contract", () => {
  it("backlog → backlog via context_complete 多次调用 assertTransition 全部合法(状态机不校验字段差异)", () => {
    expect(() => assertTransition("backlog", "backlog", "context_complete")).not.toThrow();
    expect(() => assertTransition("backlog", "backlog", "context_complete")).not.toThrow();
    expect(() => assertTransition("backlog", "backlog", "context_complete")).not.toThrow();
  });

  it("dev → dev via evidence_submitted 多次调用全部合法", () => {
    expect(() => assertTransition("dev", "dev", "evidence_submitted")).not.toThrow();
    expect(() => assertTransition("dev", "dev", "evidence_submitted")).not.toThrow();
  });

  it("4 个合法自环全部可被 assertTransition 接受(from === to)", () => {
    expect(() => assertTransition("backlog", "backlog", "context_complete")).not.toThrow();
    expect(() => assertTransition("todo", "todo", "context_complete")).not.toThrow();
    expect(() => assertTransition("dev", "dev", "evidence_submitted")).not.toThrow();
    expect(() => assertTransition("review", "review", "evidence_submitted")).not.toThrow();
  });

  it("canTransition 对自环返回 true,不区分"字段是否实际变化"", () => {
    // 这条测试是 COR-010 契约的核心:状态机层只回答 (from,to,trigger) 是否为
    // 已知合法规则,不回答"这次自环是否产生了实际变更"。caller 必须自行比较。
    expect(canTransition("backlog", "backlog", "context_complete")).toBe(true);
    expect(canTransition("backlog", "backlog", "context_complete")).toBe(true);
  });
});
