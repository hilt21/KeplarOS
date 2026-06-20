# F2-05 Card and Transition API — Request Analysis

Change ID: `20260619-phase2-card-api`
Status: request_analysis

## Request Summary

Implement the Card and State Transition REST API for the Web Collaboration Beta (F2-05). This is the third application feature in Phase 2, following F2-03 (Goal Space) and F2-04 (Node Board + Member).

Scope of this change is the **seven documented Card endpoints plus the transitions history endpoint** in `docs/specs/interface_spec.md § 4` and `§ 5.1`. Every lifecycle write produces exactly one `audit_entries` row and one `realtime_events` row inside a single `better-sqlite3` transaction (via the F-004 `runWithAudit` wrapper). Pending human confirmations block the documented gate-protected mutations (`unblock`, `complete`) and return `409 CONFIRMATION_REQUIRED`.

This change **does not** introduce: AI execution, human confirmation decision API (F2-06), SSE filtering (F2-08), UI (F2-09), E2E (F2-10). It only ships the CRUD/state-machine/audit/realtime plumbing for cards and their transition history.

## Assumptions

- F2-03 and F2-04 are committed on `master` (commits `507344a`, `29af35b`, `d1d1dcc`). Reuse their patterns verbatim — same route-harness queue convention, same `captureMutations` / `makeTxHarness` test helpers, same response envelopes.
- The repository must load card context (goal space, node board, members, pending-confirmation flag, current state) from the database inside a single call site, not trust caller-supplied context. This was the explicit F2-05 review follow-up to F2-04.
- Card authorization is governed by the existing `canReadCard` / `canMutateCard` helpers in `apps/web/src/lib/authorization/card.ts` (F-003, AC-3.6 / AC-3.7 + spec § 5 mandatory gate). No new authorization helpers.
- The state machine is the existing pure-function module in `apps/web/src/lib/state-machine/card.ts` (F-002, 27 (from, to, trigger) tuples). No new state-machine rules.
- `runWithAudit` (F-004) wraps every lifecycle write so audit + realtime share the business write transaction. No new transaction wrappers.
- Each card lives under one node board (per schema: `cards.node_board_id NOT NULL`). Creating a card therefore requires an existing node board; creating cards for an arbitrary goal space without a node board is out of scope (the F2-04 POST shape already attaches members but the F2-05 POST accepts `node_board_id` as required).
- The transitions history endpoint (`GET /api/v1/cards/:id/transitions`) inherits card-read permission and returns the documented `StateTransitionResponse[]`. It does not paginate (typical per-card transition count is small).
- Display ID generation: cards are created with `display_id` of the form `CARD-001`, `CARD-002`, etc. The F2-05 implementation uses a goal-space-scoped counter via `MAX(CAST(SUBSTR(display_id, 6) AS INTEGER)) + 1`. The repository does the SELECT inside the transaction (so the partial unique index `idx_cards_goal_space_display_id_active` is honored atomically).
- Soft delete: cards have `deleted_at`. Reads filter `deleted_at IS NULL`. No restore endpoint in F2-05.
- The "previously removed member is re-added" round trip recommended as a follow-up in the F2-04 handoff is out of scope for F2-05 (cards do not have member soft-remove semantics in this change).

## Scope

### In Scope

Seven card endpoints + one transitions endpoint per `docs/specs/interface_spec.md § 4` and `§ 5.1`:

| # | Method | Path | § | Purpose |
|---|--------|------|---|---------|
| 1 | POST | `/api/v1/goal-spaces/:goalSpaceId/cards` | 4.1 | Create card |
| 2 | GET | `/api/v1/goal-spaces/:goalSpaceId/cards` | 4.2 | List cards by goal space (filters: `state`, `assigned_to`, `tags`) |
| 3 | GET | `/api/v1/cards/:id` | 4.3 | Card detail (includes transitions, confirmations, audit trail) |
| 4 | PATCH | `/api/v1/cards/:id` | 4.4 | Update card metadata |
| 5 | POST | `/api/v1/cards/:id/assign` | 4.5 | Assign card to user |
| 6 | POST | `/api/v1/cards/:id/block` | 4.6 | Manually block card |
| 7 | POST | `/api/v1/cards/:id/unblock` | 4.7 | Resolve blocked state |
| 8 | GET | `/api/v1/cards/:id/transitions` | 5.1 | Card transition history |

Plus the supporting layers:

- `apps/web/src/lib/db/repositories/cards.ts` — query/write helpers (load card + context, create, update, assign, block, unblock, list, list transitions, count display IDs).
- `apps/web/src/lib/services/cards.ts` — 8 transactional services + `CARD_REALTIME_EVENTS` + `CARD_AUDIT_ENTITY_TYPE` constants.
- `apps/web/__tests__/api/cards.test.ts` — TDD contract tests for the 8 endpoints.
- `apps/web/src/lib/api/request.ts` — extend with `optionalStringArray` / `optionalNumberInRange` helpers if needed (only if a third-party equivalent is not already present; otherwise inline).

### Out of Scope

- AI execution / role registry / execution results — F2-07.
- Human confirmation decision API (`POST /api/v1/confirmations/:id/decide`, `GET /api/v1/confirmations`) — F2-06.
- SSE filtering and realtime fan-out — F2-08.
- UI rendering, form interactions, Web components — F2-09.
- Playwright E2E journeys — F2-10.
- Card bulk create / move / archive / restore endpoints.
- Card deletion endpoint (cards are soft-deleted only via a future admin path).
- Search / full-text card search.
- Tags management endpoint (tags are PATCH-only).
- Pagination on the transitions endpoint.
- Display ID counter reset / migration utilities.

## Affected Modules

### Existing files (read-only references, not modified)

- `apps/web/db/schema.ts` — `cards`, `stateTransitions`, `humanConfirmations`, `goalSpaces`, `nodeBoards`, `nodeBoardMembers`, `auditEntries`, `realtimeEvents` tables and their enums.
- `apps/web/src/lib/state-machine/card.ts` — `canTransition`, `assertTransition`, `getRequiredActor`, `TRANSITION_TRIGGERS`, `CARD_STATES`.
- `apps/web/src/lib/authorization/card.ts` — `canReadCard`, `canMutateCard`, `CardMutationAction`.
- `apps/web/src/lib/authorization/types.ts` — `CardContext` (has all fields the service needs to populate).
- `apps/web/src/lib/api/actor.ts` — `requireActor`, `requireInitiator`.
- `apps/web/src/lib/api/request.ts` — `readJsonBody`, `requireString`, `optionalString`, `TEST_ACTOR_HEADER`.
- `apps/web/src/lib/api/response.ts` — `apiOk`, `apiCreated`, `apiNoContent`, `apiError`.
- `apps/web/src/lib/api/errors.ts` — `API_ERROR_CODES`, `ApiRequestError` (includes `CONFIRMATION_REQUIRED`, `STATE_CONFLICT`, `VALIDATION_ERROR`).
- `apps/web/src/lib/audit/run-with-audit.ts` — `runWithAudit`, `AuditContext`.
- `apps/web/src/lib/db/client.ts` — `getDb`, `DrizzleDb`.
- `apps/web/src/lib/db/repositories/node-boards.ts` — `listActiveMembersForBoards` for context lookup.
- `apps/web/src/lib/db/repositories/goal-spaces.ts` — `getGoalSpaceWithMembers` for list-endpoint read check.
- `apps/web/__tests__/api/route-test-harness.ts` — `createJsonRequest`, `expectApiOk`, `expectApiError`, `withTestSession`.
- `apps/web/__tests__/api/node-boards.test.ts` — pattern reference for `queueSelectResults` / `captureMutations` / `makeTxHarness` (re-declared inline in `cards.test.ts` since the helpers were not extracted to a shared file in F2-04).

### New files

- `apps/web/src/lib/db/repositories/cards.ts`
- `apps/web/src/lib/services/cards.ts`
- `apps/web/src/app/api/v1/goal-spaces/[goalSpaceId]/cards/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/assign/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/block/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/unblock/route.ts`
- `apps/web/src/app/api/v1/cards/[id]/transitions/route.ts`
- `apps/web/__tests__/api/cards.test.ts`

### Modified files

None. F2-05 introduces only new files. F2-02 / F2-03 / F2-04 / F-002 / F-003 / F-004 files are not modified. If a third-party helper is found to be missing during implementation (e.g., a number-range validator), an extension to `apps/web/src/lib/api/request.ts` may be considered; this is documented as an explicit deviation if it occurs.

## Acceptance Criteria

The implementation passes when all of the following are satisfied:

### Endpoint behavior

1. **POST `/api/v1/goal-spaces/:goalSpaceId/cards`** — initiator and chain_user can create; viewer cannot. Body: `title` (required), `description`, `node_board_id`, `assigned_to`, `priority`, `risk_level`, `dependencies`, `tags` (all optional except `title` and `node_board_id`). On success returns `201` with the documented `CardResponse`. Default `state: "backlog"`. Default `priority: 0`. Default `risk_level: "medium"`. Default `dependencies: []`. Default `tags: []`. Returns `403` for viewer. Returns `404` when `goal_space_id` or `node_board_id` does not exist. Returns `409 STATE_CONFLICT` when `display_id` collides (extremely unlikely with the in-transaction counter, but the service maps the partial unique index error to `STATE_CONFLICT` for safety). Writes exactly one `audit_entries` row (action `create`) and one `realtime_events` row (`card.created`).

2. **GET `/api/v1/goal-spaces/:goalSpaceId/cards`** — initiator sees all cards in the goal space; chain_user / viewer see cards whose `node_board_id` matches a node board the actor is a member of, OR whose `assigned_to === actor.id`. Query params: `state`, `assigned_to`, `tags` (comma-separated). Returns `200` with `{ items: CardResponse[], total: number }`. Returns `403` for non-members with no assigned cards; `404` if goal space missing.

3. **GET `/api/v1/cards/:id`** — returns `200` with `CardDetailResponse` (extends `CardResponse` with `transitions`, `confirmations`, `audit_trail`). The endpoint uses `canReadCard` for authorization. Returns `403` for non-readable cards; `404` for missing cards.

4. **PATCH `/api/v1/cards/:id`** — initiator always; chain_user for own node-board / own assignment. Patches `title`, `description`, `assigned_to`, `priority`, `risk_level`, `tags`. Returns `200` with the updated `CardResponse`. Returns `422 VALIDATION_ERROR` for invalid `risk_level` or out-of-range `priority`. Returns `422 VALIDATION_ERROR` when transitioning state from terminal (`done` / `cancelled`); PATCH cannot change state (state changes go through the state machine endpoints).

5. **POST `/api/v1/cards/:id/assign`** — initiator always; chain_user if readable. Body `{ assigned_to: string }`. Returns `200` with the updated `CardResponse`. Idempotent on the same `assigned_to`. Returns `404` for missing cards. Writes `audit_entries` + `realtime_events` (`card.assigned`).

6. **POST `/api/v1/cards/:id/block`** — initiator always; chain_user if readable. Body `{ reason: string }`. State change to `blocked` via the state machine (`review_failed` trigger). Writes a `state_transitions` row, `audit_entries`, `realtime_events` (`card.blocked`). Returns `200` with `CardResponse`. Returns `409 STATE_CONFLICT` when card is already terminal (`done` / `cancelled`). Returns `422 VALIDATION_ERROR` when `reason` is missing.

7. **POST `/api/v1/cards/:id/unblock`** — initiator always; chain_user if readable. Body `{ target_state: 'backlog' | 'todo' | 'dev' | 'review' }`. State change from `blocked` to `target_state` via `blocked_resolved` trigger. Writes a `state_transitions` row, `audit_entries`, `realtime_events` (`card.unblocked`). Returns `200` with `CardResponse`. Returns `409 STATE_CONFLICT` if not in `blocked`. Returns `422 VALIDATION_ERROR` for an invalid `target_state` (or one not reachable from `blocked` per the state machine). Returns `409 CONFIRMATION_REQUIRED` when a pending human confirmation exists.

8. **GET `/api/v1/cards/:id/transitions`** — inherits card-read permission. Returns `200` with `StateTransitionResponse[]`. Each entry includes `from_state`, `to_state`, `trigger`, `actor`, `actor_name`, `reason`, `evidence`, `timestamp`. Returns `403` for non-readable cards; `404` for missing cards. Does not paginate.

### Cross-cutting

9. Every lifecycle write persists exactly one `audit_entries` row and one `realtime_events` row inside a single transaction; failure rolls back the business write (F-004 `runWithAudit` contract).
10. Every state-changing operation also writes a `state_transitions` row inside the same transaction.
11. `apps/web/src/lib/api/actor.ts` `requireActor` / `requireInitiator` is used by every F2-05 route (no F2-02 / F2-03 / F2-04 helper duplication).
12. `canReadCard` / `canMutateCard` is used by every F2-05 service that needs authorization (no new auth helpers).
13. `assertTransition` / `canTransition` / `getRequiredActor` is used by every state-changing service (no state-machine duplication).
14. `runWithAudit` is used by every lifecycle write (no transaction duplication).
15. Realtime event type names (`card.created`, `card.updated`, `card.assigned`, `card.blocked`, `card.unblocked`) are exported as constants from `apps/web/src/lib/services/cards.ts` so F2-08 SSE filtering has a single source of truth. A snapshot test pins them.

### Verification

16. `pnpm --filter @keplar/web test -- __tests__/api/cards.test.ts` passes.
17. `pnpm --filter @keplar/web test -- __tests__/state-machine/card.test.ts __tests__/authorization/card.test.ts` passes (no regressions in F-002 / F-003).
18. `pnpm --filter @keplar/web test` passes (the full web suite stays green; F2-04's 451 tests remain green).
19. `pnpm check` passes (typecheck + lint + test + build + format:check) with environment warnings only (Node engine warnings acceptable per F2-04 baseline).
20. `git diff --check` passes.
21. No files outside the F2-05 file set or unrelated prior changes are modified.

## Risks and Open Questions

| # | Risk / Question | Severity | Resolution |
|---|---|---|---|
| R1 | `display_id` uniqueness: the partial unique index `idx_cards_goal_space_display_id_active` can collide under concurrent transactions. | Medium | The repository uses a single SQL subquery `MAX(CAST(SUBSTR(display_id, 6) AS INTEGER))` inside the transaction; better-sqlite3 is single-threaded so this is race-free in S2. Future S4+ on Postgres may need a sequence. |
| R2 | State machine tuple (from, to, trigger) is the only legal transition; `PATCH` cannot set state directly. | Low | The state is read-only on PATCH; explicit PATCH validation rejects `state` field if present. PATCH only mutates metadata. |
| Q1 | Should `assign` allow `null` (unassign)? | — | Resolved: `assigned_to` is required string on `POST /assign` (idempotent reassign). Unassigning is out of scope for F2-05; if needed, F2-09 UI can add a `DELETE /cards/:id/assign` endpoint. |
| Q2 | Should `block` allow blocking from `done` or `cancelled`? | — | Resolved: No — terminal cards return `409 STATE_CONFLICT`. The state machine rejects any transition out of a terminal state. |
| Q3 | Should `unblock` allow `target_state === "blocked"` or `"cancelled"`? | — | Resolved: No — the body schema restricts `target_state` to `'backlog' | 'todo' | 'dev' | 'review'`. Anything else returns `422 VALIDATION_ERROR`. |
| Q4 | Should the list endpoint paginate? | — | Resolved: No — goal spaces are bounded (typically < 200 cards). The review follow-up is to revisit if a goal space exceeds ~200 cards; F2-09 UI should monitor. |
| Q5 | Should `GET /cards/:id` include `confirmations` and `audit_trail` inline? | — | Resolved: Yes — per `docs/specs/interface_spec.md § 4.3` `CardDetailResponse extends CardResponse` with `transitions`, `confirmations`, `audit_trail`. The detail endpoint executes the same 3 reads the transitions endpoint uses plus a card lookup. |
| R3 | `actor_name` on `state_transitions` is a free text field (per `docs/specs/database_design.md § 3.7`). | Low | The service passes `actor.name ?? actor.id` (current state: the Actor type only has `id` and `role`). A future S4+ can join `users.name`. |
| R4 | The card-list endpoint must filter by tags (comma-separated). | Low | Repository does `LIKE '%"tag"%'` against the JSON-serialized `tags` column. SQLite has no native JSONB operators; spec calls for `LIKE` per F-001 review. |

## Reuse Summary (no new primitives)

| Concern | Reused from | File |
|---|---|---|
| Session / actor resolution | F2-02 | `apps/web/src/lib/api/actor.ts` |
| Authorization check | F-003 | `apps/web/src/lib/authorization/card.ts` |
| State machine | F-002 | `apps/web/src/lib/state-machine/card.ts` |
| Transaction wrapper | F-004 | `apps/web/src/lib/audit/run-with-audit.ts` |
| Response envelope | F2-01 | `apps/web/src/lib/api/response.ts` |
| JSON validation | F2-02 | `apps/web/src/lib/api/request.ts` |
| Mock harness pattern | F2-04 | `apps/web/__tests__/api/node-boards.test.ts` (re-declared inline) |
| Goal space read check | F2-03 | `apps/web/src/lib/db/repositories/goal-spaces.ts` |
| Node board member lookup | F2-04 | `apps/web/src/lib/db/repositories/node-boards.ts` |

## Sequencing

1. Phase 1: Request Analysis (this document) — human approval.
2. Phase 2: Review — risk matrix + open questions re-checked.
3. Phase 3: Implementation via TDD (RED → GREEN → REFACTOR):
   - Repository helpers (write-then-read helpers, no transaction wrapper yet).
   - Service layer with `runWithAudit` + state-machine + authorization.
   - 8 route handlers (one file each + the goal-space-scoped list/create).
   - TDD contract tests written first, watched to fail, then implementation passes.
4. Phase 4: Testing — `pnpm check` + targeted tests.
5. Phase 5: Delivery — `delivery/summary.md` + `handoff.md`.

## Next-Step Hint

F2-06 (Human Confirmation API) is the immediate follow-up. It should:
- Consume `card.blocked` and `card.unblocked` realtime events to keep the confirmation list fresh.
- Reuse `canDecideConfirmation` (F-003) for `POST /api/v1/confirmations/:id/decide`.
- Reuse the `runWithAudit` wrapper for `approve` / `reject` (which moves the card to `target_state` or `blocked` respectively).
- Export confirmation realtime event constants from `apps/web/src/lib/services/confirmations.ts` for F2-08.