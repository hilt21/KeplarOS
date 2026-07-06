<!-- Generated: 2026-07-06 | Files scanned: 17 prod + 17 dev deps | Token estimate: ~550 -->

# KEPLAR — Dependencies Codemap

## Runtime (`apps/web`)

| Package | Version | Role |
|---|---|---|
| `next` | ^15.1.0 | App Router framework (SSR + RSC + API routes) |
| `react` | ^19.0.0 | UI runtime |
| `react-dom` | ^19.0.0 | DOM renderer |
| `drizzle-orm` | ^0.36.4 | Type-safe ORM, schema-as-code |
| `better-sqlite3` | ^11.5.0 | Native SQLite binding (allowBuilds) |

> **No external services in Phase 1.** AI execution is **stub/fixture**
> (`lib/execution/fixture-executor.ts`) — no LLM SDK, no MCP/ACP client yet.

## Dev tooling

| Package | Version | Role |
|---|---|---|
| `typescript` | ^5.6.3 | Strict TS compiler |
| `eslint` | ^9.14.0 | Lint (flat config + next/core-web-vitals) |
| `prettier` | ^3.3.3 | Formatter |
| `vitest` | ^2.1.4 | Unit/component tests (jsdom env) |
| `@testing-library/react` | ^16.3.2 | Component test utilities |
| `@testing-library/jest-dom` | ^6.9.1 | DOM matchers |
| `@playwright/test` | ^1.61.0 | E2E (chromium-only, single worker) |
| `tailwindcss` | ^4.0.0 | CSS-first utility framework |
| `@tailwindcss/postcss` | ^4.0.0 | Tailwind 4 PostCSS plugin |
| `postcss` | ^8.4.49 | CSS pipeline |
| `drizzle-kit` | ^0.28.1 | Migrations + studio |
| `vite-tsconfig-paths` | ^5.1.0 | Vitest path aliasing |
| `jsdom` | ^25.0.1 | Browser-like env for tests |
| `eslint-config-prettier` | ^9.1.0 | Disable ESLint/Prettier conflicts |
| `eslint-config-next` | ^15.1.0 | Next.js ESLint preset |
| `@types/*` | — | TS type defs |

## Monorepo / workspace

- **pnpm** workspaces (`pnpm-workspace.yaml`):
  - `apps/*` only (no `packages/*`)
  - `allowBuilds`: `better-sqlite3`, `esbuild`, `sharp` (native bindings)
- **Rust workspace** (`Cargo.toml`, edition 2021, resolver 2):
  - `keplar-core`, `keplar-server`, `keplar-cli`, `keplar-rpc`, `keplar-scanner`
  - **Not wired** into the active web build pipeline; reserved for Phase 2+

## External services (Phase 1)

| Service | Status | Notes |
|---|---|---|
| PostgreSQL 16 | 🟡 declared | `docker-compose.yml` declares `postgres:16-alpine`; not used by web |
| SQLite (local file) | ✅ active | `apps/web/db/dev.db` |
| LLM provider | ❌ not wired | Fixture executor only |
| MCP / ACP / A2A | ❌ not wired | Contract defined, integration deferred |
| Prometheus / Grafana / OTel | ❌ not wired | Structured JSON logs only (Phase 1) |
| CI | ✅ GitHub Actions | `web-ci.yml`, `card-verify.yml` |

## CI pipeline (`.github/workflows/`)

`web-ci.yml` (triggered on push to master + PRs touching `apps/web/**`):
1. gitleaks secret scan
2. Setup Node 20.10.0 + corepack pnpm@11.5.1
3. `pnpm install --frozen-lockfile`
4. Install Playwright chromium
5. `pnpm check` (typecheck && lint && test && build && format:check)
6. `pnpm smoke`
7. `pnpm e2e`

`card-verify.yml`: validates `docs/cards/*.yaml` against
`docs/development-guidelines/card-schema.json` (jq + yq + jsonschema).

## pnpm scripts (root, all delegated to `@keplar/web`)

```bash
pnpm check        # typecheck && lint && test && build && format:check
pnpm smoke        # vitest run __tests__/smoke.test.ts
pnpm e2e          # playwright test
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint .
pnpm test         # vitest run
pnpm build        # next build
pnpm format:check # prettier --check .
pnpm db:generate  # drizzle-kit generate
pnpm db:migrate   # drizzle-kit migrate
pnpm db:check     # drizzle-kit check
```

`apps/web` adds: `dev`, `start`, `test:watch`, `e2e:ui`, `format`, `db:studio`.

## Where to look

| I want to add… | Look at |
|---|---|
| A runtime dep | Edit `apps/web/package.json`; respect pnpm + Next.js 15 compat |
| A native binding | Add to `pnpm-workspace.yaml` `allowBuilds` |
| A Rust crate | Wire into `crates/<name>/Cargo.toml` + root workspace |
| An external API integration | Stub first per `docs/specs/ai_agent_contracts.md`; keep contract intact |
| A CI step | Add to `.github/workflows/web-ci.yml` |