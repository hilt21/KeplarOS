# Review Findings

Change ID: `20260619-phase2-execution-api`
Status: review

## Recommendation

**Proceed with two corrections.**

The F2-07 request analysis maps the two documented endpoints in `docs/specs/interface_spec.md § 7` to the existing `agent_executions`, `cards`, `goal_spaces`, `human_confirmations`, and `audit_entries` schema; the F-003 `canExecuteCard` authorization helper (with the § 5 mandatory gate); the F-002 state-machine module; the F2-05 card repository (`getCardContext`, `updateCardState`, `insertStateTransition`); the F2-06 confirmation patterns; and the F-004 `runWithAudit` transaction wrapper. The fixture executor is pure, deterministic, and side-effect-free. No new auth, state-machine, audit, or transaction primitives are introduced.

Two spec corrections are required before implementation begins. Both are minor and do not affect the test plan.

## Blocking Findings

- **F1. The fixture executor's `Backlog Refiner` fixture output for a `backlog` card must produce a transition tuple `(backlog, todo, dependencies_ready)`, not `(backlog, todo, context_complete)`.**
  Evidence: The plan § F2-07 Step 4 test list says "Backlog Refiner fixture can move backlog card toward todo". The interface spec § 4.6 (`state_transition.md`) defines two valid triggers for `(backlog, todo)`: `dependencies_ready` (Backlog Refiner's documented output) and `context_complete` (Todo Orchestrator's output). Per `apps/web/src/lib/state-machine/card.ts:62-63`, both tuples exist.
  Required action: Implementation pins `Backlog Refiner → (backlog, todo, dependencies_ready)` and `Todo Orchestrator → (backlog, todo, context_complete)`. The contract test asserts `Backlog Refiner → dependencies_ready` in the `state_transitions` row.

- **F2. The fixture executor's `Review Guard` fixture for a high-risk card must create a confirmation with `trigger_type: 'high_risk'`, not the literal "high risk" string.**
  Evidence: `apps/web/db/schema.ts:85-92` defines `CONFIRMATION_TRIGGER_TYPE_VALUES = ['high_risk', 'low_confidence', 'external_write', 'deployment', 'irreversible']`. The spec § 7.1 documents `Review Guard` as a guard role. The `trigger_type` column is typed as this enum literal union. Using "high risk" would fail Drizzle's type check.
  Required action: Implementation pins `Review Guard → trigger_type: 'high_risk'`. The contract test asserts the `trigger_type` column value matches the enum literal.

## Non-Blocking Risks

- **R1. The fixture executor must return a structured result that downstream services can interpret deterministically.**
  Evidence: The interface spec § 7.2 documents `ExecuteStatusResponse.result` as `{ new_state?, confidence?, evidence?, message }` and `error` as `{ code, message }`. The fixture executor must produce one of these shapes.
  Mitigation: The fixture executor returns a tagged union (`status: 'completed' | 'failed' | 'needs_confirmation'`) with the documented field shapes. The service maps the tagged union to the appropriate persistence path.

- **R2. The execute service must emit the `agent_execution.queued` realtime event when creating the row, AND the terminal status event when the execution completes.**
  Evidence: `runWithAudit` writes exactly one audit + one realtime per call. The plan § F2-07 Step 4 says "write realtime event". The natural pattern is to emit `agent_execution.queued` when the row is inserted and `agent_execution.completed | failed | needs_confirmation` when the row is updated to terminal status.
  Mitigation: Use `runWithAudit` twice in sequence (create + update), each with its own realtime event type. The create's `action` is `execute` and type is `agent_execution.queued`; the update's `action` is `execute_completed | execute_failed | execute_needs_confirmation` and type is the corresponding terminal event. This keeps the F-004 contract intact (1 audit + 1 realtime per `runWithAudit` call). Documented in `implementation/notes.md`.

- **R3. The execute service must respect the F-006 partial unique index `idx_human_confirmations_card_pending` (at most one pending confirmation per card).**
  Evidence: `apps/web/db/schema.ts:528-530`. If a card already has a pending confirmation, the Review Guard's `needs_confirmation` insert will fail.
  Mitigation: The `canExecuteCard` check (F-003) already gates on `hasPendingConfirmation`. The execute service returns 409 `CONFIRMATION_REQUIRED` BEFORE attempting the insert. Documented.

- **R4. The fixture executor's `result.confidence` value is documented but not normalized.**
  Evidence: The interface spec § 7.2 shows `confidence?: number` with no range. The fixture executor returns confidence values between 0 and 1.
  Mitigation: Document the confidence range (0-1) in the executor JSDoc. Pin with contract tests for the documented roles.

- **R5. The execute service's `human_confirmations.expires_at` column is required (`notNull`).**
  Evidence: `apps/web/db/schema.ts:519`. The Review Guard's `needs_confirmation` path must set `expiresAt` to a future timestamp.
  Mitigation: The service sets `expiresAt = now + 24 hours` (per F2-07 review R5 from F2-06 handoff). Document the TTL.

- **R6. The execute service's `agent_executions.trigger` column is required (`notNull`).**
  Evidence: `apps/web/db/schema.ts:396`. The F2-07 implementation must populate `trigger` with the role name (e.g., `Backlog Refiner`).
  Mitigation: Service sets `trigger = role` for all executions.

- **R7. The execute endpoint's response shows `status: 'queued'` per the spec § 7.1, but the GET endpoint immediately after shows the terminal status.**
  Evidence: The plan § F2-07 Step 4 test list says "POST /api/v1/cards/:id/execute creates queued agent_executions row". Since the fixture runs synchronously inside the POST handler, the `agent_executions.status` is updated to terminal status within the same request.
  Mitigation: Two options: (a) the POST handler returns immediately with `status: 'queued'` BEFORE running the executor, then asynchronously runs the executor and updates the row. (b) the POST handler runs the executor synchronously, then returns with `status: 'queued'` while the row's actual status is `completed`. Option (b) is simpler and matches the plan's "deterministic" requirement (no async / worker queue in F2-07). Documented.
  **Decision:** Option (b). The response shows `status: 'queued'` per spec, the row is `completed` per the executor output. Subsequent GET returns the terminal status. This matches the existing F2-04 / F2-05 / F2-06 patterns.

- **R8. The `execute` endpoint may be called by an initiator or chain_user. The viewer is rejected.**
  Evidence: `canExecuteCard` returns false for viewer (F-003 AC-3.9). The service returns 403 FORBIDDEN for viewers.
  Mitigation: Pin with a contract test.

- **R9. The execute service must be careful to not transition the card on a `needs_confirmation` result.**
  Evidence: The Review Guard on a high-risk card produces a confirmation request but does NOT change the card state. The card state change is deferred to F2-06 (when the initiator approves).
  Mitigation: The service conditionally applies the state transition only when `result.status === 'completed' && result.new_state !== undefined`. The `needs_confirmation` path writes the confirmation row but skips `updateCardState` and `insertStateTransition`. Documented in `implementation/notes.md`.

- **R10. The fixture executor's deterministic rule must be encoded explicitly per role.**
  Evidence: The plan § F2-07 Step 3 requires the executor to be deterministic. The role → transition mapping is part of the fixture contract.
  Mitigation: The fixture executor is a switch statement on `role`. Each case returns a structured result. Contract tests pin each role's output.

- **R11. The execute service's `human_confirmations.ai_summary` column is required to be a non-empty string.**
  Evidence: `apps/web/db/schema.ts:499-505` allows nullable aiSummary but the spec § 6 documents it as required.
  Mitigation: The service sets `aiSummary` to a role-specific message (e.g., `"Review Guard flagged output as high risk: confidence 0.6"`). The Review Guard's message includes the confidence value.

- **R12. The execute endpoint's audit action verb is `execute` for the create-side, not `create`.**
  Evidence: Existing F2-04 / F2-05 / F2-06 use verbs that match the operation (`create`, `update`, `assign`, `block`, `unblock`, `approve`, `reject`). The execute endpoint's audit action should be `execute` to match the verb convention.
  Mitigation: Audit `action` is `execute` for the queued row, `execute_completed | execute_failed | execute_needs_confirmation` for the terminal update. Documented.

## Missing Tests

- **MT1. Audit + realtime per lifecycle write.** For each execution path, assert the audit + realtime captures.
- **MT2. State-transitions row for `Backlog Refiner` on `backlog` card.** Trigger must be `dependencies_ready`.
- **MT3. `human_confirmations` row for `Review Guard` on `high` card.** Trigger type must be `high_risk`.
- **MT4. CONFIRMATION_REQUIRED on execute when pending confirmation exists.**
- **MT5. STATE_CONFLICT on execute when card is terminal.**
- **MT6. 403 for viewer on execute.**
- **MT7. 404 for missing card on execute.**
- **MT8. 404 for missing task_id on GET.**
- **MT9. 403 for non-readable card on GET.**
- **MT10. POST returns 202 with status='queued' and a task_id.**
- **MT11. GET returns 200 with the documented ExecuteStatusResponse.**
- **MT12. Failed execution writes error_code + error_message + emits `agent_execution.failed`.**
- **MT13. Realtime event constant snapshot.**

## Open Questions

- **Q1. Should the fixture executor support a `cancel` lifecycle?**
  Resolution: No — `cancelled` status is out of scope for F2-07. Future S4+ may add cancellation via `DELETE /execute/:taskId`.

- **Q2. Should the execute endpoint support batch execution (multiple roles per card)?**
  Resolution: No — single role per request per the spec § 7.1 body shape.

- **Q3. Should the fixture executor return confidence as a percentage (0-100) or a fraction (0-1)?**
  Resolution: Fraction (0-1), matching `ai_confidence` on `human_confirmations` (`real`). Document the range in the JSDoc.

## Reviewed Artifacts

- `request_analysis/spec.md`
- `request_analysis/tasks.md`
- `request_analysis/feature_list.json`
- `sprint_progress.md`

## Sprint Progress Update

After human approves the corrections above:

- Phase 2 (Review) → Complete.
- Phase 3 (Implementation) → In Progress.
- Add a "Change Log" entry recording: R-fix F1 (Backlog Refiner trigger pinned to `dependencies_ready`); R-fix F2 (Review Guard trigger_type pinned to `high_risk` enum literal).
- Drop R7 (option b chosen): the POST response shows `status: 'queued'` per spec while the row is updated synchronously to terminal status; subsequent GET returns the terminal status.