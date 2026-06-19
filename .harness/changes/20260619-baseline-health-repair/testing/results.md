# Testing Results

Change ID: `20260619-baseline-health-repair`
Status: testing_complete

## Tests Added Or Updated

- Test: None added.
  Covers: This change fixes an existing lint issue, aligns documentation, applies formatting-only cleanup, and adjusts harness startup behavior.

## Commands Run

```sh
pnpm lint
```

Result: Passed after changing `NextRequest` to a type-only import in `apps/web/src/middleware.ts`.

```sh
pnpm format:check
```

Result: Passed after the approved formatting-only cleanup across 12 files.

```sh
git diff --check
```

Result: Passed.

```sh
.harness/skills/init.sh
```

Result: Completed successfully in the current environment. Web typecheck, lint, Vitest, build, and format:check all passed. Rust verification was skipped with a clear message because `crates/**/*.rs` are placeholder/comment-only. Node engine warnings remained because the machine is still on `v25.2.1`.

## Verification Matrix

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| lint | yes | `pnpm lint` | passed | Known repo-scoped lint failure is fixed. |
| typecheck | yes | `.harness/skills/init.sh` | passed | Root `pnpm check` runs web typecheck successfully. |
| unit | n/a | Not run separately | not_applicable | No new logic branch required dedicated unit test changes. |
| integration | n/a | Not run separately | not_applicable | No new cross-module runtime behavior beyond startup-script gating. |
| api_contract | n/a | Not run | not_applicable | No API contract change. |
| migration | n/a | Not run | not_applicable | No schema or migration change. |
| smoke | n/a | Not run | not_applicable | No app behavior change requiring separate smoke coverage. |
| e2e | n/a | Not run | not_applicable | No E2E surface change. |
| diff_check | yes | `git diff --check` | passed | No whitespace or patch hygiene errors. |
| startup_path | yes | `.harness/skills/init.sh` | passed_with_environment_warnings | Startup path now completes. |
| format_check | yes | `pnpm format:check` | passed | Approved formatting-only cleanup is complete. |
| init_script | yes | `.harness/skills/init.sh` | passed | Rust placeholder detection works for the current repo state. |

## Skipped Or Unavailable Checks

- Check: Exact Node `20.10.0` verification.
  Reason: `.nvmrc` is correct, but this machine does not currently expose a real Node `20.10.0` runtime; the apparent `node@20` path resolves to Node `25.2.1`.
  Risk: Engine warnings remain until the local runtime is corrected.

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| F2-00B | passed | Acceptance criteria satisfied with recorded local-environment exception for exact Node 20 parity. |

## Untested Risks

- Risk: If Rust crates become substantive later, placeholder detection in `.harness/skills/init.sh` must stop skipping and should run `cargo test`.
  Reason not covered: Current repo state still contains placeholder-only Rust sources.

## Follow-Up Test Recommendations

- Re-run `.harness/skills/init.sh` under a real Node `20.10.0` runtime once the local environment is corrected.
- If Rust implementation begins, add a harness regression check ensuring substantive `.rs` files no longer trigger the placeholder skip path.

## Sprint Progress Update

Testing is complete. The feature passes with environment warnings only.
