import { describe, it, expect } from "vitest";
import { middleware, config } from "../src/middleware";
import { NextRequest, NextResponse } from "next/server";

function makeReq(
  method: string,
  origin?: string,
  host = "localhost:3000",
  pathname = "/api/cards",
): NextRequest {
  const url = new URL(`http://${host}${pathname}`);
  const req = new NextRequest(url, { method });
  if (origin) req.headers.set("origin", origin);
  req.headers.set("host", host);
  return req;
}

describe("middleware (SEC-004)", () => {
  describe("config export", () => {
    it("matches /api/:path*", () => {
      expect(config.matcher).toContain("/api/:path*");
    });
  });

  describe("GET requests pass through", () => {
    it("returns NextResponse.next() for GET", async () => {
      const res = await middleware(makeReq("GET"));
      expect(res).toBeInstanceOf(NextResponse);
      // GET should pass through (status 200, not 403)
      expect(res.status).not.toBe(403);
    });
  });

  describe("state-changing methods require valid Origin", () => {
    it("allows POST when Origin matches Host", async () => {
      const res = await middleware(makeReq("POST", "http://localhost:3000"));
      expect(res.status).not.toBe(403);
    });

    it("rejects POST when Origin does not match Host", async () => {
      const res = await middleware(makeReq("POST", "http://evil.example.com"));
      expect(res.status).toBe(403);
    });

    it("rejects POST when Origin is missing", async () => {
      const res = await middleware(makeReq("POST"));
      expect(res.status).toBe(403);
    });

    it("allows PATCH when Origin matches Host", async () => {
      const res = await middleware(makeReq("PATCH", "http://localhost:3000"));
      expect(res.status).not.toBe(403);
    });

    it("rejects PATCH when Origin does not match Host", async () => {
      const res = await middleware(makeReq("PATCH", "http://evil.example.com"));
      expect(res.status).toBe(403);
    });

    it("allows DELETE when Origin matches Host", async () => {
      const res = await middleware(makeReq("DELETE", "http://localhost:3000"));
      expect(res.status).not.toBe(403);
    });

    it("rejects DELETE when Origin does not match Host", async () => {
      const res = await middleware(makeReq("DELETE", "http://evil.example.com"));
      expect(res.status).toBe(403);
    });
  });

  describe("Origin host extraction", () => {
    it("extracts host from URL correctly (handles ports)", async () => {
      const res = await middleware(
        makeReq("POST", "http://api.example.com:8080", "api.example.com:8080"),
      );
      expect(res.status).not.toBe(403);
    });

    it("rejects when origin port differs", async () => {
      const res = await middleware(makeReq("POST", "http://localhost:9999", "localhost:3000"));
      expect(res.status).toBe(403);
    });
  });

  describe("cookie SameSite enforcement", () => {
    it("sets SameSite=Strict on all cookies in response", async () => {
      const req = makeReq("GET", "http://localhost:3000");
      const res = await middleware(req);
      // Check that any Set-Cookie headers have SameSite=Strict
      const setCookies = res.headers.getSetCookie?.() ?? [];
      for (const cookie of setCookies) {
        expect(cookie.toLowerCase()).toContain("samesite=strict");
      }
    });
  });
});
