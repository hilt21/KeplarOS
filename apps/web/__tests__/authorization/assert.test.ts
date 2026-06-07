/**
 * F-003 T-012: assertAccess / ForbiddenError 单测
 *
 * 覆盖范围(per F-003 AC-3.10 + § 4 错误码):
 *   - assertAccess(true) 不抛
 *   - assertAccess(false) 抛 ForbiddenError
 *   - ForbiddenError:code='FORBIDDEN' + name='ForbiddenError' + message
 *
 * 真相源: docs/specs/authorization_matrix.md § 4 错误码
 */

import { describe, expect, it } from "vitest";

import { ForbiddenError, assertAccess } from "@/lib/authorization";

// ─── assertAccess ────────────────────────────────────────────────────

describe("assertAccess", () => {
  it("AC-3.10: allowed=true 不抛(返回 void)", () => {
    expect(() => assertAccess(true)).not.toThrow();
  });

  it("AC-3.10: allowed=false 抛 ForbiddenError(默认 msg 'Forbidden')", () => {
    expect(() => assertAccess(false)).toThrow(ForbiddenError);
    try {
      assertAccess(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as ForbiddenError).message).toBe("Forbidden");
      expect((e as ForbiddenError).code).toBe("FORBIDDEN");
    }
  });

  it("AC-3.10: allowed=false + 自定义 message → 抛 ForbiddenError(message)", () => {
    expect(() => assertAccess(false, "no read on goalSpace")).toThrow("no read on goalSpace");
  });
});

// ─── ForbiddenError ──────────────────────────────────────────────────

describe("ForbiddenError", () => {
  it("is instanceof Error 且 name/code 字段正确", () => {
    const err = new ForbiddenError("custom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.name).toBe("ForbiddenError");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("custom");
  });
});
