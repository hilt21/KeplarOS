# Request Analysis Spec

Change ID: `20260713-node25-migration`
Status: request_analysis

## Request Summary

Migrate KEPLAR's declared and documented Node.js runtime from Node 20.10.0 to Node 25. The repository's active local runtime is already `v25.2.1`, while the root and web package engine constraints and `.nvmrc` still require Node 20, producing unsupported-engine warnings during all pnpm verification commands.

The migration will align the runtime contract across the root workspace, web workspace, CI (which reads `.nvmrc`), and developer-facing documentation. It will then validate the existing application toolchain under Node 25 without upgrading unrelated dependencies.

## Assumptions

- "Node 25" means the currently installed `25.2.1` patch release for the exact runtime pin in `.nvmrc`.
- Package engine ranges should accept the Node 25 major line only: `>=25.0.0 <26.0.0`.
- pnpm remains pinned at `11.5.1`; no package-manager upgrade is requested.
- Dependency upgrades or lockfile churn are out of scope unless a Node 25 compatibility failure makes a minimal, separately approved change necessary.
- The existing `web-ci.yml` needs no direct edit because `actions/setup-node` reads `.nvmrc`.

## Scope

### In Scope

- Update `.nvmrc` from `20.10.0` to `25.2.1`.
- Update the Node engine constraints in `package.json` and `apps/web/package.json` to `>=25.0.0 <26.0.0`.
- Update current-runtime documentation in `README.md` and `docs/CODEMAPS/dependencies.md`.
- Run the existing Node 25 verification suite and record exact outcomes, including any Node-25-specific compatibility failures.
- Preserve the existing pnpm version and frozen lockfile unless an approved scope amendment says otherwise.

### Out of Scope

- Updating application, build, test, database, or lint dependencies.
- Changing pnpm, Corepack, the lockfile, Docker/Postgres, CI workflow logic, or application source code.
- Supporting multiple Node major versions or adding a version manager beyond the existing `.nvmrc` contract.
- Addressing unrelated lint, test, build, or formatting defects not caused by Node 25.
- Migrating to an LTS Node release instead of the requested Node 25.

## Affected Areas

- API: none expected.
- Data model: none.
- Authorization: none.
- UI/UX: none.
- Runtime/tooling: `.nvmrc`, root `package.json`, `apps/web/package.json`, and CI's Node setup input.
- Tests: existing typecheck, lint, unit, build, formatting, smoke, and E2E commands.
- Docs: `README.md`, `docs/CODEMAPS/dependencies.md`.

## Acceptance Criteria

- [ ] `.nvmrc` contains `25.2.1`.
- [ ] Both workspace manifests declare Node `>=25.0.0 <26.0.0`.
- [ ] `web-ci.yml` continues to install the same Node version through `node-version-file: .nvmrc`; no hard-coded stale Node 20 reference remains in the active CI workflow.
- [ ] README and dependency codemap state Node 25.2.1 instead of Node 20.10.0.
- [ ] `pnpm install --frozen-lockfile` completes under Node 25 without an unsupported Node-engine warning from KEPLAR's own package manifests.
- [ ] `pnpm check`, `pnpm smoke`, and `pnpm e2e` are run under Node 25; each result is recorded truthfully, including any unavailable external dependency or unrelated pre-existing failure.
- [ ] No dependency or application-source changes are made unless separately approved through a scope amendment.

## Risks

- Risk: Node 25 is an odd-numbered, non-LTS release with a short support window.
  Mitigation: Keep the major range bounded to `<26.0.0`, record the choice explicitly, and require a later approved migration for the next supported target.

- Risk: Native dependency `better-sqlite3` or the Next/Vitest/Playwright toolchain may fail under Node 25.
  Mitigation: Use the frozen lockfile first and run the full existing verification matrix; do not upgrade dependencies without a scope amendment.

- Risk: Documentation or inactive plans may retain historical Node 20 references.
  Mitigation: Update only active developer-facing runtime documentation in scope; preserve historical plans and prior change records as audit evidence.

## Open Questions

- None blocking Phase 1. The exact pin and bounded engine range above are the documented implementation assumptions and require approval.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
