# Review Findings

Change ID: `20260711-story-draft-cards`
Status: review_complete

## Blocking Findings

### F-001 — Ephemeral drafts still need durable application idempotency

The approved choice keeps Story drafts ephemeral, but the approved acceptance
criteria require repeated apply requests not to duplicate Goal Spaces or Cards.
Client-side disabling cannot guarantee this across retry, refresh, duplicate
submission, or network ambiguity. The existing schema has no unique application
key or application record that can make the operation durable and atomic.

**Required decision:** approve one of these server-side idempotency mechanisms:

1. Add a narrowly-scoped `story_application_id` unique value on the created
   Goal Space (recommended). It stores only the already-applied request key, not
   the editable Story draft.
2. Add a dedicated applied-story record/table, which is more auditable but adds
   a new persisted lifecycle and exceeds the recommended minimal slice.
3. Relax the idempotency acceptance criterion. Not recommended: it weakens the
   audit's required no-duplicate guarantee.

## Non-Blocking Risks

- The existing Backlog Refiner contract describes a richer multi-board result.
  The approved first slice should produce one `initial` Node Board and one or
  more editable Card drafts; it must not claim planning quality equivalent to a
  real LLM.
- A single transaction can write Goal Space, initial Board, Cards, one
  `story_draft.applied` audit entry, and one realtime event. Per-Card creation
  audit records are deliberately deferred to avoid over-expanding the feature.
- The actual current UI supports basic Goal Space creation. The new flow should
  replace that entry point rather than leave two competing creation paths.

## Missing Verification Coverage

- Tests must include a simulated repeated apply with the same idempotency key,
  plus a failed transaction check showing no Goal Space/Board/Card rows survive.
- Browser E2E must explicitly assert that the generated result is labelled
  deterministic/demo and has not auto-executed any Card.

## Open Questions

- Approve the recommended unique `story_application_id` field, or choose a
  different mechanism above.

## Recommendation

F-001 was resolved by human approval on 2026-07-11: use the recommended unique
`story_application_id` on the created Goal Space. Proceed with the single
approved feature.
