# ADR-004: S2 → S3 Schema Alignment — Migration Template & Dry-Run Matrix

**Status:** Accepted
**Date:** 2026-06-18
**Deciders:** project owner (implementation team)
**Context findings:** DB-026, DB-027, DB-032, DB-033 (Wave 4 migration-safety retro, applied to S1/S2 migrations 0001, 0002)
**Source plan:** `docs/superpowers/plans/2026-06-09-s3-spec-alignment.md` — Wave 2 Task 3.9

## Context

KEPLAR completed 10 numbered migrations during the S2 → S3 schema alignment wave (`0000_amazing_the_fury.sql` through `0010_human_confirmations_decided_by_index.sql`). Of these, **3 required full table-rebuilds** (0002 cards composite-FK, 0005 sessions re-model, 0007 cards alignment) and **every migration except 0000 wrapped its DDL+DML in the `PRAGMA foreign_keys=OFF; BEGIN; ... COMMIT; PRAGMA foreign_keys=ON;` envelope** borrowed from PR #1's `0002_card_node_board_consistency.sql`.

The S1/S2 baseline migrations (0001, 0002) exhibited four known migration-safety hazards:

- **DB-026 (MEDIUM):** `0001` added `goal_space_id NOT NULL` to `agent_executions` with no `DEFAULT` — fails on a populated DB (SQLite requires the table to be empty for ADD COLUMN NOT NULL without a default). The header comment in `0001` lines 11–17 explicitly defers the backfill.
- **DB-027 (MEDIUM):** `0001` dropped the `error` column irreversibly without first backfilling the new `error_code` / `error_message` columns from the legacy `error` text.
- **DB-032 (MEDIUM):** `0001` ran `PRAGMA foreign_keys=OFF` for ALTER but included no post-condition FK sanity check (`SELECT COUNT(*) ... WHERE NOT EXISTS (...)`).
- **DB-033 (MEDIUM):** `0002` backfilled synthetic `node_boards` rows with a deterministic id (`_synthetic_<goal_space_id>`). The id is predictable and could collide with a real board id later. No post-condition join check after the reroute.

These four findings were retro-fitted (notes added in the migration headers; the live DB shape is correct for a fresh `rm -f db/dev.db`) but the underlying anti-patterns were not codified for future migrations. This ADR records the lessons, the template applied to Wave 2, and the dry-run matrix CI uses to catch regressions on any future PR touching `apps/web/db/migrations/`.

## Decision

### 1. Migration template (mandatory for S4+)

Every migration that performs a **destructive change** (column drop, type change, table rebuild) MUST follow this template. Non-destructive migrations (add nullable column + index) MAY use the simpler ADD COLUMN form but MUST still wrap in a transaction.

```sql
-- header comment: finding IDs (DB-XXX), spec reference, prior migration dependency,
--                 and backfill strategy when not literal 1:1.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- 1. DROP old CHECK triggers (if any) that reference soon-to-be-removed columns.
DROP TRIGGER IF EXISTS <old_trigger>;

-- 2. CREATE new table with spec-aligned columns (if table-rebuild).
CREATE TABLE __new_<table> (
  -- spec-aligned columns
);

-- 3. INSERT projection from old to new (preserves data, applies type/default transforms).
INSERT INTO __new_<table> (col1, col2, ...)
  SELECT
    CASE WHEN ... THEN ... ELSE ... END,  -- type transforms
    ...
  FROM <table>;

-- 4. DROP old, RENAME new.
DROP TABLE <table>;
ALTER TABLE __new_<table> RENAME TO <table>;

-- 5. Recreate indexes (DROP/CREATE pattern after rename; check for dangling
--    indexes if RENAME COLUMN was used, because RENAME does NOT update index
--    references to the renamed column).
CREATE INDEX ... ;
DROP INDEX IF EXISTS <old_index>;  -- only if rename left a dangling index

-- 6. Re-establish enum CHECK triggers on the rebuilt table. Triggers attached
--    to the old table are dropped along with it; IF NOT EXISTS will not
--    re-create on a fresh table so the DROP step is informational here.
CREATE TRIGGER <new_trigger_insert>
BEFORE INSERT ON <table>
FOR EACH ROW WHEN NOT (NEW.<col> IN ('a','b','c'))
BEGIN
  SELECT RAISE(ABORT, '<table>.<col> must be one of a|b|c');
END;
CREATE TRIGGER <new_trigger_update>
BEFORE UPDATE ON <table>
FOR EACH ROW WHEN NOT (NEW.<col> IN ('a','b','c'))
BEGIN
  SELECT RAISE(ABORT, '<table>.<col> must be one of a|b|c');
END;

COMMIT;
PRAGMA foreign_keys=ON;
```

### 2. Anti-patterns observed in 0001/0002 (retro-fitted in Wave 4)

| ID | Anti-pattern | Fix (documented in migration header, applied to 0001/0002 retro) |
|----|--------------|------------------------------------------------------------------|
| **DB-026** | `0001` added `goal_space_id NOT NULL` to `agent_executions` with no default — fails on populated DBs | Two-step pattern: (a) `ALTER TABLE ... ADD COLUMN goal_space_id text REFERENCES goal_spaces(id)` nullable; (b) `UPDATE agent_executions SET goal_space_id = ...`; (c) enforce NOT NULL via table rebuild or trigger. For a greenfield `rm -f db/dev.db` the single ADD COLUMN NOT NULL is acceptable. |
| **DB-027** | `0001` dropped `error` column irreversibly, no backfill of `error_code` / `error_message` | Add `error_code text` + `error_message text` columns first, `UPDATE agent_executions SET error_code = ..., error_message = ...` from `error`, then `ALTER TABLE ... DROP COLUMN error`. |
| **DB-032** | `0001` ran `PRAGMA foreign_keys=OFF` for ALTER, but no post-condition FK sanity check | After `PRAGMA foreign_keys=ON`, run `SELECT COUNT(*) FROM agent_executions ae WHERE NOT EXISTS (SELECT 1 FROM goal_spaces gs WHERE gs.id = ae.goal_space_id);` — fail the migration if non-zero. |
| **DB-033** | `0002` synthetic `node_board` id `_synthetic_<goal_space_id>` can collide with a real id | Use `lower(hex(randomblob(16)))` (the same UUID v4 generator used elsewhere in the schema) for synthetic ids + a post-condition join check (`SELECT COUNT(*) FROM cards c WHERE NOT EXISTS (SELECT 1 FROM node_boards nb WHERE nb.id = c.node_board_id AND nb.goal_space_id = c.goal_space_id);`). |

### 3. Dry-run matrix (CI gate)

For every PR that touches `apps/web/db/migrations/`, CI runs the following coverage. The matrix is the single source of truth for "did the migration chain still produce a valid schema":

| Test file | Coverage |
|-----------|----------|
| `apps/web/__tests__/schema-migrate.test.ts` | Loads only the alphabetically-first migration (`0000_amazing_the_fury.sql`) on in-memory SQLite. Verifies (a) all 11 expected tables are present, (b) the three partial-unique indexes (`idx_node_board_members_board_user_active`, `idx_cards_goal_space_display_id_active`, `idx_human_confirmations_card_pending`) are present and contain the expected `WHERE removed_at IS NULL` / `WHERE deleted_at IS NULL` / `WHERE status='pending'` clauses, (c) UUID defaults produce 32-char hex, (d) JSON defaults parse, (e) timestamp defaults are ISO-8601. **Catches:** a hand-written `0000` regression that breaks the partial-unique index. |
| `apps/web/__tests__/schema-migrate-constraints.test.ts` | Loads ALL migrations (0000 → latest) on in-memory SQLite, inserts base fixtures, runs T-100 → T-105 to verify (a) enum CHECK triggers reject illegal values, (b) orphan `agent_executions` insert is blocked by NOT NULL `goal_space_id`, (c) cross-goal-space `cards`/`node_boards` insert is blocked by composite FK, (d) cross-owner goal space read is rejected by `canReadGoalSpace`, (e) the spec-mandated `idx_confirm_decided_by` index on `human_confirmations(decision_by)` exists (T-105). **Catches:** any new migration that breaks enum triggers, FK constraints, or spec-mandated indexes. |
| `apps/web/__tests__/audit/run-with-audit.test.ts` | Loads ALL migrations, exercises `runWithAudit` for AC-4.2 (business + audit + realtime three-segment same-transaction commit), AC-4.3 (audit write fails → business rollback via BEFORE INSERT trigger), AC-4.4 (sequence 1..10 strict), AC-4.6 (`skipRealtime=true` skips realtime_events). **Catches:** a migration that breaks the audit-write path or the sequence generator. |
| `apps/web/__tests__/audit/integration.test.ts` | Loads ALL migrations, runs end-to-end round-trip (`cards` + `runWithAudit` writes `audit_entries` + `realtime_events`), verifies FK chain (`goal_spaces → cards`) actually enforces. **Catches:** a migration that breaks the FK chain or the JSON round-trip on `audit_entries.action_data` / `realtime_events.payload`. |
| `apps/web/__tests__/audit/append-only.test.ts` | Static import-time check that `@/lib/audit` does NOT export `updateAuditEntry`, `deleteAuditEntry`, `truncateAudit`, or `dropAuditTable`. **Catches:** an append-only contract violation that would let a future migration's repair script leak through. |

### 4. Migration index reference

| # | File | Findings | Notes |
|---|------|----------|-------|
| 0000 | `0000_amazing_the_fury.sql` | initial schema | Immutable baseline; defines the 11 tables referenced by all subsequent migrations. |
| 0001 | `0001_agent_executions_ownership.sql` | DB-026/027/032 (retro-fitted) | NOT NULL on `goal_space_id` after backfill; `error` column dropped after backfill; FK pragma envelope. Adds enum CHECK triggers for `users.role`, `goal_spaces.status`, `node_boards.status`, `sessions.status`, `cards.state`, `agent_executions.status`, `agent_executions.requested_by_type`, `human_confirmations.status`. |
| 0002 | `0002_card_node_board_consistency.sql` | DB-033 (retro-fitted) | First user of the table-rebuild pattern (`__new_cards`). Adds supporting UNIQUE INDEX `idx_node_boards_id_goal_space_unique` so the new composite FK `(node_board_id, goal_space_id) → node_boards(id, goal_space_id)` has a valid target. Backfills synthetic archived node_boards with deterministic id `_synthetic_<goal_space_id>`. Re-establishes `trg_cards_state_check` on the rebuilt table. |
| 0003 | `0003_s3_schema_blockers.sql` | DB-001/011/012/013/022/036 | Wave 1 S3 blockers; `goal_spaces.title → name` rename + 6 columns + `idx_goal_spaces_deleted_at`. Note: this is the file that consumed Wave 1 task 2.5 + ADR-003 (`users.role` default flip). |
| 0004 | `0004_node_boards_alignment.sql` | DB-003/004/005/029/045 | Wave 2A: node_boards + node_board_members spec alignment. |
| 0005 | `0005_sessions_re_model.sql` | DB-006/007/021 (session portion) | Wave 2B: full table-rebuild. Pre-0005 sessions was a user-session (`user_id`, `role`, `expires_at`, `last_active_at`, `closed_at`, `close_reason`); § 3.4 specifies a run-session (`status`, `trigger`, `actor`, `actor_name`, `started_at`, `completed_at`, `context`). Backfills `actor = 'human'` and stuffs legacy `user_id` into `actor_name`. Replaces 0001's `sessions.status` enum trigger with § 3.4 enum `queued|running|completed|failed|cancelled`. |
| 0006 | `0006_agent_executions_alignment.sql` | DB-008/039/021 (agent_executions portion) | Wave 2C: agent_executions spec alignment per § 3.5. |
| 0007 | `0007_cards_alignment.sql` | DB-014/015/023/035/038 | Wave 2D: full table-rebuild. Two type changes (`cards.priority text → integer`, `cards.display_id integer → VARCHAR(50)`) plus four new columns (`risk_level`, `evidence`, `confidence`, `dependencies`). Priority default per spec § 3.6 is `0` (the plan mis-stated `3`; spec and DB-015 finding recommendation agree on `0`). Re-establishes the cards.state enum CHECK trigger on the rebuilt table. |
| 0008 | `0008_state_transitions_alignment.sql` | DB-010/020/040 | Wave 2E: state_transitions spec alignment per § 3.7. |
| 0009 | `0009_audit_realtime_alignment.sql` | DB-016/017/018/019/031/042/043 | Wave 2F: audit_entries + realtime_events spec alignment; `AuditContext` interface cascaded. |
| 0010 | `0010_human_confirmations_decided_by_index.sql` | DB-041 | Wave 2G. Spec § 3.8 calls for `idx_confirm_decided_by ON human_confirmations(decided_by)`. Actual schema column is `decision_by` (Drizzle `decisionBy`); the index **name** follows the spec while the **column reference** uses the actual column. Note: the plan grouped DB-041 under "goal_spaces" but DB-041 is about human_confirmations — implemented as written. |

## Consequences

- **S4+ migrations MUST follow §1 template** for any destructive change. The table-rebuild pattern (`__new_<table>`) is the canonical answer for "SQLite can't `ALTER TABLE ... DROP COLUMN` or change a column type".
- **Anti-patterns in §2 are documented** to prevent regression. Any future migration that needs to ADD COLUMN NOT NULL on a populated DB MUST use the two-step add-nullable → backfill → enforce pattern, not the single-step 0001 form.
- **The dry-run matrix in §3 provides CI coverage** for migration safety. The five test files together verify (a) the baseline schema shape, (b) all enum CHECK triggers and FK constraints enforce after the full chain, (c) the audit / realtime round-trip survives, (d) the append-only contract holds, (e) spec-mandated indexes are present.
- **The migration index in §4 is the single source of truth** for "what ran, when, why". When investigating a database drift bug, start here.

## Follow-ups (deferred to Wave 4)

- Apply DB-026 / DB-027 / DB-032 / DB-033 retro-fixes as **proper** migrations if any production data exists. For greenfield (`rm -f db/dev.db`), the current header-comment documentation is sufficient.
- Regenerate Drizzle meta snapshots (`apps/web/db/migrations/meta/0000-0002_snapshot.json`) if `drizzle-kit` is adopted for S4+ migration generation. Currently hand-written and committed alongside the SQL files.
- Promote the table-rebuild pattern to a shared `apps/web/db/migration-helpers/` module that emits the `__new_<table>` / projection / rename sequence from a JS object spec, eliminating hand-written SQL drift across table rebuilds.

## Related ADRs

- ADR-001: `canReadGoalSpace` member access (`docs/superpowers/decisions/2026-06-10-001-can-read-goal-space.md`)
- ADR-002: `CARD_TRANSITIONS` refactor (`docs/superpowers/decisions/2026-06-10-002-card-transitions-actor-triples.md`)
- ADR-003: `users.role` default backfill (`docs/superpowers/decisions/2026-06-10-003-users-role-default-backfill.md`)
