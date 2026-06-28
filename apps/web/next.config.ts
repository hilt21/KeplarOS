import type { NextConfig } from "next";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...buildSecurityHeaders({
            nonce: randomBytes(16).toString("base64"),
            // Loosen the dev CSP so Next.js's React Refresh runtime
            // can boot. Without `unsafe-inline` + `unsafe-eval` in
            // dev, the browser blocks React Refresh's bootstrap
            // script and eval'd module code, and no client component
            // ever hydrates. Production CSP is unchanged.
            isDev: process.env.NODE_ENV === "development",
          }),
        ],
      },
    ];
  },
};

export default nextConfig;
