# Review Findings

Change ID: `20260619-phase2-card-api`
Status: review

## Recommendation

**Proceed with three corrections.**

The F2-05 request analysis maps the seven documented card endpoints (§ 4) plus the transitions history endpoint (§ 5.1) to the existing `cards`, `stateTransitions`, and `humanConfirmations` schema, the F-003 authorization helpers (`canReadCard` / `canMutateCard`), the F-002 state-machine module (`assertTransition` / `canTransition` / `getRequiredActor`), the F2-02 actor helper, and the F-004 `runWithAudit` transaction wrapper. The scope is bounded; no new auth, state-machine, or transaction primitives are introduced; realtime event names are exported as constants for F2-08.

Three spec corrections are required before implementation begins (recorded below as F1–F3). Two are spec errors, one is a real architectural question that needs the human's call.

## Blocking Findings

- **F1. `IllegalTransitionError` is mapped to the wrong status code in `spec.md` and `tasks.md`.**
  Evidence: `apps/web/src/lib/state-machine/errors.ts:21` sets `code: 'STATE_CONFLICT' as const` on `IllegalTransitionError`. The shared error-code map in `apps/web/src/lib/api/errors.ts:15` maps `STATE_CONFLICT` to HTTP 409. The current spec text says "Maps `IllegalTransitionError` to `VALIDATION_ERROR` (422)" in T7 and T8, which is wrong.
  Required action: In the implementation, treat `IllegalTransitionError` as a 409 `STATE_CONFLICT` (consistent with how F2-03's `cancelGoalSpace` already handles it). Update `tasks.md` T7 + T8 wording before GREEN. The acceptance criteria for block / unblock already say "409 STATE_CONFLICT" — only the implementation-notes wording was off; the AC is correct.

- **F2. `priority` is over-specified as `0–4`.**
  Evidence: `docs/specs/interface_spec.md § 1.2` says only "`priority` 使用整数，数值越大优先级越高" — no explicit range. F2-05 `spec.md` and `tasks.md` T5 say `priority` "0–4" and reject out-of-range with `VALIDATION_ERROR`. This is an over-specification not supported by the interface spec.
  Required action: Accept any integer (with `Number.isInteger`) for `priority`. Reject only non-integer or non-number values with `INVALID_FIELD` (400). Drop the upper-bound check. Acceptance criterion #4 wording needs the `priority` clause updated: "422 VALIDATION_ERROR for invalid risk_level or non-integer priority".

- **F3. Manual `block` has no state-machine trigger with `actor: 'human'`.**
  Evidence: The interface spec describes a manual block via `POST /api/v1/cards/:id/block`. The F-002 state-machine table in `apps/web/src/lib/state-machine/card.ts:60-103` lists 27 `(from, to, trigger)` tuples; every `*→blocked` rule uses `trigger: 'review_failed'` with `actor: 'ai_role'`. There is no `manual_block` or human-initiated `→blocked` trigger. The task description says "manual block", and the route must be operable by a human initiator or chain_user.
  Required action: Two options. **Recommended:** Add a new `manual_block` trigger to `TRANSITION_TRIGGERS` and CARD_TRANSITIONS in F-002 — one tuple per non-terminal `from` (`backlog`, `todo`, `dev`, `review`) with `actor: 'human'`. This keeps the state machine the single source of truth and matches the existing convention where `human_reject` is `actor: 'human'`. **Fallback (if F-002 is locked):** Use the existing `review_failed` trigger and pass `actor: 'human'` directly when writing the `state_transitions` row, bypassing `getRequiredActor`. Document the deviation in `implementation/notes.md`. **Either way, ask the human which path to take.**

## Non-Blocking Risks

- **R1. `display_id` uniqueness race.** The partial unique index `idx_cards_goal_space_display_id_active` enforces uniqueness; a concurrent insert could collide. Better-sqlite3 is single-threaded, so the in-transaction `MAX(CAST(SUBSTR(display_id, 6) AS INTEGER)) + 1` is race-free in S2. Future S4+ on Postgres may need a sequence.
  Mitigation: Continue with the current approach. Add a comment in `cards.ts` noting the Postgres migration path.

- **R2. `PATCH /cards/:id` cannot set `state`.** PATCH only mutates metadata. The spec explicitly lists no `state` field in `UpdateCardRequest`. The service must reject a `state` field in the body with `INVALID_FIELD` (400) to keep the contract explicit.
  Mitigation: Add an explicit body-shape check: if `body.state !== undefined`, throw `INVALID_FIELD`. Pin this with a contract test.

- **R3. `assign` authorization follows `update`, not a dedicated path.** The authorization matrix § 4 lists `POST /cards/:id/assign` with the same actor / chain_user rule as PATCH. F-003 only defines `update` / `unblock` / `complete` actions; `assign` semantically maps to `update`.
  Mitigation: The service calls `canMutateCard(actor, 'update', ctx)`. Add a comment in `services/cards.ts` recording the rationale. Add a contract test that asserts a viewer gets `403` for assign (consistent with the viewer-always-false rule).

- **R4. Realtime event naming convention.** `card.assigned` is a new event type not in `interface_spec.md § 8` (which lists only `card_state_changed`, `card_created`, `card_blocked`). F2-04 already added events not in § 8 (consistent precedent). F2-08 SSE will need to filter on these.
  Mitigation: Export the constants (`CARD_REALTIME_EVENTS.assigned = "card.assigned"` etc.) from `services/cards.ts`. Add a snapshot test. Document the names in the F2-05 handoff.

- **R5. `state_transitions.actor_name` is a free-text field.** The current `Actor` type only carries `id` and `role`. The service passes `actor.id` as the actor name (matching F-002's convention).
  Mitigation: Acceptable for S2. Document in `implementation/notes.md` that S4+ should join `users.name` for actor_name.

- **R6. Tags filter via `LIKE '%"tag"%'`.** SQLite has no native JSONB operators. The LIKE pattern is exact and case-sensitive but matches any string-literal substring. The `tags` column stores JSON, so a tag like `"foo"` will match the LIKE pattern. This is acceptable for S2 per F-001's SQLite adaptation.
  Mitigation: Document in `implementation/notes.md`. F-001 already accepts this pattern.

- **R7. `audit_trail` capped at 50 rows.** The detail endpoint reads the last 50 audit entries. The card-list endpoint does not paginate audit (audit is detail-only). No pagination param is documented in § 4.3.
  Mitigation: Implement `limit 50` on the audit_trail query. Document the cap in the F2-05 handoff for F2-09 to surface in the UI.

- **R8. `card.deleted_at` soft delete not exposed.** The F2-05 schema reads filter `deleted_at IS NULL`. There is no delete endpoint in this change; only soft-delete via a future admin path.
  Mitigation: Out of scope. Document as a follow-up.

- **R9. `card.description` is `text`, nullable.** The schema allows `description: null`. The `CardResponse` spec shows `description: string`. The service coerces `null → ""` on read.
  Mitigation: Confirm with the human that the service returns `""` for `null description` (matches F2-04's `node_boards.description ?? ""`). Add a contract test that creates a card without a description and asserts the response has `description: ""`.

- **R10. `risk_level` default.** The schema defaults `risk_level: 'medium'`. The spec shows `risk_level: 'low' | 'medium' | 'high' | 'critical'`. The validation must accept all four.
  Mitigation: Reuse the F-001 `RISK_LEVEL_VALUES` literal union. The test pins this.

- **R11. `dependencies` field semantics.** The spec shows `dependencies?: string[]` for create. The schema `dependencies: text(...)` stores `string[]` (JSON). The service must round-trip the array as-is.
  Mitigation: Pass-through. Pin with a contract test that asserts `dependencies: ["card-1"]` round-trips.

- **R12. Idempotency of `assign`.** The spec does not document idempotency explicitly. The plan says "idempotent on same assigned_to" — pin as 200 with the same response, no audit/realtime write when no change.
  Mitigation: Service-level check: if `card.assignedTo === input.assigned_to`, short-circuit and return the existing card. Pin with a contract test.

- **R13. Authorization context loading.** Per the explicit F2-05 review follow-up, the repository must load the goal-space context (initiator id, member ids) from the database inside a single call site — never trust caller-supplied context. `getCardWithContext` does this.
  Mitigation: The repository exposes `getCardWithContext(db, cardId)` that issues a `select from cards`, then `selectDistinct from node_board_members where board_id = ?`, then a `select from goal_spaces where id = ?`, then a `select count from human_confirmations where card_id = ? and status = 'pending'` — exactly 4 queries per call. The service then derives the `CardContext` and runs `canReadCard` / `canMutateCard`. Pin with a contract test that asserts the queries happen in the documented order.

## Missing Tests

- **MT1. Audit + realtime per lifecycle write.** For each of `createCard`, `updateCard`, `assignCard`, `blockCard`, `unblockCard`, assert the `runWithAudit` audit context has the correct `entityType`, `type`, `resourceType`, `goalSpaceId`, and that one `audit_entries` row + one `realtime_events` row are written. Use the F2-04 `expectAuditCall` shape.

- **MT2. State-transitions row per state-changing write.** For `blockCard` and `unblockCard`, assert that one `state_transitions` row is written with the correct `from_state`, `to_state`, `trigger`, `actor`, and `actor_id`. Block uses `manual_block` (or `review_failed` per F3 fallback); unblock uses `blocked_resolved`.

- **MT3. `CONFIRMATION_REQUIRED` gate on unblock.** Card has a pending human confirmation → `POST /unblock` returns 409 with `code: CONFIRMATION_REQUIRED`. The F-003 helper already encodes this; the test must pin the contract.

- **MT4. Terminal-state block returns 409.** Card in `done` or `cancelled` → `POST /block` returns 409 `STATE_CONFLICT`.

- **MT5. Cross-state unblock returns 409.** Card in `backlog` (not blocked) → `POST /unblock` returns 409 `STATE_CONFLICT`.

- **MT6. Invalid `target_state` returns 422.** `POST /unblock` with `target_state: "done"` → 422 `VALIDATION_ERROR`.

- **MT7. Invalid `risk_level` returns 422.** `PATCH /cards/:id` with `risk_level: "extreme"` → 422 `VALIDATION_ERROR`.

- **MT8. Non-integer `priority` returns 400.** `PATCH /cards/:id` with `priority: "high"` → 400 `INVALID_FIELD`.

- **MT9. Viewer cannot create.** `POST /goal-spaces/:goalSpaceId/cards` as a viewer → 403.

- **MT10. Viewer cannot read.** `GET /cards/:id` as a viewer who is neither a node-board member nor the assignee → 403.

- **MT11. Idempotent assign.** Two consecutive `POST /cards/:id/assign` with the same `assigned_to` both return 200; the second call writes no audit_entries / realtime_events.

- **MT12. List endpoint with state / assigned_to / tags filters.** Three separate tests, each asserting the filter narrows the result correctly.

- **MT13. Goal-space scope defense.** A card in goal space A is invisible to a chain_user in goal space B even if both are members of different node boards.

- **MT14. Realtime event type snapshot.** Pins `CARD_REALTIME_EVENTS` to the exact strings.

- **MT15. Assign service lookup only one audit/realtime write when idempotent.** Confirms the no-op short-circuit.

## Open Questions

- **Q1. Manual block trigger.** See F3 above. Recommended: add `manual_block` to F-002. Fallback: reuse `review_failed` with overridden actor. **Needs the human's call.**

- **Q2. Display-id starting value.** When a goal space has zero cards, the repository computes `MAX(...) + 1` which yields `NULL + 1 = NULL`. The COALESCE fallback must produce `"CARD-001"`. Pin with a contract test that creates the first card in a fresh goal space.
  Resolution: Service uses `COALESCE(MAX(...), 0) + 1` and pads to 3 digits. Implementation detail; no human input needed.

- **Q3. Should `POST /cards/:id/unblock` accept `target_state: 'blocked'` or `'cancelled'`?** No — the interface spec § 4.7 restricts `target_state` to `backlog | todo | dev | review`. Anything else returns 422.
  Resolution: Implemented as documented. No human input needed.

- **Q4. Should `assign` allow `assigned_to: null` for unassignment?** The interface spec § 4.5 shows `assigned_to: string` (required, non-null). F2-05 does not add an unassign endpoint.
  Resolution: `assign` requires `assigned_to: string`. Unassign is out of scope for F2-05. No human input needed.

## Reviewed Artifacts

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `sprint_progress.md`

## Sprint Progress Update

After human approves the corrections above:

- Phase 2 (Review) → Complete.
- Phase 3 (Implementation) → In Progress.
- Add a "Change Log" entry recording: spec.md `priority` clause amended (R-fix F2); `IllegalTransitionError` mapping clarified (R-fix F1); `manual_block` trigger added to F-002 if Q1 is resolved in favor of the recommended option (R-fix F3).