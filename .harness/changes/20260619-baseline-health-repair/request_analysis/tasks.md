# Request Analysis Tasks

Change ID: `20260619-baseline-health-repair`
Status: request_analysis

## Implementation Tasks

- [ ] Fix the type-only import lint issue in `apps/web/src/middleware.ts`.
  - Verify: `pnpm lint` under Node `20.10.0` no longer reports `@typescript-eslint/consistent-type-imports` for `apps/web/src/middleware.ts`.

- [ ] Refresh stale current-state wording in `docs/specs/global_unified_spec.md`.
  - Verify: `rg -n "尚未提供 \\.eslintrc|尚未具备应用测试门禁|package.json 暂无依赖|尚未集成 Vitest" docs/specs/global_unified_spec.md` returns no stale matches after the update.

- [ ] Preserve truthful wording for Playwright status in `docs/specs/global_unified_spec.md`.
  - Verify: `rg -n "Playwright" docs/specs/global_unified_spec.md`

## Test Tasks

- [ ] RED: reproduce the known baseline failure with the current repo before code edits.
  - Verify: run `.harness/skills/init.sh` or `pnpm lint` and capture the existing `middleware.ts` lint failure.

- [ ] GREEN: rerun lint after fixing `middleware.ts`.
  - Verify: `pnpm lint` under Node `20.10.0`

- [ ] Rerun the standard startup/verification path after repo-scoped fixes.
  - Verify: `.harness/skills/init.sh` under Node `20.10.0`

- [ ] Run diff hygiene checks.
  - Verify: `git diff --check`

## Documentation Tasks

- [ ] Keep the new doc wording anchored to current repo state, not aspirational future state.
  - Verify: changed statements are traceable to existing files in the repo.

- [ ] Avoid touching the dirty F2-00 docs.
  - Verify: `git diff --name-only` for tracked changes does not include `docs/README.md`, `docs/architecture/test_matrix.md`, `docs/specs/interface_spec.md`, or `docs/specs/phase1_scope.md` as part of this change's intended scope.

## Sequencing

1. Step: Confirm execution precondition by using Node `20.10.0`.
   Verify: `node --version` reports `v20.10.0`.
2. Step: Reproduce the lint failure.
   Verify: `pnpm lint` or `.harness/skills/init.sh` shows the existing `middleware.ts` error.
3. Step: Write the minimal `middleware.ts` fix.
   Verify: targeted lint rerun passes for that file/repo.
4. Step: Update `docs/specs/global_unified_spec.md`.
   Verify: stale current-state wording is removed and current repo state is described accurately.
5. Step: Rerun baseline verification.
   Verify: `.harness/skills/init.sh` or documented equivalent under Node `20.10.0`.
6. Step: Record results and any remaining blockers.
   Verify: testing/results.md and sprint_progress.md are updated during later phases.

## Dependencies

- `.nvmrc`
- `package.json`
- `apps/web/package.json`
- `apps/web/src/middleware.ts`
- `docs/specs/global_unified_spec.md`
- `.harness/skills/init.sh`

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
