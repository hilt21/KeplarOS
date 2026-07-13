# Testing Results

Change ID: `20260713-node25-migration`
Status: completed_with_documented_exception

## Tests Added Or Updated

- None. This feature changes only runtime declarations and active documentation; existing verification commands cover the Node 25 compatibility risk.

## Commands Run

```sh
node --version
pnpm install --frozen-lockfile
pnpm check
pnpm smoke
pnpm e2e
git diff --check
```

Results:

- Runtime: Node `v25.2.1`, pnpm `11.5.1`.
- Frozen install passed and emitted no unsupported-engine warning from `keplar` or `@keplar/web`. A pnpm update metadata fetch failed due restricted network access, but installation completed successfully and did not change the lockfile.
- `pnpm check`: typecheck passed; ESLint passed with 25 existing warnings; Vitest passed 68 files / 706 tests; production build passed. The final Prettier gate failed on seven files outside this change.
- `pnpm smoke`: 1 file / 3 tests passed.
- `pnpm e2e`: first run was sandbox-blocked before the server could listen. With local test-server permission, the first runnable attempt had 3/4 pass and a login timeout; the immediate full rerun passed 4/4.
- `git diff --check`: passed.

## Verification Matrix

| Check | Required | Command | Result | Notes |
|------|----------|---------|--------|-------|
| lint | yes | `pnpm lint` via `pnpm check` | passed_with_warnings | 25 pre-existing warnings; no errors. |
| typecheck | yes | `pnpm typecheck` via `pnpm check` | passed | Completed under Node 25.2.1. |
| unit | yes | `pnpm test` via `pnpm check` | passed | 68 files / 706 tests passed. |
| integration | no | existing Vitest suite | passed | Included in the full Vitest run. |
| api_contract | n/a | — | not_applicable | No API change. |
| migration | yes | `pnpm install --frozen-lockfile` | passed | Runtime contract validated without lockfile changes or KEPLAR engine warnings. |
| smoke | yes | `pnpm smoke` | passed | 3 tests passed. |
| e2e | yes | `pnpm e2e` | passed | Full rerun: 4 Playwright tests passed. |
| format | yes | `pnpm format:check` via `pnpm check` | documented_exception | Existing formatting failures in seven files outside F-001. |

## Skipped Or Unavailable Checks

- Check: first E2E attempt in the standard sandbox.
  Reason: sandbox disallowed the temporary test server from listening on `0.0.0.0:3000`.
  Risk: none remaining; the suite was rerun with approved local-port permission and passed 4/4.

## Feature Test Status

| Feature ID | Test Status | Notes |
|-----------|-------------|-------|
| F-001 | passed | Required Node 25 runtime checks passed; unrelated Prettier exception documented. |

## Untested Risks

- Risk: Node 25's non-LTS support window ends before a future operational deployment.
  Reason not covered: lifecycle policy is outside repository-level test execution.

## Follow-Up Test Recommendations

- Create a separate scoped cleanup for the seven Prettier failures if a globally green `pnpm check` gate is required.
- Revalidate CI after merge; it will use the updated `.nvmrc` automatically.

## Sprint Progress Update

F-001 implementation and required Node 25 verification are complete. Delivery may proceed with the existing Prettier failures preserved as an out-of-scope documented exception.
