/**
 * F-003 COR-011: withInternalActor 系统 actor 上下文测试
 *
 * 覆盖范围:
 *   - SYSTEM_ACTOR 是冻结的 { id: 'system', role: 'system' } 占位符
 *   - withInternalActor 把 callback 包在 SYSTEM_ACTOR 上下文中执行,
 *     callback 拿到的 internalActor.id === 'system'
 *   - 嵌套 withInternalActor + 并发调用之间不会串扰
 *   - 上下文外调用 currentInternalActor() 返回 undefined
 *
 * 真相源: docs/review/2026-06-08-full-repo-review/REVIEW.md COR-011
 */

import { describe, expect, it } from "vitest";

import { SYSTEM_ACTOR, currentInternalActor, withInternalActor } from "@/lib/authorization/system";

describe("COR-011: SYSTEM_ACTOR placeholder", () => {
  it("id === 'system'", () => {
    expect(SYSTEM_ACTOR.id).toBe("system");
  });

  it("role === 'system'(超出 USER_ROLE_VALUES 的特殊值)", () => {
    expect(SYSTEM_ACTOR.role).toBe("system");
  });

  it("frozen — 不允许突变", () => {
    expect(Object.isFrozen(SYSTEM_ACTOR)).toBe(true);
  });
});

describe("COR-011: withInternalActor context", () => {
  it("callback 收到的 internalActor 是 SYSTEM_ACTOR", async () => {
    await withInternalActor(async (internalActor) => {
      expect(internalActor).toEqual({ id: "system", role: "system" });
      expect(internalActor).toBe(SYSTEM_ACTOR);
    });
  });

  it("context 内 currentInternalActor() 返回 SYSTEM_ACTOR", async () => {
    await withInternalActor(async () => {
      expect(currentInternalActor()).toBe(SYSTEM_ACTOR);
    });
  });

  it("context 外 currentInternalActor() 返回 undefined", () => {
    expect(currentInternalActor()).toBeUndefined();
  });

  it("callback 返回值透传给 caller", async () => {
    const result = await withInternalActor(async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("callback 抛错穿透 withInternalActor", async () => {
    await expect(
      withInternalActor(async () => {
        throw new Error("bubble-up");
      }),
    ).rejects.toThrow("bubble-up");
  });

  it("并发调用之间不串扰(异步隔离)", async () => {
    // 两个 withInternalActor 并发触发,通过 microtask 让出;若 ALS 失效,
    // 一个回调可能读到另一个的 actor,导致测试 flakiness / 失败。
    const results = await Promise.all([
      withInternalActor(async () => {
        await Promise.resolve();
        return currentInternalActor()?.id;
      }),
      withInternalActor(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return currentInternalActor()?.id;
      }),
    ]);
    expect(results).toEqual(["system", "system"]);
  });
});
