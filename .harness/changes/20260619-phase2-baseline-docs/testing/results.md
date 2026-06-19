# Testing Results

Change ID: `20260619-phase2-baseline-docs`
Status: testing_complete_with_baseline_exception

## Tests Added Or Updated

- Test: None.
  Covers: F2-00 is documentation-only; no application behavior or test code changed.

## Commands Run

```sh
.harness/skills/init.sh
```

Result: Failed on pre-existing baseline issues. Dependency install completed, but verification failed because the local Node version is `v25.2.1` while project engines require Node 20, and lint fails in existing `apps/web/src/middleware.ts` on `@typescript-eslint/consistent-type-imports`.

```sh
rg -n "尚未具备可执行测试入口|package.json 没有 scripts|当前仓库尚未具备|尚未集成 Vitest|尚未提供" docs/architecture/test_matrix.md docs/specs/global_unified_spec.md docs/README.md
```

Result: RED verification found stale assertions in `docs/architecture/test_matrix.md` and `docs/specs/global_unified_spec.md`.

```sh
rg -n "尚未具备可执行测试入口|no executable test entry" docs/architecture/test_matrix.md
```

Result: Passed by returning no matches after the update.

```sh
rg -n "pnpm (typecheck|lint|test|build|format:check|check)" docs/architecture/test_matrix.md
```

Result: Passed. Found all required root verification commands.

```sh
rg -n "Phase 2|/api/v1|Next.js route handlers|authorization|audit|realtime" docs/specs/interface_spec.md
```

Result: Passed. Found future-oriented Phase 2 API target wording and required boundaries.

```sh
git diff --check
```

Result: Passed.

## Verification Matrix

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| lint | n/a | `.harness/skills/init.sh` | failed_baseline | Not required for docs-only F2-00; existing app lint issue recorded. |
| typecheck | n/a | `.harness/skills/init.sh` | passed_before_lint_failure | Typecheck completed before lint failed. |
| unit | n/a | Not run | not_applicable | No behavior or test code changed. |
| integration | n/a | Not run | not_applicable | No cross-module behavior changed. |
| api_contract | yes | `rg -n "Phase 2\|/api/v1\|Next.js route handlers\|authorization\|audit\|realtime" docs/specs/interface_spec.md` | passed | Documentation contract note verified. |
| migration | n/a | Not run | not_applicable | No database changes. |
| smoke | n/a | Not run | not_applicable | No runtime behavior changed. |
| e2e | n/a | Not run | not_applicable | No UI behavior changed. |
| diff_check | yes | `git diff --check` | passed | Markdown diff has no whitespace errors. |

## Skipped Or Unavailable Checks

- Check: Full green `pnpm check`.
  Reason: `.harness/skills/init.sh` runs `pnpm check`, but the repository baseline is not green in the current environment because Node is `v25.2.1` and an existing middleware lint issue fails.
  Risk: Later implementation features should not proceed until the baseline is repaired or the local environment is switched to Node 20.

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| F2-00 | passed_with_baseline_exception | Feature-specific documentation verification passed; full baseline remains blocked by pre-existing environment/lint issue. |

## Untested Risks

- Risk: `docs/specs/global_unified_spec.md` still has stale current-state wording.
  Reason not covered: Outside approved F2-00 write scope.

## Follow-Up Test Recommendations

- Add a follow-up documentation consistency check for `docs/specs/global_unified_spec.md`.
- Fix Node 20 local runtime and existing middleware lint issue before implementing F2-01.

## Sprint Progress Update

Testing is complete for F2-00 with a documented baseline exception.
