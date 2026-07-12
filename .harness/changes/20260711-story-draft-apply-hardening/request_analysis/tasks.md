# Request Analysis Tasks

Change ID: `20260711-story-draft-apply-hardening`  
Status: request_analysis

## Implementation Tasks

- [ ] Add and test the ledger-backed SQLite migration command.
  - Verify: it supports empty and verified pre-0013 databases, records exactly
    applied files, and fails closed for unknown non-empty schemas.
- [ ] Add 0014 and update the schema to enforce initiator-scoped application
  keys.
  - Verify: global key index is absent after migration and the composite index
    is present.
- [ ] Scope Story application lookup to the initiator and recover only the
  named unique-key race.
  - Verify: cross-initiator key reuse creates an independent workspace and
    same-initiator replay creates no duplicate records.
- [ ] Strictly validate and bound editable Story input.
  - Verify: no malformed element is silently filtered; every rejected request
    has the standard 400 envelope and no persistent side effect.
- [ ] Preserve accepted output requirements/risk hints in audit details and
  make only the minimum UI error handling correction.
  - Verify: audit details retain accepted values; invalid JSON and server
    validation errors are distinguishable in the form.

## Test Tasks

- [ ] Add migration CLI tests using the actual `db:migrate` command.
  - Verify: the test inspects SQLite columns, indexes, and migration ledger.
- [ ] Add Story-draft service/integration tests for scoped keys, conflict
  recovery, zero duplicate audit/realtime records, audit details, and limits.
  - Verify: all assertions use an actual migrated SQLite database except the
    deliberately injected unique-conflict branch.
- [ ] Add route-contract tests for 401, 403, malformed JSON/fields, 201 create,
  and 200 replay.
  - Verify: strict parser failure never calls the service.
- [ ] Extend component and Playwright tests.
  - Verify: API error text is shown and an edited Card title is visible before
    a later command-palette Card is created.

## Documentation Tasks

- [ ] Update the interface, database, realtime, and AI-agent contracts.
  - Verify: they describe scoped idempotency, invalid-input behavior, the
    composite index, Story apply event data, and audit-only planning fields.
- [ ] Record review resolution and test evidence in this change's Harness
  artifacts.
  - Verify: historical `20260711-story-draft-cards` evidence remains intact.

## Sequencing

1. Implement and verify the migration command, then add the forward index
   migration.
   Verify: schema availability is proven before service code depends on it.
2. Implement scoped idempotency and conflict recovery.
   Verify: service/integration tests prove no cross-user leak or duplicate.
3. Implement strict parsing, bounds, and audit trace payload.
   Verify: API-contract and atomicity tests pass.
4. Prove user-visible edited-draft behavior and update contracts.
   Verify: component, E2E, and documentation evidence agree.
5. Run the full verification matrix and write delivery records.
   Verify: no blocking review finding remains.

## Dependencies

- Explicit human approval after this request analysis.
- The approved plan:
  `docs/superpowers/plans/2026-07-11-story-draft-apply-hardening.md`.
- Existing raw migrations 0000–0013 and the migration behavior verified by the
  code review.

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
