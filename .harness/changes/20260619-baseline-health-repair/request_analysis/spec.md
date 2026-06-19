# Request Analysis Spec

Change ID: `20260619-baseline-health-repair`
Status: request_analysis

## Request Summary

Repair the current baseline health blockers before Phase 2 feature development continues. This change exists to restore a truthful, green repository baseline where the repo-scoped issues are fixed and the remaining local-only requirement is made explicit.

The narrowest safe repo-scoped repair includes one code fix in `apps/web/src/middleware.ts` for the existing lint failure and one documentation refresh in `docs/specs/global_unified_spec.md` so current-state statements match the actual repository. The local Node version mismatch is not a repo defect because `.nvmrc`, root `package.json`, and `apps/web/package.json` already pin Node 20 correctly; it remains an execution precondition for implementation and verification.

## Assumptions

- The user wants a new, isolated change rather than expanding `20260619-phase2-baseline-docs`.
- The goal is the smallest safe baseline repair, not Phase 2 feature work.
- `apps/web/src/middleware.ts` is the only repo-scoped lint blocker currently known from `.harness/skills/init.sh`.
- `docs/specs/global_unified_spec.md` may be updated to reflect current repo reality, but Playwright should still be described as not yet integrated if that remains true at implementation time.
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
- Verify baseline health under Node `20.10.0` using the repo's existing startup/verification path.
- Keep the change isolated from the uncommitted F2-00 docs.

### Out of Scope

- Editing `docs/README.md`, `docs/architecture/test_matrix.md`, `docs/specs/interface_spec.md`, or `docs/specs/phase1_scope.md`.
- Adding Playwright or E2E tests.
- Changing package manager, engines, `.nvmrc`, or dependency versions.
- API, auth, UI, schema, migration, CI workflow, or runtime feature work.
- Fixing any additional failures not directly encountered after switching to Node `20.10.0`, unless they force a scope amendment.

## Affected Areas

- API: none.
- Data model: none.
- Authorization: none expected.
- UI/UX: none.
- Tests: baseline verification only.
- Docs: `docs/specs/global_unified_spec.md`.
- Runtime/tooling: `apps/web/src/middleware.ts`.

## Acceptance Criteria

- [ ] Under Node `20.10.0`, `pnpm lint` no longer fails on `apps/web/src/middleware.ts`.
- [ ] `docs/specs/global_unified_spec.md` accurately reflects the current baseline for ESLint/Prettier, CI/test gate, workspace app dependencies, and Vitest integration.
- [ ] `docs/specs/global_unified_spec.md` does not overclaim Playwright integration if Playwright is still absent.
- [ ] No edits are made to the currently dirty F2-00 doc files outside this change scope.
- [ ] Verification evidence records the difference between repo-fixable issues and local-environment-only requirements.
- [ ] `.harness/skills/init.sh` or equivalent verification is rerun under Node `20.10.0`, and results are recorded.

## Risks

- Risk: Switching local Node versions is outside repo control and may be skipped or fail.
  Mitigation: Record Node `20.10.0` as an execution precondition and document any unavailable verification explicitly.

- Risk: Additional baseline failures may appear after the known lint issue is fixed.
  Mitigation: Keep this feature narrow. If another repo defect appears, record it and return to request analysis for scope amendment if needed.

- Risk: Dirty F2-00 docs may accidentally be staged together with this change.
  Mitigation: Keep file scope limited to `apps/web/src/middleware.ts`, `docs/specs/global_unified_spec.md`, and this change's harness artifacts.

## Open Questions

- None at request-analysis time. If verification under Node `20.10.0` reveals another repo-scoped blocker, it becomes a review or scope-amendment decision.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
