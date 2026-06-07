/**
 * F-002 T-005: Goal Space 状态机单测
 *
 * 覆盖范围(per F-002 AC-2.8):
 *   - 4 条合法转移(draft → active / active → completed / active → cancelled / draft → cancelled)
 *   - 终态拒绝(completed / cancelled → 任何 to)
 *   - active → completed 8 种 boolean 组合(2^3)
 *   - *→cancelled 必须传非空 cancelReason,否则 throw
 *   - assertGoalSpaceTransition 返回 string[] 语义
 *
 * 真相源: docs/specs/database_design.md § 3.1 + docs/architecture/state_transition.md
 */

import { describe, expect, it } from "vitest";

import {
  GOAL_SPACE_STATUS_VALUES,
  GOAL_SPACE_TRANSITIONS,
  assertGoalSpaceTransition,
  canGoalSpaceTransition,
  isGoalSpaceTerminal,
  isValidGoalSpaceState,
  type GoalSpaceStatus,
} from "@/lib/state-machine";

// ─── 1. 常量与字面量集合一致性────────────────────────────────────

describe("constants & literal unions", () => {
  it("GOAL_SPACE_STATUS_VALUES 导出 4 个状态(draft/active/completed/cancelled)", () => {
    expect([...GOAL_SPACE_STATUS_VALUES]).toEqual(["draft", "active", "completed", "cancelled"]);
  });

  it("GOAL_SPACE_TRANSITIONS 导出 4 条规则", () => {
    expect(GOAL_SPACE_TRANSITIONS.length).toBe(4);
  });
});

// ─── 2. isValidGoalSpaceState / isGoalSpaceTerminal──────────────────

describe("isValidGoalSpaceState / isGoalSpaceTerminal", () => {
  it("isValidGoalSpaceState 对 4 个值返回 true", () => {
    for (const s of GOAL_SPACE_STATUS_VALUES) {
      expect(isValidGoalSpaceState(s)).toBe(true);
    }
  });

  it("isValidGoalSpaceState 对非法字符串返回 false", () => {
    expect(isValidGoalSpaceState("activee")).toBe(false);
    expect(isValidGoalSpaceState("")).toBe(false);
  });

  it("isGoalSpaceTerminal 仅 completed / cancelled 返回 true", () => {
    expect(isGoalSpaceTerminal("completed")).toBe(true);
    expect(isGoalSpaceTerminal("cancelled")).toBe(true);
    expect(isGoalSpaceTerminal("draft")).toBe(false);
    expect(isGoalSpaceTerminal("active")).toBe(false);
  });
});

// ─── 3. 合法转移(4 条)────────────────────────────────────

describe("canGoalSpaceTransition 合法转移(4 条)", () => {
  it("draft → active 允许", () => {
    expect(canGoalSpaceTransition("draft", "active")).toBe(true);
  });
  it("active → completed 允许", () => {
    expect(canGoalSpaceTransition("active", "completed")).toBe(true);
  });
  it("active → cancelled 允许", () => {
    expect(canGoalSpaceTransition("active", "cancelled")).toBe(true);
  });
  it("draft → cancelled 允许", () => {
    expect(canGoalSpaceTransition("draft", "cancelled")).toBe(true);
  });
});

// ─── 4. 非法转移─────────────────────────────────────────

describe("canGoalSpaceTransition 非法转移", () => {
  it("draft → completed 拒绝(需先 active)", () => {
    expect(canGoalSpaceTransition("draft", "completed")).toBe(false);
  });
  it("draft → draft 自环拒绝", () => {
    expect(canGoalSpaceTransition("draft", "draft")).toBe(false);
  });
  it("active → active 自环拒绝", () => {
    expect(canGoalSpaceTransition("active", "active")).toBe(false);
  });
  it("active → draft 拒绝(倒退)", () => {
    expect(canGoalSpaceTransition("active", "draft")).toBe(false);
  });
});

// ─── 5. 终态拒绝─────────────────────────────────────────

describe("终态拒绝", () => {
  it("completed → 任何状态都拒绝", () => {
    for (const to of GOAL_SPACE_STATUS_VALUES) {
      expect(canGoalSpaceTransition("completed", to)).toBe(false);
    }
  });

  it("cancelled → 任何状态都拒绝", () => {
    for (const to of GOAL_SPACE_STATUS_VALUES) {
      expect(canGoalSpaceTransition("cancelled", to)).toBe(false);
    }
  });

  it("assertGoalSpaceTransition 从终态抛出", () => {
    expect(() => assertGoalSpaceTransition("completed", "draft")).toThrow(/terminal/);
    expect(() => assertGoalSpaceTransition("cancelled", "active")).toThrow(/terminal/);
  });
});

// ─── 6. active → completed 8 种 boolean 组合(per AC-2.6 + R-4)────

describe("assertGoalSpaceTransition(active, completed) 返回缺哪条前置", () => {
  it("全满足 → 返回空数组", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: false,
      hasBlockedCard: false,
      allCardsDoneOrCancelled: true,
    });
    expect(missing).toEqual([]);
  });

  it("缺 hasPendingConfirmation(其它满足)→ 返回 ['hasPendingConfirmation']", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: true,
      hasBlockedCard: false,
      allCardsDoneOrCancelled: true,
    });
    expect(missing).toEqual(["hasPendingConfirmation"]);
  });

  it("缺 hasBlockedCard(其它满足)→ 返回 ['hasBlockedCard']", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: false,
      hasBlockedCard: true,
      allCardsDoneOrCancelled: true,
    });
    expect(missing).toEqual(["hasBlockedCard"]);
  });

  it("缺 allCardsDoneOrCancelled(其它满足)→ 返回 ['allCardsDoneOrCancelled']", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: false,
      hasBlockedCard: false,
      allCardsDoneOrCancelled: false,
    });
    expect(missing).toEqual(["allCardsDoneOrCancelled"]);
  });

  it("缺 hasPendingConfirmation + hasBlockedCard → 返回两条", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: true,
      hasBlockedCard: true,
      allCardsDoneOrCancelled: true,
    });
    expect(missing).toEqual(["hasPendingConfirmation", "hasBlockedCard"]);
  });

  it("缺 hasPendingConfirmation + allCardsDoneOrCancelled → 返回两条", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: true,
      hasBlockedCard: false,
      allCardsDoneOrCancelled: false,
    });
    expect(missing).toEqual(["hasPendingConfirmation", "allCardsDoneOrCancelled"]);
  });

  it("缺 hasBlockedCard + allCardsDoneOrCancelled → 返回两条", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: false,
      hasBlockedCard: true,
      allCardsDoneOrCancelled: false,
    });
    expect(missing).toEqual(["hasBlockedCard", "allCardsDoneOrCancelled"]);
  });

  it("全缺(三条)→ 返回三条", () => {
    const missing = assertGoalSpaceTransition("active", "completed", {
      hasPendingConfirmation: true,
      hasBlockedCard: true,
      allCardsDoneOrCancelled: false,
    });
    expect(missing).toEqual([
      "hasPendingConfirmation",
      "hasBlockedCard",
      "allCardsDoneOrCancelled",
    ]);
  });

  it("未传 opts 抛错(强制 caller 提供)", () => {
    expect(() => assertGoalSpaceTransition("active", "completed")).toThrow(/requires opts/);
  });

  it("传错形状 opts(只含 cancelReason)抛错", () => {
    expect(() => assertGoalSpaceTransition("active", "completed", { cancelReason: "x" })).toThrow(
      /requires opts/,
    );
  });
});

// ─── 7. *→cancelled 必须传非空 cancelReason(per MT-5 review)────

describe("assertGoalSpaceTransition(*, cancelled) 强制 cancelReason 非空", () => {
  it("active → cancelled + cancelReason='产品方向调整' → 返回 []", () => {
    const missing = assertGoalSpaceTransition("active", "cancelled", {
      cancelReason: "产品方向调整",
    });
    expect(missing).toEqual([]);
  });

  it("draft → cancelled + cancelReason='设计冲突' → 返回 []", () => {
    const missing = assertGoalSpaceTransition("draft", "cancelled", {
      cancelReason: "设计冲突",
    });
    expect(missing).toEqual([]);
  });

  it("active → cancelled 缺 cancelReason → 抛", () => {
    expect(() => assertGoalSpaceTransition("active", "cancelled")).toThrow(/cancelReason/);
  });

  it("active → cancelled + cancelReason='' → 抛", () => {
    expect(() => assertGoalSpaceTransition("active", "cancelled", { cancelReason: "" })).toThrow(
      /cancelReason/,
    );
  });

  it("active → cancelled + cancelReason='   '(仅空白)→ 抛", () => {
    expect(() => assertGoalSpaceTransition("active", "cancelled", { cancelReason: "   " })).toThrow(
      /cancelReason/,
    );
  });

  it("active → cancelled 传错形状 opts(CompleteOpts)→ 抛", () => {
    expect(() =>
      assertGoalSpaceTransition("active", "cancelled", {
        hasPendingConfirmation: false,
        hasBlockedCard: false,
        allCardsDoneOrCancelled: true,
      }),
    ).toThrow(/cancelReason/);
  });
});

// ─── 8. assertGoalSpaceTransition 抛错版本─────────────────────

describe("assertGoalSpaceTransition 抛错版本", () => {
  it("非法 from 抛", () => {
    expect(() => assertGoalSpaceTransition("invalid" as GoalSpaceStatus, "active")).toThrow(
      /Invalid/,
    );
  });

  it("非法 to 抛", () => {
    expect(() => assertGoalSpaceTransition("draft", "invalid" as GoalSpaceStatus)).toThrow(
      /Invalid/,
    );
  });

  it("非法转移(无规则)抛", () => {
    expect(() => assertGoalSpaceTransition("draft", "completed")).toThrow(/Illegal/);
  });

  it("draft → active + 无 opts → 返回 []", () => {
    const missing = assertGoalSpaceTransition("draft", "active");
    expect(missing).toEqual([]);
  });
});
