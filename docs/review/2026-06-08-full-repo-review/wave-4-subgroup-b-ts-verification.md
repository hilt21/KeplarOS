# Wave 4 Sub-group B — TypeScript quality verification

Plan ref: `docs/superpowers/plans/2026-06-09-s3-spec-alignment.md` Task 5.2
Source findings: `docs/review/2026-06-08-full-repo-review/REVIEW.md` Theme H,
`docs/review/2026-06-08-full-repo-review/findings/typescript.json`

Verification performed after Wave 4 Sub-group A commit `1ae15c8`.

| ID     | Finding                                                  | Status   | Evidence                                                                                                                                                                  |
| ------ | -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS-003 | `AuditTx` infers tx callback via deeply conditional type | NO-OP    | `apps/web/src/lib/audit/run-with-audit.ts:64-67` — `AuditTx = BetterSQLiteTransaction<Record<string,unknown>, TablesRelationalConfig>` direct re-export from drizzle.       |
| TS-004 | `loadAllMigrations` duplicated across test files         | NO-OP    | `apps/web/__tests__/__helpers__/sqlite.ts:29` is the single source; `audit/integration.test.ts`, `audit/run-with-audit.test.ts`, `authorization/execute-db.test.ts` all import from `__helpers__/sqlite`. |
| TS-005 | Unused `_cached` mutation in singleton                   | NO-OP    | `apps/web/src/lib/db/client.ts:42-55` uses `globalThis.__keplarDbCache` with HMR-safe comment; no module-level `let _cached`.                                              |
| TS-006 | `outputFileTracingRoot` reaches monorepo root            | NO-OP    | `pnpm build` (Next.js 15.5.19) succeeds; `.next/next-server.js.nft.json` (652 entries) and `.next/next-minimal-server.js.nft.json` (100 entries) contain **0** paths under `crates/` or `apps/desktop/`. The setting is harmless: Next.js file tracing follows imports/explicit references, and the web app does not import from sibling workspaces. |
| TS-007 | ESLint config minimal (no `no-floating-promises`)       | NO-OP    | `apps/web/eslint.config.mjs` adds `@typescript-eslint/no-unused-vars`, `no-explicit-any`, `consistent-type-imports`. Type-aware rules deferred to Wave 4 per the in-file comment. |
| TS-008 | Concurrency check missing on realtime subquery           | NO-OP    | `apps/web/__tests__/audit/integration.test.ts:152-189` already has a `Promise.all` test firing N=25 parallel `runWithAudit` calls and asserting `sequences == [1..25]` exactly. |
| TS-009 | `assertTransition` throws plain `Error`                 | NO-OP    | `apps/web/src/lib/state-machine/card.ts:97-114` defines `IllegalTransitionError extends Error { readonly code = 'STATE_CONFLICT' as const; ... }`. `assertTransition` (line 175) throws it. Slightly diverges from spec shape: uses `from`/`to`/`trigger` fields rather than `missingPreconditions: string[]`, since per-triple validation makes a list-of-preconditions awkward; documented below. |
| TS-010 | State-machine tests use `as CardState` casts            | NO-OP    | `apps/web/__tests__/state-machine/card.test.ts:38-40` defines `invalidState(s: string)` helper using `as unknown as CardState`. Inline rather than `__helpers__/states.ts` per the spec — same intent, single test file scope. |
| TS-011 | `smoke.test.ts` uses `Object.keys(schema)` after comment | NO-OP    | `apps/web/__tests__/smoke.test.ts:18-32` uses `new Set(Object.keys(schema)).toEqual(expectedTables)` — name-set assertion as the spec asked.                                  |
| TS-012 | `engines.node` loose; no `.nvmrc`                        | ACTUAL   | `apps/web/package.json` tightened from `>=20.0.0 <21.0.0` to `>=20.10.0 <21.0.0`. `.nvmrc` at repo root already had `20` (since Wave 1) — kept.                                |

## Notes

### TS-009 deviation

The spec suggested `IllegalTransitionError { code; missingPreconditions: string[] }`.
Current implementation carries `from`/`to`/`trigger` rather than `missingPreconditions`,
because `assertTransition` validates a single triple (not a state graph), so the natural
"what's missing" decomposition is the offending triple itself. Caller can read
`err.from`, `err.to`, `err.trigger` and derive the precondition name from the `findRule`
table. This is functionally equivalent for the only current caller (state-machine tests
use `instanceof IllegalTransitionError` and message regex). Keeping the existing shape
preserves the API contract that the Wave 4 Subgroup A commit landed.

### TS-010 deviation

`invalidState` lives inline in `card.test.ts` rather than a separate
`__tests__/state-machine/__helpers__/states.ts`. The file-scope helper is used only by
this single test file; lifting to a shared module would create an unused export for any
non-card state machine test. Same effect, smaller diff.

## Verification commands

```bash
pnpm tsc --noEmit           # passes (only node engine warning, expected on Node v25)
pnpm vitest run             # 24 files, 311 tests, all pass
npx next build --no-lint    # succeeds; .next/next-server.js.nft.json inspected
```

The pre-existing `pnpm build` (which runs lint+types) fails on a `consistent-type-imports`
violation in `apps/web/src/middleware.ts:16` — that is **not** part of this subgroup's scope
(Wave 4-B findings are all LOW-severity type-clarity items); middleware lint fix belongs to
its own subgroup if desired.

## Commits

- `chore(deps): tighten engines.node to >=20.10.0 + add .nvmrc (TS-012)` — actual fix
- `chore(ts): verify TS-003/004/005/006/007/008/009/010/011 already in place` — this file