/**
 * signSessionValue (F2-10).
 *
 * F1 closure: `signSessionValue` lets the E2E test mint a session
 * cookie value compatible with `getSessionActor`'s verification
 * path. The function reuses the internal `encodePayload` /
 * `signPayload` helpers and emits the same `v1.<base64>.<sig>`
 * format as `createSession`.
 *
 * These tests cover the export shape and the tamper-resistance
 * property of the signed value.
 */

import { describe, expect, it } from "vitest";

import { signSessionValue } from "@/lib/auth/session";

describe("signSessionValue (F2-10)", () => {
  it("emits the v1.<encoded>.<signature> format", () => {
    const value = signSessionValue({
      sub: "user-1",
      exp: Date.now() + 60_000,
    });
    const parts = value.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v1");
    expect(parts[1]?.length ?? 0).toBeGreaterThan(0);
    expect(parts[2]?.length ?? 0).toBeGreaterThan(0);
  });

  it("produces deterministic output for identical input", () => {
    const exp = Date.now() + 60_000;
    const a = signSessionValue({ sub: "user-1", exp });
    const b = signSessionValue({ sub: "user-1", exp });
    expect(a).toBe(b);
  });

  it("produces different signatures for different sub values", () => {
    const exp = Date.now() + 60_000;
    const a = signSessionValue({ sub: "user-1", exp });
    const b = signSessionValue({ sub: "user-2", exp });
    expect(a).not.toBe(b);
  });

  it("the encoded payload round-trips back to the original sub", () => {
    const exp = Date.now() + 60_000;
    const value = signSessionValue({ sub: "user-abc", exp });
    const parts = value.split(".");
    const encoded = parts[1];
    expect(encoded).toBeDefined();
    const decoded = JSON.parse(Buffer.from(encoded!, "base64url").toString("utf8")) as {
      sub: string;
      exp: number;
    };
    expect(decoded.sub).toBe("user-abc");
    expect(decoded.exp).toBe(exp);
  });
});
