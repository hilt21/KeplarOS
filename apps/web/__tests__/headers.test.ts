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

    // Production script-src must NOT contain `'unsafe-inline'` /
    // `'unsafe-eval'`. Per CSP spec, both are ignored when a nonce
    // is present, so the nonce-only policy stays strict.
    // (style-src intentionally keeps `'unsafe-inline'` for Tailwind
    // inline styles — that is unrelated to script execution.)
    const scriptSrc = csp?.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("relaxes script-src in dev mode so React Refresh can boot", () => {
    const headers = buildSecurityHeaders({ nonce: "test-nonce-abc", isDev: true });
    const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value;

    // In dev, the per-request nonce is dropped (it would invalidate
    // the inline scripts React Refresh injects) and replaced with
    // `'unsafe-inline' + 'unsafe-eval'` so the React Refresh runtime
    // can evaluate hot-reloaded module code. Production CSP stays
    // strict because prod is exposed to the public.
    const scriptSrc = csp?.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'nonce-");
  });
});
