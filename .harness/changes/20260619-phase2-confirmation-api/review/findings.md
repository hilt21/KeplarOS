# Review Findings

Change ID: `20260619-phase2-confirmation-api`
Status: review

## Recommendation

**Proceed with two corrections.**

The F2-06 request analysis maps the two documented endpoints in `docs/specs/interface_spec.md § 6` to the existing `human_confirmations`, `cards`, `goal_spaces`, and `state_transitions` schema, the F-003 authorization helper (`canDecideConfirmation`), the F-002 state-machine module (with the `human_confirm` / `human_reject` triggers already in `CARD_TRANSITIONS`), the F2-05 card repository (which already exposes `getCardContext`, `updateCardState`, `insertStateTransition`), and the F-004 `runWithAudit` transaction wrapper. The scope is bounded; the open questions are non-blocking; no new auth, state-machine, audit, or transaction primitives are introduced.

Two spec corrections are required before implementation begins. Both are minor and do not affect the test plan.

## Blocking Findings

- **F1. The spec text says `rejection` "moves card to blocked" but the schema's `decisionReason` is the documented reject reason, and the spec's `card.blocked_reason` is set by the rejection path.**
  Evidence: `interface_spec.md § 6.2` body says "确认拒绝后,卡片进入 `blocked`,并记录拒绝原因" — the reject reason goes to `decision_reason` (the confirmation's reject reason) per `DecideConfirmationRequest.reason`. The card's `blocked_reason` is a separate field set by the block endpoint, not the rejection path. My spec.md T3 conflates them — it says "decision_reason records the reject reason" which is correct, but the response field is `decision.reason`, not the card's `blocked_reason`.
  Required action: The implementation must write `decisionReason` on the confirmation row only. It must NOT update `card.blocked_reason` (the card's blocked_reason is for manual / domain-block reasons; the confirmation's reject reason is a separate signal). The `state_transitions.row.reason` is also written with the reject reason. Pin with a contract test that asserts the card's `blocked_reason` is null after a confirmation rejection (the state transitions to `blocked` but the reason lives on the confirmation).

- **F2. The reject path's state transition `(review|done|...|cancelled, blocked, human_reject)` is in `CARD_TRANSITIONS` only for non-terminal `from` states.**
  Evidence: `apps/web/src/lib/state-machine/card.ts:74-85` defines 8 `*→blocked` tuples with `trigger: 'human_reject'`, all for non-terminal `from` states. The `isTerminalState(from)` check at line 132 returns `false` for any `*→*` transition where `from ∈ {done, cancelled}`. The spec § 6.2 says rejection should always succeed (the goal-space initiator makes the call); however, rejecting on a terminal card is semantically meaningless (a `done` card should never have a pending confirmation in the first place — the partial unique index `idx_human_confirmations_card_pending` enforces at most one pending confirmation per card, but does not prevent a `done` card from having a `pending` confirmation if the card state changed without the confirmation being resolved).
  Required action: Defensive guard. Before calling `assertTransition`, the service checks `isTerminalState(card.state)` and returns `STATE_CONFLICT` (409) if so. This is documented in spec.md R5. The implementation contract test pins this behavior.

## Non-Blocking Risks

- **R1. List endpoint's non-initiator "card accessibility" filter is computed via subquery.**
  Evidence: The repository must filter `human_confirmations` by card accessibility for chain_user / viewer actors. The cleanest approach is a SQL subquery: `cards.node_board_id IN (SELECT board_id FROM node_board_members WHERE user_id = actor.id AND removed_at IS NULL) OR cards.assigned_to = actor.id`. This mirrors the F2-05 list-cards-for-goal-space query.
  Mitigation: Reuse the F2-05 `selectDistinct` pattern in the test harness. Add a regression test that asserts a chain_user with no board memberships and no assigned cards receives an empty list.

- **R2. The list endpoint joins `human_confirmations ⋈ cards ⋈ goal_spaces` to fetch `card_title` and `goal_spaces.initiator_id` in one query.**
  Evidence: `HumanConfirmationResponse.card_title` is from `cards.title`. The endpoint also needs `goal_spaces.initiator_id` for the initiator filter. A single join is more efficient than per-row fetches.
  Mitigation: The repository's `listConfirmationsForActor` does one query with the joins. Add a contract test that asserts the response shape includes `card_title`.

- **R3. The `decision` object on `HumanConfirmationResponse` is omitted for `pending` confirmations and present for non-pending.**
  Evidence: The spec shows `decision?: {...}` — optional, present only after a decision. My spec T2 mapper handles this.
  Mitigation: Pin with two contract tests: (a) list `pending` confirmations returns `decision: undefined`; (b) list `approved` / `rejected` returns the populated `decision` object.

- **R4. `audit_entries.entity_type = 'confirm'` (not `'confirmation'`).**
  Evidence: `apps/web/db/schema.ts:99-107` enum includes `'confirm'`. The realtime `resourceType` uses `'confirmation'`. This is the documented F-001 inconsistency.
  Mitigation: Implementation uses `'confirm'` for audit and `'confirmation'` for realtime. Document in handoff.md. Snapshot test pins both.

- **R5. The decide endpoint must reject when the underlying card is missing.**
  Evidence: `human_confirmations.card_id` is `notNull` with a FK to `cards.id`. The partial unique index `idx_human_confirmations_card_pending` does not prevent a card from being soft-deleted (`cards.deleted_at IS NOT NULL`). After soft-delete, the card row is gone from reads (the F2-05 repository filters `deleted_at IS NULL`), but the confirmation row still exists.
  Mitigation: Defensive guard. If `card` is missing, return `404 NOT_FOUND` with a clear message ("Card not found for confirmation."). Pin with a contract test.

- **R6. The `card_state_changed` flag on `DecideConfirmationResponse` must be `true` even when the approve target_state equals the current state.**
  Evidence: The schema allows any state transition including self-loops. The decision write produces an audit + realtime + state_transitions row regardless of whether the state actually changes. The spec doesn't say `card_state_changed` should be `false` for no-op transitions.
  Mitigation: Implementation sets `card_state_changed = (card.state !== new_state)` or always `true` if a state transition was attempted. The cleaner choice is the latter (since an audit + state_transitions row was written). Document in implementation notes. Pin with a contract test for the approve case (state always changes when `target_state` is present) and the approve-no-target-state case (`card_state_changed = false`).

- **R7. The list endpoint's `status` query param validates against `CONFIRMATION_STATUS_VALUES`.**
  Evidence: `apps/web/db/schema.ts:81` exports `CONFIRMATION_STATUS_VALUES = ['pending', 'approved', 'rejected', 'cancelled'] as const`. The route's `validateStatus` helper must use this literal union.
  Mitigation: Reuse the F-001 enum. Pin with a contract test for invalid `status=foo`.

- **R8. The decide service writes `decidedAt` and `resolvedAt` simultaneously.**
  Evidence: The schema has both columns. `decidedAt` is set when the decision is made; `resolvedAt` is set when the confirmation is fully resolved (decision made OR cancelled). For `approved` / `rejected`, both should be set to the same timestamp.
  Mitigation: Implementation sets both to `nowIso()`. Document in implementation notes.

- **R9. Realtime event for `card_state_changed` should also fire when the rejection moves the card to `blocked`.**
  Evidence: F2-05 emits `card.blocked` and `card.unblocked` realtime events for state changes. The decision service must also write a `card.blocked` realtime event (separate from the `human_confirmation.rejected` event) so SSE consumers see both signals.
  Mitigation: The decision service calls `runWithAudit` with the human_confirmation audit context, then writes a second `runWithAudit` for the card state change (or both share the same transaction via a single tx). The cleanest pattern is a single `db.transaction` containing both the confirmation update and the card state update (similar to F2-05's block service). Pin with a contract test that asserts both `human_confirmation.rejected` and `card.blocked` realtime events are emitted on reject.

  Wait — `runWithAudit` writes ONE audit + ONE realtime per call. Calling it twice in two separate transactions would lose atomicity. The correct approach is to use a single `db.transaction` and call `runWithAudit` once for the confirmation + write the card update + state_transitions manually inside the same transaction. But `runWithAudit` is the F-004 wrapper that opens the transaction. To do both in one transaction, the implementation must either:
  - Call `runWithAudit` with `skipRealtime: true` for one of them and write the realtime manually, OR
  - Use `db.transaction` directly with two `tx.insert(realtimeEvents)` calls.

  The cleanest pattern (matching the existing F-004 wrapper's signature) is to call `runWithAudit` twice in sequence, each opening its own transaction. Both transactions must succeed; if the second fails, the first must roll back. better-sqlite3 supports nested transactions via savepoints, but the F-004 wrapper does not use savepoints.

  **Resolution:** Refactor the implementation to use `db.transaction` directly for the decision write, with two `tx.insert(auditEntries)` + two `tx.insert(realtimeEvents)` calls inside one transaction. This deviates from the F2-04 / F2-05 pattern of "one `runWithAudit` per lifecycle write" but is necessary to emit two realtime events atomically.

  **Alternative:** Emit only the `human_confirmation.rejected` / `human_confirmation.approved` realtime event (one `runWithAudit` call). The card state change is observed via the F2-05 audit + the next SSE-poll on `/cards/:id`. This is the simpler path; downstream consumers can correlate by `card_id` and check the audit log.

  **Decision:** Choose the alternative. One `runWithAudit` call per decision. The realtime event is `human_confirmation.{approved|rejected}`. The card state change is visible via the F2-05 `card.*` events when the next read or transition occurs, AND is visible in the audit log atomically with the decision write. This keeps the F2-04 / F2-05 / F2-06 patterns consistent.

- **R10. The `pending` partial unique index means at most one `pending` confirmation per card.**
  Evidence: `apps/web/db/schema.ts:528-530`. This is a database-level guarantee. A second `pending` confirmation for the same card cannot be created — only one `pending` row per card.
  Mitigation: This is a property of the schema, not enforced by F2-06. F2-07 must respect this constraint when creating confirmations. Document in handoff.md.

- **R11. F2-06 does not add a `DELETE /confirmations/:id` endpoint for cancellation.**
  Evidence: The plan § F2-06 lists only GET and POST endpoints. Cancellation flows through the goal-space cancel endpoint (F2-03), which the implementation note in `services/goal-spaces.ts` mentions but does not yet implement.
  Mitigation: Out of scope for F2-06. F2-09 UI may need a separate cancel endpoint in a future change.

## Missing Tests

- **MT1. Audit + realtime per decision write.** For each of `approve` (with target_state), `approve` (without target_state), `reject`, assert the `runWithAudit` audit context has the correct `entityType = 'confirm'`, `action`, `type`, `resourceType = 'confirmation'`. The `state_transitions` row is asserted separately via the captured `tx.insert` calls.

- **MT2. State-transitions row per state-changing decision.** For approve with `target_state` and for reject, assert that one `state_transitions` row is written with the correct `from_state`, `to_state`, `trigger` (`human_confirm` / `human_reject`), `actor = 'human'`.

- **MT3. Already-decided confirmation returns 409.** Confirmation with `status = 'approved'` → `POST /:id/decide` returns 409 STATE_CONFLICT.

- **MT4. Non-initiator cannot decide.** Chain_user or viewer → `POST /:id/decide` returns 403 FORBIDDEN. `canDecideConfirmation` returns false.

- **MT5. Missing reason on reject returns 422.** Body `{ outcome: 'rejected' }` (no `reason`) → 422 VALIDATION_ERROR.

- **MT6. Invalid outcome returns 422.** Body `{ outcome: 'maybe' }` → 422 VALIDATION_ERROR.

- **MT7. Approve with invalid `target_state` returns 409.** Confirmation has `target_state = 'cancelled'` but current card state is `done` (terminal) → assertTransition throws IllegalTransitionError → 409 STATE_CONFLICT. Or: confirmation has `target_state = 'invalid'` (not in CARD_STATES) — but `target_state` is a free-text column, so this is rejected at the assertTransition level (it would call `isValidState` first which throws IllegalTransitionError because 'invalid' is not in CARD_STATES).

- **MT8. List endpoint with `status=pending` filters correctly.** Test pins: pending list returns only `status='pending'` rows.

- **MT9. List endpoint with `status=approved` returns approved rows with populated `decision`.**

- **MT10. List endpoint with `status=invalid` returns 400 INVALID_FIELD.**

- **MT11. List endpoint pagination.** `page=2&limit=10` returns the second page.

- **MT12. List endpoint non-initiator accessibility filter.** Chain_user with no memberships gets an empty list; chain_user who is a member of the card's node board gets the confirmation.

- **MT13. Realtime event type snapshot.** Pins `HUMAN_CONFIRMATION_REALTIME_EVENTS` to the exact strings.

- **MT14. Defensive card-missing guard.** Soft-deleted card → decide returns 404 NOT_FOUND.

- **MT15. Terminal-state card rejection guard.** Card in `done` with a `pending` confirmation → reject returns 409 STATE_CONFLICT (defensive, even though the partial unique index makes this rare).

## Open Questions

- **Q1. Should the list endpoint accept multiple `status` values?**
  Resolution: No — single `status` query param. The spec shows `?status=pending`. Multi-status is a future enhancement. Pin with the single-status test.

- **Q2. Should the list endpoint allow filtering by `card_id`?**
  Resolution: No — out of scope for F2-06. F2-09 UI can extend if needed. The list endpoint only filters by `status`.

- **Q3. Should `POST /:id/decide` allow updating an existing decision (e.g., correcting a typo in the reason)?**
  Resolution: No — decisions are terminal once made. The `status='approved' / 'rejected' / 'cancelled'` rows cannot be re-decided. `canDecideConfirmation` enforces this via the `confirmationStatus === 'pending'` check.

## Reviewed Artifacts

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `sprint_progress.md`

## Sprint Progress Update

After human approves the corrections above:

- Phase 2 (Review) → Complete.
- Phase 3 (Implementation) → In Progress.
- Add a "Change Log" entry recording: R-fix F1 (decision.reason goes on confirmation only, not on card.blocked_reason); R-fix F2 (defensive terminal-state guard).
- Drop R9 from the implementation plan: use a single `runWithAudit` per decision. The realtime event is `human_confirmation.{approved|rejected}`. Card state change is observable via the audit log + subsequent card reads.