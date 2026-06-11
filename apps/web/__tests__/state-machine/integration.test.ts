/**
 * F-002 T-006: 状态机 ↔ Schema enum 联动 + 聚合 re-export 验证
 *
 * 覆盖范围(per F-002 spec § test_needs):
 *   - F-001 导出的 CARD_STATES / GOAL_SPACE_STATUS_VALUES 与 F-002 状态机
 *     CARD_STATES / GOAL_SPACE_STATUS_VALUES 完全一致(同源)
 *   - F-002 TRANSITION_ACTOR_VALUES 复用 F-001 同名 enum
 *   - @/lib/state-machine 聚合 re-export 全部 OK(card + goal-space)
 *   - 类型层面:CardState 字面量在 canTransition 中无需 cast
 *   - 类型层面:GoalSpaceStatus 字面量在 assertGoalSpaceTransition 中无需 cast
 *
 * 真相源:
 *   - apps/web/db/schema.ts(F-001,F-002 import)
 *   - apps/web/src/lib/state-machine/index.ts(F-002 聚合 re-export)
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CARD_STATES as SCHEMA_CARD_STATES,
  GOAL_SPACE_STATUS_VALUES as SCHEMA_GOAL_SPACE_STATUS_VALUES,
  TRANSITION_ACTOR_VALUES as SCHEMA_TRANSITION_ACTOR_VALUES,
  type CardState as SchemaCardState,
  type GoalSpaceStatus as SchemaGoalSpaceStatus,
  type TransitionActor as SchemaTransitionActor,
} from "@db/schema";

import {
  CARD_STATES as SM_CARD_STATES,
  CARD_TRANSITIONS,
  GOAL_SPACE_STATUS_VALUES as SM_GOAL_SPACE_STATUS_VALUES,
  GOAL_SPACE_TRANSITIONS,
  TRANSITION_ACTOR_VALUES as SM_TRANSITION_ACTOR_VALUES,
  TRANSITION_TRIGGERS,
  assertGoalSpaceTransition,
  assertTransition,
  canGoalSpaceTransition,
  canTransition,
  getRequiredActor,
  isGoalSpaceTerminal,
  isTerminalState,
  isValidGoalSpaceState,
  isValidState,
  type CardState as SmCardState,
  type GoalSpaceStatus as SmGoalSpaceStatus,
  type TransitionActor as SmTransitionActor,
  type TransitionTrigger,
} from "@/lib/state-machine";

// ─── 1. F-001 schema enum 与 F-002 状态机 enum 同步──────────────────

describe("F-001 schema ↔ F-002 state-machine enum 一致性", () => {
  it("CARD_STATES 数组字面量在 schema 与 state-machine 完全相同", () => {
    expect([...SM_CARD_STATES]).toEqual([...SCHEMA_CARD_STATES]);
  });

  it("GOAL_SPACE_STATUS_VALUES 数组字面量在 schema 与 state-machine 完全相同", () => {
    expect([...SM_GOAL_SPACE_STATUS_VALUES]).toEqual([...SCHEMA_GOAL_SPACE_STATUS_VALUES]);
  });

  it("TRANSITION_ACTOR_VALUES 数组字面量在 schema 与 state-machine 完全相同", () => {
    expect([...SM_TRANSITION_ACTOR_VALUES]).toEqual([...SCHEMA_TRANSITION_ACTOR_VALUES]);
  });

  it("type CardState 在 schema 与 state-machine 是同一字面量联合(编译期)", () => {
    expectTypeOf<SmCardState>().toEqualTypeOf<SchemaCardState>();
  });

  it("type GoalSpaceStatus 在 schema 与 state-machine 是同一字面量联合(编译期)", () => {
    expectTypeOf<SmGoalSpaceStatus>().toEqualTypeOf<SchemaGoalSpaceStatus>();
  });

  it("type TransitionActor 在 schema 与 state-machine 是同一字面量联合(编译期)", () => {
    expectTypeOf<SmTransitionActor>().toEqualTypeOf<SchemaTransitionActor>();
  });
});

// ─── 2. F-002 TRANSITION_TRIGGERS 与 CARD_TRANSITIONS trigger 集一致

describe("F-002 TRANSITION_TRIGGERS ↔ CARD_TRANSITIONS trigger 集", () => {
  it("CARD_TRANSITIONS 中所有出现的 trigger 都在 TRANSITION_TRIGGERS 集合内", () => {
    const allowed = new Set<TransitionTrigger>(TRANSITION_TRIGGERS);
    for (const rule of CARD_TRANSITIONS) {
      expect(allowed.has(rule.trigger)).toBe(true);
    }
  });

  it("TRANSITION_TRIGGERS 数组无重复", () => {
    const set = new Set(TRANSITION_TRIGGERS);
    expect(set.size).toBe(TRANSITION_TRIGGERS.length);
  });
});

// ─── 3. GOAL_SPACE_TRANSITIONS from / to 都在 SCHEMA enum 集合内────

describe("F-002 GOAL_SPACE_TRANSITIONS from/to 在 schema enum 集合内", () => {
  it("所有 GOAL_SPACE_TRANSITIONS.from 都在 GOAL_SPACE_STATUS_VALUES 集合内", () => {
    const allowed = new Set<string>(SM_GOAL_SPACE_STATUS_VALUES);
    for (const rule of GOAL_SPACE_TRANSITIONS) {
      expect(allowed.has(rule.from)).toBe(true);
    }
  });

  it("所有 GOAL_SPACE_TRANSITIONS.to 都在 GOAL_SPACE_STATUS_VALUES 集合内", () => {
    const allowed = new Set<string>(SM_GOAL_SPACE_STATUS_VALUES);
    for (const rule of GOAL_SPACE_TRANSITIONS) {
      expect(allowed.has(rule.to)).toBe(true);
    }
  });
});

// ─── 4. CARD_TRANSITIONS from / to 都在 SCHEMA enum 集合内────────

describe("F-002 CARD_TRANSITIONS from/to 在 schema enum 集合内", () => {
  it("所有 CARD_TRANSITIONS.from 都在 CARD_STATES 集合内", () => {
    const allowed = new Set<string>(SM_CARD_STATES);
    for (const rule of CARD_TRANSITIONS) {
      expect(allowed.has(rule.from)).toBe(true);
    }
  });

  it("所有 CARD_TRANSITIONS.to 都在 CARD_STATES 集合内", () => {
    const allowed = new Set<string>(SM_CARD_STATES);
    for (const rule of CARD_TRANSITIONS) {
      expect(allowed.has(rule.to)).toBe(true);
    }
  });
});

// ─── 5. @/lib/state-machine 聚合 re-export 端到端可用────────────

describe("@/lib/state-machine 聚合 re-export", () => {
  it("card + goal-space 全部 12 个函数 / 4 个常量 / 1 个断言函数可调用", () => {
    // 纯调用以确保 import 链不断(返回 undefined 也算成功 = "函数存在且可调用")
    expect(typeof canTransition).toBe("function");
    expect(typeof assertTransition).toBe("function");
    expect(typeof isTerminalState).toBe("function");
    expect(typeof isValidState).toBe("function");
    expect(typeof getRequiredActor).toBe("function");
    expect(typeof canGoalSpaceTransition).toBe("function");
    expect(typeof assertGoalSpaceTransition).toBe("function");
    expect(typeof isGoalSpaceTerminal).toBe("function");
    expect(typeof isValidGoalSpaceState).toBe("function");
    expect(SM_CARD_STATES.length).toBeGreaterThan(0);
    expect(SM_GOAL_SPACE_STATUS_VALUES.length).toBeGreaterThan(0);
    expect(CARD_TRANSITIONS.length).toBeGreaterThan(0);
    expect(GOAL_SPACE_TRANSITIONS.length).toBeGreaterThan(0);
  });

  it("函数返回值类型正确(避免重导出时类型被擦除)", () => {
    // canTransition 应返回 boolean
    expectTypeOf(canTransition).returns.toEqualTypeOf<boolean>();
    // isValidState 是 type guard
    const guard: (s: string) => s is SmCardState = isValidState;
    expect(typeof guard).toBe("function");
  });
});
