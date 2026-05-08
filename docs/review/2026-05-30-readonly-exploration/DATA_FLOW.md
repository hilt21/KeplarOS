# DATA_FLOW

## Main Product Flow

1. Initiator inputs a natural-language goal.
2. Backlog Refiner parses the goal into a YAML Story.
3. KEPLAR creates a Goal Space and initial Cards.
4. Todo Orchestrator plans dependencies, execution order, lane assignment, and risk flags.
5. Dev Crafter executes card work and produces implementation evidence.
6. Review Guard checks evidence against acceptance criteria.
7. Done Reporter summarizes completed work when review passes.
8. Blocked Resolver handles execution failure, review failure, missing context, or external-system failure.
9. Human confirmation gates high-risk, low-confidence, external write, deployment, and irreversible decisions.
10. State, evidence, confirmations, transitions, and audit entries are persisted.
11. REST and SSE synchronize state back to Web/Desktop views.

## Primary Data Entities

| Entity / Table | Purpose |
|---|---|
| `users` | Users with roles such as `initiator`, `chain_user`, `viewer` |
| `goal_spaces` | Aggregate root for a business goal, constraints, acceptance criteria, progress |
| `node_boards` | Node-level work views, membership, and downstream flow boundaries |
| `sessions` | AI/session execution contexts for recovery, SSE, and audit correlation |
| `cards` | Task units inside a goal space, with state, context, evidence, confidence, dependencies, tags |
| `state_transitions` | Card state transition history |
| `human_confirmations` | Confirmation sessions attached to cards |
| `audit_entries` | Generic audit trail for goal spaces, cards, and confirmations |

## Ownership and Relations

| Relation | Description |
|---|---|
| `users.id -> goal_spaces.initiator_id` | A user initiates a goal space |
| `goal_spaces.id -> node_boards.goal_space_id` | A goal space contains node boards |
| `goal_spaces.id -> sessions.goal_space_id` | A goal space owns AI/session execution contexts |
| `goal_spaces.id -> cards.goal_space_id` | A goal space contains cards |
| `node_boards.id -> cards.node_board_id` | A node board scopes card visibility and workflow |
| `cards.id -> state_transitions.card_id` | A card owns transition records |
| `cards.id -> human_confirmations.card_id` | A card owns confirmation sessions |
| `users.id -> human_confirmations.decided_by` | A user decides a confirmation |
| `audit_entries.entity_type + entity_id` | Polymorphic audit association; no explicit FK specified |

## AI Lane Data Contracts

| Producer | Consumer | Main Payload |
|---|---|---|
| Initiator/System | Backlog Refiner | Natural-language goal |
| Backlog Refiner | Todo Orchestrator | YAML Story |
| Todo Orchestrator | Dev Crafter | Card assignment plan |
| Dev Crafter | Review Guard | Implementation evidence |
| Review Guard | Done Reporter | Passing review result |
| Review Guard | Blocked Resolver | Failed review or revise action |
| Dev Crafter | Blocked Resolver | Execution failure, timeout, external tool failure |
| Review Guard/System | Human Confirmation | High-risk, low-confidence, external write, deployment, or irreversible trigger |

## Persistence Flow

Based on the design documents, persistence should occur for:

- Goal input and generated YAML Story.
- Goal Space creation and status transitions.
- Card creation, assignment, context, evidence, and current state.
- Every state transition.
- Human confirmation lifecycle.
- AI outputs and review results.
- Audit entries for human, AI, and system actions.
- External execution results and failures.

## Real-Time Flow

Planned SSE events include:

- `card_state_changed`
- `card_created`
- `card_blocked`
- `ai_role_started`
- `ai_role_completed`
- `confirmation_requested`
- `confirmation_decided`
- `goal_space_updated`
- `goal_space_cancelled`
- `session_started`
- `session_completed`
- `session_failed`
- `ai_role_failed`

Resolved after review: realtime events now use `docs/specs/realtime_events.md`, `Last-Event-ID`, and `GET /api/v1/goal-spaces/:id/events?after_id=<event_id>&limit=100`.

## Documented Inconsistencies

| Area | Inconsistency |
|---|---|
| ER diagram | Resolved: `docs/architecture/er_diagram.md` now contains first-pass ER diagram |
| Deployment topology | Resolved: `docs/architecture/deployment_topology.md` now contains first-pass target topology |
| Card state naming | Resolved: canonical states are `backlog/todo/dev/review/done/blocked/cancelled` |
| Card ID format | Resolved: UUID primary key plus `display_id` |
| Priority | Resolved: numeric priority |
| Risk | Resolved: first-class `risk_level` |
| Confirmation events | Resolved: canonical events are `confirmation_requested/confirmation_decided` |

## Implementation Gaps

- No Drizzle schema files found under the configured `./src/core/**/*.schema.ts`.
- No database migrations found.
- No API route or Axum route implementation found.
- No state machine implementation found.
- No persistence code found.
- No SSE implementation found.
