import { describe, it, expect } from "vitest";
import { buildSecurityHeaders } from "../src/lib/security/headers";

describe("buildSecurityHeaders", () => {
  it("returns all required security headers per NFR §4.1", () => {
    const headers = buildSecurityHeaders({ nonce: "test-nonce-abc" });

    // Content-Security-Policy with nonce
    const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'nonce-test-nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");

    // HSTS
    expect(headers.find((h) => h.key === "Strict-Transport-Security")?.value).toContain(
      "max-age=31536000",
    );
    expect(headers.find((h) => h.key === "Strict-Transport-Security")?.value).toContain("preload");

    // Other NFR §4.1 headers
    expect(headers.find((h) => h.key === "X-Content-Type-Options")?.value).toBe("nosniff");
    expect(headers.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY");
    expect(headers.find((h) => h.key === "Referrer-Policy")?.value).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.find((h) => h.key === "Permissions-Policy")?.value).toContain("camera=()");
    expect(headers.find((h) => h.key === "Permissions-Policy")?.value).toContain("microphone=()");
  });
});
