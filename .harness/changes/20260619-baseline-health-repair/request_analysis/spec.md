# Request Analysis Spec

Change ID: `20260619-baseline-health-repair`
Status: request_analysis

## Request Summary

Repair the current baseline health blockers before Phase 2 feature development continues. This change exists to restore a truthful, green repository baseline where the repo-scoped issues are fixed and the remaining local-only requirement is made explicit.

The original narrow repo-scoped repair included one code fix in `apps/web/src/middleware.ts` for the existing lint failure and one documentation refresh in `docs/specs/global_unified_spec.md` so current-state statements match the actual repository. During implementation, `.harness/skills/init.sh` progressed past the known lint issue and exposed a second repo-scoped baseline blocker: `pnpm format:check` fails on 12 pre-existing files. The user approved a scope amendment so this change now also includes the minimal formatting cleanup required to restore the startup path.

After the formatting cleanup, the startup path advanced again and exposed a third repo-scoped baseline blocker: `.harness/skills/init.sh` unconditionally requires `cargo` whenever root `Cargo.toml` exists, even though the current Rust workspace is still placeholder-only and not part of the active Phase 2 runtime. The user approved a second scope amendment so this change now also includes the smallest init-script fix needed to skip Rust verification when the Rust workspace still contains only placeholder sources.

The local Node version mismatch is still not a repo defect because `.nvmrc`, root `package.json`, and `apps/web/package.json` already pin Node 20 correctly. Exact Node `20.10.0` verification remains preferred but may be recorded as unavailable when the machine lacks a real Node 20 install.

## Assumptions

- The user wants a new, isolated change rather than expanding `20260619-phase2-baseline-docs`.
- The goal is the smallest safe baseline repair, not Phase 2 feature work.
- `apps/web/src/middleware.ts` is the only repo-scoped lint blocker currently known from `.harness/skills/init.sh`.
- `docs/specs/global_unified_spec.md` may be updated to reflect current repo reality, but Playwright should still be described as not yet integrated if that remains true at implementation time.
- The approved scope is amended to include only the pre-existing formatting cleanup required by `pnpm format:check`.
- The approved scope is amended again to include the smallest `.harness/skills/init.sh` fix needed for placeholder Rust crates.
- The four dirty F2-00 docs (`docs/README.md`, `docs/architecture/test_matrix.md`, `docs/specs/interface_spec.md`, `docs/specs/phase1_scope.md`) must remain untouched in this change.

## Scope

### In Scope

- Fix the type-only import lint issue in `apps/web/src/middleware.ts`.
- Refresh stale current-state language in `docs/specs/global_unified_spec.md`:
  - ESLint/Prettier exist.
  - app CI/test gate exists.
  - workspace app dependencies exist.
  - Vitest is integrated.
  - Playwright is still not integrated, unless repo state changes before implementation.
- Apply the minimal Prettier cleanup required for these existing `format:check` failures:
  - `apps/web/__tests__/audit/redact.test.ts`
  - `apps/web/__tests__/auth/password.test.ts`
  - `apps/web/__tests__/authorization/card.test.ts`
  - `apps/web/__tests__/headers.test.ts`
  - `apps/web/__tests__/middleware.test.ts`
  - `apps/web/__tests__/state-machine/goal-space.test.ts`
  - `apps/web/db/schema.ts`
  - `apps/web/src/lib/audit/redact.ts`
  - `apps/web/src/lib/auth/password.ts`
  - `apps/web/src/lib/authorization/goal-space.ts`
  - `apps/web/src/lib/security/headers.ts`
  - `apps/web/src/middleware.ts`
- Verify baseline health using the repo's existing startup/verification path, and record exact Node `20.10.0` verification as unavailable if the machine still lacks a real Node 20 runtime.
- Update `.harness/skills/init.sh` so placeholder-only Rust workspace sources do not force `cargo` verification during this project's current Web-first baseline.
- Keep the change isolated from the uncommitted F2-00 docs.

### Out of Scope

- Editing `docs/README.md`, `docs/architecture/test_matrix.md`, `docs/specs/interface_spec.md`, or `docs/specs/phase1_scope.md`.
- Adding Playwright or E2E tests.
- Changing package manager, engines, `.nvmrc`, or dependency versions.
- API, auth, UI, schema, migration, CI workflow, or runtime feature work.
- Fixing any additional failures beyond the known lint issue, the stale `global_unified_spec.md` wording, the approved pre-existing formatting failures, and the approved placeholder-Rust init-script fix, unless they force another scope amendment.

## Affected Areas

- API: none.
- Data model: none.
- Authorization: none expected.
- UI/UX: none.
- Tests: baseline verification only.
- Docs: `docs/specs/global_unified_spec.md`.
- Runtime/tooling: `apps/web/src/middleware.ts`, approved formatting-only cleanup across 12 pre-existing files, `.harness/skills/init.sh`.

## Acceptance Criteria

- [ ] `pnpm lint` no longer fails on `apps/web/src/middleware.ts`.
- [ ] `docs/specs/global_unified_spec.md` accurately reflects the current baseline for ESLint/Prettier, CI/test gate, workspace app dependencies, and Vitest integration.
- [ ] `docs/specs/global_unified_spec.md` does not overclaim Playwright integration if Playwright is still absent.
- [ ] The approved 12-file formatting cleanup is applied and `pnpm format:check` no longer fails on those pre-existing files.
- [ ] `.harness/skills/init.sh` skips Rust verification when the Rust workspace is still placeholder-only, instead of failing on missing `cargo`.
- [ ] No edits are made to the currently dirty F2-00 doc files outside this change scope.
- [ ] Verification evidence records the difference between repo-fixable issues and local-environment-only requirements.
- [ ] `.harness/skills/init.sh` or equivalent verification is rerun, and exact Node `20.10.0` verification is either demonstrated or explicitly recorded as unavailable on this machine.

## Risks

- Risk: Switching local Node versions is outside repo control and may be skipped or fail.
  Mitigation: Record Node `20.10.0` as an execution precondition and document any unavailable verification explicitly.

- Risk: Additional baseline failures may appear after the known lint issue is fixed.
  Mitigation: Keep this feature narrow. The only approved expansions are the 12-file formatting cleanup and the placeholder-Rust init-script fix. Any further failures require another scope amendment.

- Risk: Dirty F2-00 docs may accidentally be staged together with this change.
  Mitigation: Keep file scope limited to `apps/web/src/middleware.ts`, `docs/specs/global_unified_spec.md`, and this change's harness artifacts.

## Open Questions

- None at request-analysis time. If verification reveals another repo-scoped blocker beyond the approved formatting cleanup and placeholder-Rust init-script fix, it becomes a new review or scope-amendment decision.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
