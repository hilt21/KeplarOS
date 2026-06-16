import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: false,
    environmentMatchGlobs: [
      // F-001 schema-migrate + F-004 audit tests need node env for better-sqlite3 native module
      // (jsdom occasionally fails to load native .node bindings — see review/findings.md R-2)
      { glob: "__tests__/schema-migrate.test.ts", environment: "node" },
      { glob: "__tests__/schema-migrate-constraints.test.ts", environment: "node" },
      { glob: "__tests__/audit/**", environment: "node" },
      // SEC-009: DB-aware canExecuteCardForCardId test needs better-sqlite3
      { glob: "__tests__/authorization/execute-db.test.ts", environment: "node" },
    ],
    include: [
      "__tests__/**/*.test.ts",
      "__tests__/**/*.test.tsx",
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    },
  },
});
