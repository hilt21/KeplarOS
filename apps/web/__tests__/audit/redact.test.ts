/**
 * SEC-005: redactAuditDetails helper unit tests
 *
 * Spec ref: docs/specs/non_functional_requirements.md §5.2, §5.5
 * Finding ref: docs/review/2026-06-08-full-repo-review/REVIEW.md Theme F
 */

import { describe, it, expect } from "vitest";
import { redactAuditDetails, REDACT_KEYS, MAX_DETAILS_BYTES } from "../../src/lib/audit/redact";

describe("redactAuditDetails (SEC-005)", () => {
  it("redacts top-level sensitive keys", () => {
    const input = { user: "alice", password: "secret123", apiKey: "sk-xxx" };
    const result = redactAuditDetails(input);
    expect(result).toEqual({ user: "alice", password: "[REDACTED]", apiKey: "[REDACTED]" });
  });

  it("redacts nested sensitive keys", () => {
    const input = {
      user: "alice",
      profile: { name: "Alice", token: "jwt-abc", settings: { api_key: "sk-123" } },
    };
    const result = redactAuditDetails(input);
    expect(result).toEqual({
      user: "alice",
      profile: {
        name: "Alice",
        token: "[REDACTED]",
        settings: { api_key: "[REDACTED]" },
      },
    });
  });

  it("redacts in arrays", () => {
    const input = [{ token: "jwt-1" }, { password: "p" }];
    const result = redactAuditDetails(input);
    expect(result).toEqual([{ token: "[REDACTED]" }, { password: "[REDACTED]" }]);
  });

  it("matches keys case-insensitively", () => {
    const input = { PASSWORD: "p", ApiKey: "k", Authorization: "Bearer xyz" };
    const result = redactAuditDetails(input) as Record<string, unknown>;
    expect(result.PASSWORD).toBe("[REDACTED]");
    expect(result.ApiKey).toBe("[REDACTED]");
    expect(result.Authorization).toBe("[REDACTED]");
  });

  it("preserves null and undefined values", () => {
    const input = { token: null as null, password: undefined as unknown, name: "alice" };
    const result = redactAuditDetails(input) as Record<string, unknown>;
    expect(result.token).toBeNull();
    expect(result.password).toBeUndefined();
    expect(result.name).toBe("alice");
  });

  it("handles primitives at the root", () => {
    expect(redactAuditDetails("hello")).toBe("hello");
    expect(redactAuditDetails(42)).toBe(42);
    expect(redactAuditDetails(null)).toBeNull();
  });

  it("throws on payloads exceeding MAX_DETAILS_BYTES (32KB)", () => {
    const big = { data: "x".repeat(MAX_DETAILS_BYTES + 100) };
    expect(() => redactAuditDetails(big)).toThrow(/exceeds/);
  });

  it("does not mutate the input", () => {
    const input = { password: "secret" };
    const result = redactAuditDetails(input) as Record<string, unknown>;
    expect(input.password).toBe("secret");
    expect(result.password).toBe("[REDACTED]");
  });

  it("exposes REDACT_KEYS as a frozen set", () => {
    expect(Object.isFrozen(REDACT_KEYS)).toBe(true);
    expect(REDACT_KEYS.has("password")).toBe(true);
    expect(REDACT_KEYS.has("token")).toBe(true);
    expect(REDACT_KEYS.has("api_key")).toBe(true);
  });
});
