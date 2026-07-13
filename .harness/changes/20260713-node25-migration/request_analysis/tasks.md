# Request Analysis Tasks

Change ID: `20260713-node25-migration`
Status: request_analysis

## Implementation Tasks

- [ ] Update the Node version pin in `.nvmrc` to `25.2.1`.
  - Verify: `node --version` after `nvm use` (where available) reports `v25.2.1`.

- [ ] Replace the Node 20 engine constraints in the root and Web workspace manifests with `>=25.0.0 <26.0.0`.
  - Verify: `pnpm install --frozen-lockfile` reports no unsupported-engine warning originating from `keplar` or `@keplar/web`.

- [ ] Update active developer-facing runtime references in `README.md` and `docs/CODEMAPS/dependencies.md`.
  - Verify: `rg -n '20\\.10\\.0|Node 20' README.md docs/CODEMAPS/dependencies.md` returns no matches.

## Test Tasks

- [ ] Validate dependency installation against the existing lockfile under Node 25.
  - Verify: `pnpm install --frozen-lockfile`.

- [ ] Run the repository's primary verification aggregate.
  - Verify: `pnpm check`.

- [ ] Run the smoke suite.
  - Verify: `pnpm smoke`.

- [ ] Run the Playwright happy-path suite.
  - Verify: `pnpm e2e`.

- [ ] Check change hygiene.
  - Verify: `git diff --check` and a scoped `git diff --name-only`.

## Documentation Tasks

- [ ] Ensure active runtime documentation names Node 25.2.1 and preserves the existing pnpm 11.5.1 guidance.
  - Verify: inspect the changed README and dependency codemap lines.

## Sequencing

1. Step: Confirm the current Node and pnpm versions and locate all active runtime constraints.
   Verify: `node --version`, `pnpm --version`, and targeted repository search.
2. Step: Update the runtime pin and both engine constraints.
   Verify: manifest inspection and frozen-lockfile install.
3. Step: Update active runtime documentation.
   Verify: targeted stale-reference search.
4. Step: Run check, smoke, and E2E verification under Node 25.
   Verify: command exit status and recorded results.
5. Step: Record results, exceptions, and residual risks in the Phase 4 artifact.
   Verify: `testing/results.md`, `feature_list.json`, and `sprint_progress.md` are updated.

## Dependencies

- Node.js `v25.2.1` is available locally.
- pnpm `11.5.1` remains available through Corepack.
- Existing dependency lockfile and test services remain usable under Node 25.

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
