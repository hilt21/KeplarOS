/**
 * Next.js middleware (SEC-004)
 *
 * CSRF / Origin check:
 * - On state-changing methods (POST/PUT/PATCH/DELETE), the Origin header MUST match
 *   the Host header (same scheme + host + port). Otherwise, return 403.
 * - GET/HEAD/OPTIONS pass through (these are idempotent or preflight).
 *
 * Cookie hardening:
 * - All Set-Cookie headers in the response get SameSite=Strict appended if not already
 *   present. Existing cookies are rewritten (deleted and re-added) to avoid duplicates.
 *
 * Per spec: docs/specs/non_functional_requirements.md §4.1, §4.2
 */

import { type NextRequest, NextResponse } from "next/server";

const STATE_CHANGING_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Extracts the host (with port) from an Origin header URL.
 * Returns null if the input is not a valid URL or has no host.
 */
function originHost(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    // `host` includes the port if non-default
    return u.host;
  } catch {
    return null;
  }
}

/**
 * Validates the Origin header against the request Host.
 * Returns true if Origin matches (or is absent for safe methods).
 */
function isValidOrigin(req: NextRequest): boolean {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    // GET/HEAD/OPTIONS pass through
    return true;
  }
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const reqHost = req.headers.get("host");
  if (!reqHost) return false;
  return originHost(origin) === reqHost;
}

/**
 * Enforces SameSite=Strict on all Set-Cookie headers in a response.
 * Rewrites cookies rather than appending duplicates.
 */
function enforceSameSiteStrict(res: NextResponse): NextResponse {
  // `getSetCookie()` returns an array of all Set-Cookie header values.
  // `get('set-cookie')` only returns the joined string in older runtimes.
  const getSetCookie = (res.headers as { getSetCookie?: () => string[] }).getSetCookie;
  const cookies: readonly string[] =
    typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];

  if (cookies.length === 0) return res;

  // Delete the existing (possibly combined) Set-Cookie header, then append each
  // cookie with SameSite=Strict enforced. This avoids duplicate cookies.
  res.headers.delete("Set-Cookie");
  for (const cookie of cookies) {
    if (/samesite=/i.test(cookie)) {
      res.headers.append("Set-Cookie", cookie);
    } else {
      res.headers.append("Set-Cookie", `${cookie}; SameSite=Strict`);
    }
  }
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  if (!isValidOrigin(req)) {
    return new NextResponse("CSRF: invalid origin", { status: 403 });
  }
  const res = NextResponse.next();
  return enforceSameSiteStrict(res);
}

export const config = {
  matcher: [
    "/api/:path*",
    // Static assets, _next/*, etc. are excluded by Next.js by default.
  ],
};
