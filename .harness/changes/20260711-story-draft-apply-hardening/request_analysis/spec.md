# Request Analysis Spec

Change ID: `20260711-story-draft-apply-hardening`  
Status: request_analysis

## Request Summary

Apply the remediation plan in
`docs/superpowers/plans/2026-07-11-story-draft-apply-hardening.md` to the
deterministic Story draft flow delivered in `d0eeb4b`. The preceding code
review found that the feature is not safely deployable through its declared
migration command, scopes idempotency globally instead of to the initiating
user, can return a 500 during a unique-key retry race, and silently discards
malformed editable Story fields.

The change makes the existing Web Beta flow honest and safe without changing
its product boundary: drafts remain deterministic and no-I/O; the user still
explicitly applies a draft before any Card is created.

## Assumptions

- The current product remains the Web-first SQLite Beta described in
  `docs/specs/prd.md` §15 and `docs/architecture/system_architecture.md`.
- The existing raw `.sql` migration sequence is the actual historical source
  of schema evolution. The empty Drizzle journal cannot be treated as a valid
  deploy path.
- Idempotency belongs to the authenticated initiator, not to every user with
  the same client-provided string.
- Story drafts remain ephemeral. No new draft table, lifecycle, LLM provider,
  or external executor is needed for this remediation.
- The affected UI retains the constraints from `DESIGN.md`: token-only
  styling, no visual redesign, and no hard-coded colors.

## Scope

### In Scope

- A project-owned SQLite migration command with a ledger for fresh databases
  and verified 0000–0012 local databases.
- Forward migration from global `story_application_id` uniqueness to the
  composite `(initiator_id, story_application_id)` unique index.
- Initiator-scoped Story application lookup and recovery of only the expected
  application-key unique conflict as an idempotent replay.
- Strict, bounded validation for every editable Story field, including nested
  acceptance evidence and Card count.
- Audit preservation of accepted `output_requirements` and `risk_hints`.
- Migration, service, API-contract, component, and browser tests for the
  reviewed failure paths.
- Contract and architecture-data documentation alignment.

### Out of Scope

- A real LLM, natural-language understanding provider, MCP, ACP, A2A, network,
  shell, filesystem, Git, or third-party side effect.
- Automatic Card execution after apply.
- A persisted Story-draft resource, role-view redesign, desktop/Rust work,
  enterprise SSO, multi-tenancy, deployment platform, or token metering.
- Rewriting the historical Story-draft Harness record or Git history.

## Affected Areas

- **API:** `POST /api/v1/story-drafts/apply` parsing and 201/200/4xx contract.
- **Data model:** Goal Space application key index and migration delivery path.
- **Authorization:** initiator-scoped replay behavior.
- **UI/UX:** apply error display and proof that a user edit affects the initial
  Card; no new visual scope.
- **Tests:** migration CLI, integration/service, route contract, component, and
  Playwright coverage.
- **Docs:** interface, database, realtime, AI contract, and Harness evidence.

## Acceptance Criteria

- [ ] `pnpm --filter @keplar/web db:migrate` applies the checked-in migration
      sequence to an empty SQLite database and applies 0013/0014 to a verified
      0000–0012 database.
- [ ] The same `story_application_id` used by two initiators never exposes or
      reuses another initiator's Goal Space; each initiator can create its own
      workspace.
- [ ] A same-initiator unique-key conflict returns the existing workspace with
      HTTP 200 and `applied: false`, with exactly one domain/audit/event set.
- [ ] Every supplied Story field is validated element-by-element; malformed
      input returns `INVALID_FIELD` (400) and writes no Goal Space, Card,
      audit entry, or realtime event.
- [ ] The API caps drafts at 50 Cards, 50 values in each top-level string
      collection, and 4,000 characters per editable string.
- [ ] Accepted output requirements and risk hints are retained in immutable
      audit details; the feature remains deterministic/no-I/O/non-executing.
- [ ] Browser coverage proves that an edited draft creates the edited initial
      Card, and product/architecture contracts describe the actual behavior.

## Risks

- **Risk:** A runner that guesses legacy schema state could skip a needed
  migration.
  **Mitigation:** Baseline only when the exact verified pre-0013 shape exists;
  any other non-empty untracked database fails closed.
- **Risk:** Catching all SQLite unique errors would hide unrelated Card, Board,
  audit, or event failures.
  **Mitigation:** Recover only the named composite application-key index, then
  rethrow every other error.
- **Risk:** Input limits may reject a legitimate large plan.
  **Mitigation:** Limit only this synchronous demo apply boundary; move a
  larger planning workflow to a separately approved persisted-draft/worker
  design.
- **Risk:** Audit detail could become a new de facto Story store.
  **Mitigation:** Persist only the two planning arrays required for traceability;
  keep authoritative Goal Space/Card fields in existing domain records.

## Open Questions

- None for this remediation. The plan freezes initiator-scoped keys, the
  project-owned runner, and the stated size limits. A change to any of these is
  a scope amendment requiring renewed review.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
