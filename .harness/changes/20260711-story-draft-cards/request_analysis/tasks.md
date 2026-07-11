# Request Analysis Tasks

Change ID: `20260711-story-draft-cards`
Status: request_analysis

## Implementation Tasks

- [ ] Resolve the three draft lifecycle questions and freeze the smallest
  server/client contract.
  - Verify: chosen lifecycle has ownership, idempotency, and cancellation rules.
- [ ] Add a schema-valid deterministic Story-draft generation boundary.
  - Verify: no external I/O and invalid output cannot proceed to apply.
- [ ] Add the initiator Story preview/editor and explicit application workflow.
  - Verify: all relevant fields are editable and UI conforms to `DESIGN.md`.
- [ ] Apply an approved draft atomically into a new Goal Space and initial Cards.
  - Verify: business records, audit records, and realtime events remain consistent.

## Test Tasks

- [ ] Add validation and state tests for valid, invalid, abandoned, and repeated draft application.
  - Verify: repeated apply does not duplicate Cards.
- [ ] Add API/authorization/audit/SSE tests.
  - Verify: only the initiator applies and no partial write survives failure.
- [ ] Add component and browser happy-path coverage.
  - Verify: goal → edit Story → apply → see initial Cards without seeded API setup.

## Documentation Tasks

- [ ] Update the relevant PRD, agent contract, interface, data, realtime, and
  test documents after the contract is implemented.
  - Verify: docs label deterministic draft generation accurately.

## Sequencing

1. Resolve draft lifecycle and schema questions.
   Verify: review approves one explicit contract.
2. Implement contract and tests before UI.
   Verify: API/authorization/audit behavior passes.
3. Implement editor/apply UI and browser path.
   Verify: UI and E2E pass.
4. Reconcile product and technical documentation.
   Verify: no document claims real AI/external execution.

## Dependencies

- Explicit human approval after this request analysis.
- Product-owner answer to the three open questions, or approval of the stated
  recommendations.

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
