import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";

describe("password (SEC-006)", () => {
  it("hashes a password into a self-describing encoded string", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    // encoded format: scrypt$N=...,r=...,p=...$<salt-hex>$<hash-hex>
    // 16-byte salt + 64-byte key = 80 bytes = 160 hex chars + 3 separators
    expect(hash.length).toBeGreaterThan(160);
  });

  it("produces a different hash for the same input (salted)", async () => {
    const a = await hashPassword("same input");
    const b = await hashPassword("same input");
    expect(a).not.toBe(b);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct password");
    expect(await verifyPassword(hash, "correct password")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct password");
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("returns false for a malformed hash", async () => {
    expect(await verifyPassword("not-a-valid-hash", "any password")).toBe(false);
    expect(await verifyPassword("scrypt$bad-params$aa$bb", "any password")).toBe(false);
    expect(await verifyPassword("argon2id$xxx", "any password")).toBe(false);
  });

  it("returns false on non-string inputs without throwing", async () => {
    // @ts-expect-error intentional bad input
    expect(await verifyPassword(null, "x")).toBe(false);
    // @ts-expect-error intentional bad input
    expect(await verifyPassword(undefined, "x")).toBe(false);
  });

  it("rejects empty plaintext at hash time", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});
