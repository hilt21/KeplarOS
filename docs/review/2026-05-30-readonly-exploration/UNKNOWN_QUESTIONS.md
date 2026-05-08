# UNKNOWN_QUESTIONS

## Resolved Decisions 2026-05-30

| Area | Decision |
|---|---|
| Canonical domain source | First phase uses TypeScript/Drizzle schema as the canonical domain/API/database type source; Rust aligns later |
| Runtime semantics | Web and Desktop must share one contract; they must not implement independent business semantics |
| First implementation | Start from shared contract and one runtime; do not implement both runtimes independently first |
| ACP/MCP/A2A | Mock behind a stable execution boundary in the first functional slice; real external writes require gates |
| Aggregate roots | `GoalSpace` is the core aggregate root; `NodeBoard` and `Session` are persisted entities |
| Card IDs | `id` is UUID; `display_id` stores `CARD-001` style human-readable IDs |
| Priority | `priority` is numeric; UI can map ranges to high/medium/low |
| Risk | `risk_level` is a first-class field; `tags` are supplemental |
| Card states | Canonical states are `backlog/todo/dev/review/done/blocked/cancelled` |
| Human confirmation | Pending confirmation is a strict gate for execute/unblock/complete and external write operations |
| Audit | Audit is append-only; audit write failure fails the main operation |
| Database deletion | Business entities use soft delete; governance records are retained |
| Authorization | Endpoint/resource rules live in `docs/specs/authorization_matrix.md` |
| Phase 1 scope | Freeze Web-first Board demo slice; defer Rust/Tauri/real MCP/production deploy |
| AI contracts | Add `docs/specs/ai_agent_contracts.md`; Backlog Refiner and Review Guard are field-level contracts |
| Realtime events | Add `docs/specs/realtime_events.md`; SSE uses event IDs, replay cursor, and multi-tab leader/follower behavior |
| AI execution persistence | Add `agent_executions`; `agent_executions.id` is the API `task_id`, while `sessions` groups goal-space runs |
| Node membership | Add `node_board_members`; node access is checked through active membership rows, not JSON arrays |
| Goal Space cancellation | Add Goal Space `cancelled` terminal state and `POST /api/v1/goal-spaces/:id/cancel`; cancellation is not reported as completed |

The original questions remain below as an audit trail; follow-up reviews should close or refine them as implementation begins.

## Architecture

1. Should TypeScript or Rust own the canonical domain model?
2. Are Web and Desktop expected to implement identical business semantics independently, or should one runtime delegate to the other?
3. Should the first implementation target Next.js API routes, Axum, or a shared contract with one runtime first?
4. Where should shared API types live so Web, Rust, and documentation do not drift?
5. Should ACP/MCP/A2A be implemented in the first functional slice or mocked behind a stable interface?

## Domain Model

1. Is `Goal Space` the only aggregate root, or is `Node Board` also a persisted aggregate?
2. Are cards globally unique UUID records, human-readable `CARD-001` records, or both?
3. Should card priority be numeric or `high|medium|low`?
4. Should card risk be a first-class field or encoded in `tags`?
5. Is `lane` a state, an assignee, a processing role, or a separate entity?
6. Should `Session` be persisted as its own table? It appears in architecture but not in database design.
7. Should `Node Board` be persisted? It appears in architecture but not in database design.

## State Machines

1. Which card state vocabulary is canonical: `backlog/todo/dev/review/done/blocked` or `active/waiting/blocked/review/done`?
2. Can `Done` ever transition back, or is it strictly terminal?
3. Does cancelling a card require a separate terminal state?
4. Can a Goal Space enter `completed` automatically, or must initiator confirmation always be required?
5. Are state transitions validated in domain core, API handlers, database constraints, or all three?

## Authorization and Governance

1. What is the endpoint-level role matrix for `initiator`, `chain_user`, and `viewer`?
2. What resource ownership rules prevent cross-goal-space reads and writes?
3. Can a chain user see all cards in a goal space or only assigned/current-node cards?
4. Who can start, complete, or cancel a Goal Space?
5. Who can manually block or unblock a card?
6. Who can trigger AI execution?
7. Who can approve or reject human confirmation requests?

## Human Confirmation

1. Is human confirmation a strict gate for high-risk and low-confidence paths?
2. If a pending confirmation exists, must `execute`, `unblock`, `complete`, and external tool write actions fail?
3. Does approval return a card to Review, Done, or the pre-confirmation target state?
4. Is a rejected confirmation always mapped to `blocked`?
5. What happens to expired confirmations after 24 hours: cancel only, or block card too?
6. Are confirmation decisions reversible?

## Audit

1. Are audit records append-only?
2. Must audit writes be in the same transaction as state-changing operations?
3. If audit write fails, should the main operation fail?
4. What is the audit retention policy?
5. Should audit records survive card deletion even if transitions and confirmations cascade?
6. Does audit need export/signature/tamper-evidence for governance use cases?

## Database

1. Should SQLite and PostgreSQL share one logical schema with dialect adapters?
2. How should UUID, JSONB, GIN indexes, and foreign key behavior be normalized for SQLite?
3. Should Drizzle schema live under `src/core/**/*.schema.ts` as configured?
4. Should migrations be generated or handwritten?
5. Should `audit_entries` have foreign keys or remain polymorphic?
6. Should cascade delete be allowed for governance records?

## External Execution

1. Which MCP/ACP tools are read-only, write-capable, deployment-capable, or irreversible?
2. Which external tool calls require human confirmation?
3. How are credentials stored and scoped per user, project, or goal space?
4. Are tool calls sandboxed per card/session?
5. What command/file/network operations are allowed in desktop mode?
6. How are external tool outputs normalized into evidence and audit entries?

## Testing and CI

1. Should the first test framework be Vitest, Rust tests, or both?
2. Should interface contract tests be generated from `interface_spec.md` or manually maintained?
3. Should the missing `docs/development-guidelines/card-schema.json` be created, or should the workflow be removed?
4. Should CI run `cargo test --workspace` even while crates are placeholders?
5. What is the minimum test gate before adding real API endpoints?

## Documentation

1. Should `er_diagram.md` duplicate or reference the ER diagram in `database_design.md`?
2. Should `deployment_topology.md` be filled before implementation starts?
3. Which document is canonical for SSE event names?
4. Should `global_unified_spec.md` be split into actionable config files once tooling is installed?
