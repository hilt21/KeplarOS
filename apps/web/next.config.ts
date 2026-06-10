import type { NextConfig } from "next";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...buildSecurityHeaders({ nonce: randomBytes(16).toString("base64") })],
      },
    ];
  },
};

export default nextConfig;
