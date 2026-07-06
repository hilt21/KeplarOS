<!-- Generated: 2026-07-06 | Files scanned: 11 tables + 13 migrations | Token estimate: ~700 -->

# KEPLAR — Data Codemap (Drizzle/SQLite)

## Source of truth

- **Schema**: `apps/web/db/schema.ts` (809 lines, Drizzle 0.36.4)
- **Driver**: SQLite via `better-sqlite3` 11.5.0
- **Migrations**: `apps/web/db/migrations/0000_*.sql` … `0012_migration_safety_retro.sql`
- **Local DB**: `apps/web/db/dev.db` (+ `-shm`, `-wal`)
- **Drizzle config**: `apps/web/drizzle.config.ts` (dialect `sqlite`)
- **Postgres-compatible**: root `drizzle.config.ts` + `docker-compose.yml`
  (postgres:16-alpine) for future migration target

## Tables (11)

### users
- `id` (UUID), `name`, `email` (unique), `password_hash`, `role`
  (`initiator` | `chain_user` | `viewer`), `preferences` (JSONB),
  `created_at`, `updated_at`, `deleted_at`
- Relations: 1-to-many `goalSpaces` (via `initiator_id`), N-to-N `nodeBoards`
  (via `nodeBoardMembers`)

### goalSpaces
- `id` (UUID), `initiator_id` → users, `goal`, `description`,
  `constraints` (JSONB), `acceptance_criteria` (JSONB),
  `status` (`draft` | `active` | `completed` | `cancelled`),
  `progress` (0–100), `started_at`, `completed_at`, `cancelled_at`,
  `card_counts` (aggregate JSONB), soft-delete
- Aggregation **root**: owns NodeBoards, Cards, Sessions, RealtimeEvents

### nodeBoards
- `id` (UUID), `goal_space_id`, `key` (per-GS unique, partial index
  `WHERE deleted_at IS NULL`), `name`, `description`,
  soft-delete

### nodeBoardMembers
- `node_board_id`, `user_id`, `role_in_board`, `joined_at`, `removed_at`
- **Partial unique index** `(node_board_id, user_id) WHERE removed_at IS NULL`
- Authoritative for access control — never stored as JSON on `nodeBoards`

### sessions
- `id` (UUID), `goal_space_id`, lifecycle timestamps
- Groups AgentExecutions to a single GS run (for SSE recovery, audit linking)

### cards
- `id` (UUID), `goal_space_id`, `node_board_id`, `assigned_to` → users,
  `display_id` (human-readable `CARD-001`, per-GS unique partial index),
  `state` (`backlog` | `todo` | `dev` | `review` | `done` | `blocked`
  | `cancelled`),
  `priority` (int 0–100), `risk_level` (`low` | `medium` | `high` | `critical`),
  `confidence` (real 0–1), `context` (JSONB), `evidence` (JSONB),
  `blocked_at`, `created_at`, `updated_at`, `deleted_at`

### agentExecutions
- `id` (UUID) = public **`task_id`**, `session_id?`, `goal_space_id`,
  `card_id`, `role` (`backlog_refiner` | `todo_orchestrator` | `dev_crafter`
  | `review_guard` | `done_reporter` | `blocked_resolver`),
  `attempt`, `max_attempts` (default 2), `requested_by` → users,
  `input_context`, `result`, `error_code`, `started_at`, `completed_at`
- **Retry semantics**: same row reused with `attempt++`; never new `task_id`

### stateTransitions
- `id`, `card_id`, `from_state`, `to_state`, `trigger`, `actor_type`
  (`human` | `ai_role` | `system`), `actor_id?`, `reason`, `evidence` (JSONB),
  `occurred_at`
- Append-only (no soft-delete)

### humanConfirmations
- `id`, `card_id`, `trigger_type` (`high_risk` | `low_confidence` |
  `external_write` | `deployment` | `irreversible`),
  `target_state`, `trigger_reason`, `decided_by` → users?,
  `status` (`pending` | `approved` | `rejected` | `cancelled`),
  `expires_at` (created_at + 24h), `created_at`, `decided_at`
- **Partial unique index** `(card_id) WHERE status='pending'` — one pending max

### auditEntries
- `id`, `entity_type`, `entity_id`, `actor_type`, `actor_id?`,
  `action`, `before` (JSONB), `after` (JSONB), `summary`, `occurred_at`
- **Append-only**, never cascade-deleted with business entities
- Written in **same TX** as business change (via `runWithAudit`)

### realtimeEvents
- `id` (UUID) = SSE `id:` + replay cursor,
  `goal_space_id`, `sequence` (per-GS monotonic int),
  `type` (one of 13), `resource_type`, `resource_id`,
  `actor_type`, `actor_id?`, `actor_name?`, `data` (JSONB),
  `occurred_at`
- **Unique** `(goal_space_id, sequence)`
- Append-only; written in **same TX** as business + audit
- Replay via `GET /api/v1/goal-spaces/:id/events?after_id=...&limit≤500`

## Relationships (ER)

```
users ─┬─ initiates ─→ goalSpaces
       └─ via nodeBoardMembers ←── nodeBoards ←── scopes ─── cards
                                                            │
                                                            ├─ has ─→ stateTransitions
                                                            ├─ triggers ─→ humanConfirmations
                                                            └─ runs ─→ agentExecutions

goalSpaces ─┬─ contains ─→ nodeBoards, cards, sessions, realtimeEvents
            └─ (no direct cards; cards scoped via nodeBoards)

sessions ──── groups ─→ agentExecutions

auditEntries ── cross-cutting (any entity_type)
realtimeEvents ── cross-cutting (per goal_space_id)
```

## SQLite ↔ Postgres compatibility shims

| Concept | SQLite | Postgres (future) |
|---|---|---|
| UUID | `lower(hex(randomblob(16)))` text | `uuid` type |
| JSONB | text + `JSON()` queries | `jsonb` + GIN index |
| Sequence | per-tx `max(sequence)+1` | `SERIAL` / `BIGSERIAL` |
| Foreign keys | `PRAGMA foreign_keys=ON` (required) | native |
| Soft delete | `deleted_at IS NULL` partial indexes | same |

## Migrations (13 files)

`0000_amazing_the_fury.sql` (initial) → `0012_migration_safety_retro.sql`
Highlights:
- `0001` — agent_executions ownership columns
- `0004` — node_boards alignment
- `0007` — cards alignment (display_id, risk_level, etc.)
- `0009` — audit + realtime alignment
- `0011` — auth credentials
- `0012` — migration safety retro (additive hardening)

Drizzle Kit commands: `pnpm db:generate`, `db:migrate`, `db:check`, `db:studio`.

## Test gates

- `apps/web/__tests__/schema*.test.ts` — schema shape, types, constraints
- `apps/web/__tests__/schema-migrate*.test.ts` — migration application
- `apps/web/__tests__/db/**` — repository-level tests
- `apps/web/__tests__/state-machine/**` — invariant validation against persisted rows

## See also

- `architecture.md` — three-write atomicity invariant
- `backend.md` — `task_id` / SSE cursor mapping
- `docs/specs/database_design.md` — full column-level reference