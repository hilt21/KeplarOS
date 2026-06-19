/**
 * Build the security headers required by NFR §4.1.
 * CSP uses a per-request nonce; callers must pass the same nonce
 * to <Script nonce={nonce}> in app/layout.tsx (S3 task).
 */
export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

export interface BuildSecurityHeadersOptions {
  readonly nonce: string;
}

export function buildSecurityHeaders(opts: BuildSecurityHeadersOptions): readonly SecurityHeader[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${opts.nonce}' https://cdn.jsdelivr.net`,
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
