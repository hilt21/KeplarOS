# TESTING_BASELINE

## Current Testing State

The repository has a documented testing strategy but almost no implemented test infrastructure.

## Documented Test Layers

From `docs/architecture/test_matrix.md`:

| Test Type | Purpose | Planned Tooling |
|---|---|---|
| Functional | Verify core features | Jest / Vitest |
| Integration | Verify module collaboration | Jest + Supertest |
| E2E | Verify complete user flows | Playwright |
| Boundary | Verify edge cases and extreme input | Jest |
| Exception | Verify error handling | Jest |
| Performance | Verify response and load behavior | k6 / Playwright |

Coverage targets in the documentation:

- Unit coverage: `>= 80%`
- Integration coverage: `>= 60%`
- E2E: core paths covered

## Actual Test Entry Points

| Area | Current State |
|---|---|
| `package.json` | No scripts, dependencies, or devDependencies |
| Rust workspace | Standard Cargo workspace exists, but no explicit test scripts |
| Test files | No actual `*test*`, `*spec*`, or `tests/**` files found, except documentation |
| Rust tests | No `#[test]`, `#[cfg(test)]`, or `mod tests` found in current placeholder source |
| CI | `.github/workflows/card-verify.yml` validates changed YAML files only |

## CI Baseline

Existing workflow:

- Name: `Card YAML Validation`
- Trigger: pull requests and push to `main`
- Installs `jq`, `jsonschema`, and `yq`
- Finds changed YAML files
- Validates YAML converted to JSON against `docs/development-guidelines/card-schema.json`
- Optionally posts audit webhook on success

Updated after spec pass:

- `docs/development-guidelines/card-schema.json` now exists.
- The workflow now limits validation to `docs/cards/**/*.yml` and `docs/cards/**/*.yaml`.

## Coverage Gaps

| Gap | Impact |
|---|---|
| No runnable Node test scripts | Documented Vitest/Jest/Playwright strategy cannot run |
| No test dependencies | Test tooling is not installed/configured |
| No Rust tests | Domain/state/API behavior cannot be verified |
| No API contract tests | Interface spec may drift from implementation once routes are added |
| No database migration/schema tests | Drizzle config points to missing schema files |
| No security/permission tests | RBAC and confirmation gates are not testable yet |
| No E2E tests | Happy path, blocked path, and confirmation path are documentation-only |
| Card YAML workflow has no sample cards | Schema exists, but no `docs/cards/` examples exist yet |

## Recommended Read-Only Verification Commands

These commands are read-only and useful for future audits:

```sh
rg --files -g '*test*' -g '*spec*' -g 'tests/**' -g '**/tests/**'
rg -n '#\[test\]|#\[cfg\(test\)\]|mod tests|describe\(|it\(|test\(' crates src apps
rg -n 'vitest|jest|playwright|supertest|k6|cargo test|nextest|tarpaulin|llvm-cov|coverage|api:test' .
rg --files -g 'card-schema.json' -g 'docs/development-guidelines/**'
sed -n '1,220p' package.json
sed -n '1,220p' Cargo.toml
sed -n '1,220p' .github/workflows/card-verify.yml
```

## First Testing Baseline To Establish

Before feature implementation gets broad, the first useful baseline would be:

1. Spec consistency tests for shared enums: card states, goal states, confirmation states, event names.
2. Domain tests for Goal Space and Card state transitions.
3. Authorization matrix tests for endpoint permissions.
4. Human confirmation gate tests for `execute`, `unblock`, and `complete`.
5. API contract tests matching `docs/specs/interface_spec.md`.
6. Migration/schema tests for the Drizzle schema once created.

## Baseline Added To Main Specs

`docs/architecture/test_matrix.md` now defines a first-phase minimum test gate:

- State enum consistency.
- Card state machine.
- Human confirmation gate.
- Authorization matrix.
- Audit transaction behavior.
- Database schema creation.
