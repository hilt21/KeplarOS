/**
 * Build the security headers required by NFR §4.1.
 * CSP uses a per-request nonce; callers must pass the same nonce
 * to <Script nonce={nonce}> in app/layout.tsx (S3 task).
 *
 * In dev mode, Next.js's React Refresh (Fast Refresh) runtime:
 *   1. injects inline <script> tags to bootstrap itself, and
 *   2. uses eval() / new Function() to evaluate hot-reloaded modules.
 * The strict production CSP blocks both, which prevents React from
 * hydrating any client component in dev mode. When `isDev` is true
 * we append `'unsafe-inline'` and `'unsafe-eval'` to `script-src` so
 * React Refresh can start; production CSP is unchanged.
 */
export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

export interface BuildSecurityHeadersOptions {
  readonly nonce: string;
  readonly isDev?: boolean;
}

export function buildSecurityHeaders(opts: BuildSecurityHeadersOptions): readonly SecurityHeader[] {
  // In dev mode, Next.js's React Refresh runtime injects inline
  // <script> tags that don't carry our per-request nonce, and uses
  // eval() to evaluate hot-reloaded module code. Per CSP spec, a
  // nonce in `script-src` causes `'unsafe-inline'` to be ignored,
  // so we drop the nonce in dev and rely on `'unsafe-inline' +
  // 'unsafe-eval'` instead. Production keeps the strict nonce-only
  // policy.
  const scriptSrc =
    opts.isDev === true
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
      : `'self' 'nonce-${opts.nonce}' https://cdn.jsdelivr.net`;

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
