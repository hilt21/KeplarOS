# Review Findings

Change ID: `20260711-story-draft-apply-hardening`  
Status: review

## Recommendation

Proceed.

The request analysis directly resolves the four blocking code-review findings:
migration execution, cross-initiator replay, concurrent retry handling, and
silent loss of malformed editable fields. The scope remains inside the
Web-first SQLite Beta and does not introduce a real planner or external action.

## Blocking Findings

- None.

## Non-Blocking Risks

- **Risk:** The legacy migration baseline detector might be too weak if it
  checks only one table.
  **Suggested mitigation:** The CLI test must create a database from
  0000–0012, and the runner must require all three agreed markers:
  `goal_spaces.acceptance_criteria`, `goal_spaces.cancelled_at`, and the
  `auth_credentials` table. Any other non-empty untracked database fails.
- **Risk:** The exact SQLite unique-error message can vary across drivers.
  **Suggested mitigation:** Check the SQLite error code and the named composite
  index; unit-test the recovery branch with an error object carrying both.
  Re-throw every other unique error.
- **Risk:** The 50/50/4000 request limits are new API constraints.
  **Suggested mitigation:** Document them in the Story draft interface and
  test both acceptance at the maximum and rejection at one over the maximum.

## Missing Tests

- Add a service assertion that a conflict recovery adds no second audit entry
  or realtime event, not only that Cards are not duplicated.
- Add API tests for invalid JSON, blank nested strings, and a 51st Card in
  addition to the type-mismatch cases.
- Add a migration CLI test for an unknown non-empty database and assert a
  non-zero exit without ledger entries.
- Add an E2E assertion for the initial Card created by the edited draft before
  creating any later Card through the command palette.

## Open Questions

- None. The explicit approval accepts the plan's project-owned migration runner,
  initiator-scoped key, request limits, and audit-only handling of output/risk
  planning fields.

## Reviewed Artifacts

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `sprint_progress.md`
- `docs/superpowers/plans/2026-07-11-story-draft-apply-hardening.md`
- code-review findings for `d0eeb4b`

## Sprint Progress Update

Set Review to Done, retain no blockers, and enter implementation with only
F-001 selected. The first task must establish the migration command and its
CLI tests before any service code depends on the new composite index.
