# Request Analysis Spec

Change ID: `20260711-story-draft-cards`
Status: request_analysis

## Request Summary

Define the next P0 product slice: turn a human-entered business goal into an
editable structured Story and draft Cards, then require the initiator to review
and explicitly apply that draft to a Goal Space. This closes the highest-impact
gap identified by the 2026-07-11 product/implementation audit without claiming
real LLM or external execution capability.

## Assumptions

- The current Beta remains Web-first and uses the existing Next.js, TypeScript,
  Drizzle, SQLite, authorization, audit, and SSE boundaries.
- Initial Story/Card drafts may be deterministic fixtures or a human-authored
  structured form; a real LLM is explicitly not implied by this feature.
- A draft must not mutate an existing Goal Space or create persistent Cards
  until an authorized initiator explicitly applies it.
- Each applied request stores a unique `story_application_id` on the created
  Goal Space. This is durable idempotency evidence only; the editable Story
  draft remains ephemeral.
- This feature does not settle role-specific views, health endpoints, real token
  metering, or external executor integration.

## Scope

### In Scope

- A structured Story draft model containing goal, constraints, acceptance
  criteria, Card drafts, dependencies, output requirements, and risk hints.
- A Web flow for initiator input, draft preview/editing, and explicit apply.
- Creation of initial Cards only after authorized confirmation of a draft.
- Audit and realtime events for draft application and generated Cards.
- Clear failure/empty-state behavior when draft generation cannot produce valid
  structured output.
- Contract, state, authorization, service, UI, and E2E acceptance criteria.

### Out of Scope

- Real LLM, MCP, ACP, A2A, network, shell, filesystem, Git, or external-system
  execution.
- Automated task execution after draft application.
- Role-specific workspace redesign, desktop/Rust work, enterprise SSO,
  multi-tenancy, production deployment, or token accounting.
- Retrospective repair of historical Harness evidence.

## Affected Areas

- API: new or extended Goal Space draft/apply contract.
- Data model: draft persistence decision required; Cards remain the authoritative
  applied task records.
- Authorization: only the Goal Space initiator may apply a draft.
- UI/UX: Goal Space creation flow, Story editor/preview, explicit apply action;
  must comply with `DESIGN.md`.
- Tests: state/validation, API contract, authorization, audit/realtime, UI, and
  browser happy path.
- Docs: PRD §15, AI agent contract, interface/database specs as needed after a
  decision on draft persistence.

## Acceptance Criteria

- [ ] An initiator can supply a business goal and obtain a schema-valid Story draft.
- [ ] The initiator can edit every product-relevant Story field before applying it.
- [ ] Applying a draft is explicit, authorized, idempotently guarded, and creates
      a Goal Space/Card result that can be audited and observed through SSE.
- [ ] Invalid or unavailable generation never creates partial Cards; the user can
      correct the structured draft or abandon it.
- [ ] The feature makes no external I/O and does not auto-execute generated Cards.
- [ ] Contracts, documentation, and verification distinguish fixture behavior
      from future real-AI behavior.

## Risks

- Risk: persisting draft state introduces a new lifecycle without a clear owner.
  Mitigation: decide during review whether drafts are ephemeral client input or
  a first-class server resource before implementation.
- Risk: applying a draft may duplicate Cards on retry.
  Mitigation: define an idempotency key/application state and test repeat apply.
- Risk: a fixture may be mistaken for AI planning.
  Mitigation: label the source and UI output explicitly as deterministic/demo
  until a real provider is separately approved.

## Open Questions

- Resolved 2026-07-11: drafts are one-session previews; application creates a
  new Goal Space only; it creates one initial Node Board and uses a unique
  `story_application_id` for server-side idempotency.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
