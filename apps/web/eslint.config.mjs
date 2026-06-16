import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "db/migrations/**",
    ],
  },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  prettier,
  {
    rules: {
      // S3-ready: stricter rules for upcoming async route handlers (TS-007).
      // Type-aware rules (no-floating-promises, no-misused-promises) deferred to
      // Wave 4 — requires parserOptions.project + tsconfig.eslint.json setup.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  },
];

export default config;
