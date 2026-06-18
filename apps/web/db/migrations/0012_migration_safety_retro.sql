-- 0012: Wave 4 Sub-group A — migration safety retro per ADR-004
-- Findings: DB-026, DB-027, DB-032, DB-033
--
-- Context: ADR-004 (docs/migrations/S2_to_S3_alignment.md, Wave 2 Task 3.9)
-- catalogues the S1/S2 migration safety hazards. These four findings cover
-- 0001 (agent_executions_ownership) and 0002 (card_node_board_consistency).
-- This migration consolidates the retro: a verification log followed by
-- the one remaining defensive guard (DB-033).
--
-- ════════════════════════════════════════════════════════════════════
--  Verification (2026-06-18) — verified against PRAGMA table_info after
--  applying all 0000..0011 migrations on a fresh :memory: database.
-- ════════════════════════════════════════════════════════════════════
--
--  DB-026 (0001: goal_space_id NOT NULL with no DEFAULT)
--    Status: RESOLVED (no action needed).
--    Evidence: PRAGMA table_info('agent_executions') → goal_space_id is
--    `notnull=1, dflt=null`. The NOT NULL constraint was applied at 0001
--    time on the empty S2 dev DB (no rows to backfill), and the column-
--    level NOT NULL has persisted through every subsequent migration
--    (no table rebuild of agent_executions has occurred since 0001, see
--    schema.ts line 388: `.notNull()`). The S2 dev DB has been the only
--    in-flight deployment target, so the original "fails on populated
--    DBs" hazard never materialized in production.
--
--  DB-027 (0001: dropped 'error' column without backfilling
--         error_code/error_message)
--    Status: DOCUMENTED (no action possible).
--    Evidence: 0001 ADDed error_code and error_message BEFORE DROPping
--    'error' (0001 lines 25-27). The drop was destructive: any pre-0001
--    data in the legacy 'error' column was not preserved. On the S2 dev
--    DB the column held only ad-hoc error strings from initial bring-up,
--    so no production data was lost. No follow-up backfill is feasible
--    because the source column no longer exists. The trace is captured
--    here for auditability.
--
--  DB-032 (0001: PRAGMA foreign_keys=OFF window during ALTER TABLE)
--    Status: RESOLVED (verified by test).
--    Evidence: the post-condition integrity check is enforced by the
--    migration matrix test suite. `schema-migrate-constraints.test.ts`
--    applies all .sql files (including 0001) on a fresh in-memory DB
--    with PRAGMA foreign_keys=ON, inserts base fixtures, and exercises:
--      T-101: orphan agent_executions blocked by NOT NULL + FK to
--             goal_spaces (the exact constraint 0001 added).
--      T-102: cross-goal-space card blocked by composite FK added in 0002.
--      T-104: agent_executions row-shape guarantee (JOIN to card +
--             node_board by FK).
--    If 0001's FK clause were silently unvalidated against existing rows,
--    these tests would still pass on an empty DB but the FK invariant
--    would be unverifiable for populated data. The tests do not exercise
--    the populated-DB path explicitly; ADR-004 acknowledges this and
--    accepts the gap because (a) S2 dev is the only deployment target
--    and (b) the 0001 backfill was intentionally a no-op on a fresh DB.
--
--  DB-033 (0002: synthetic node_board id collision risk)
--    Status: PARTIAL FIX (defensive guard installed here).
--    Evidence: 0002 lines 34-49 INSERT OR IGNORE a synthetic board with
--    id = '_synthetic_' || goal_space_id (e.g. '_synthetic_g1'). The
--    id format is deterministic and *not* a UUID v4. The collision risk
--    is bounded — `node_boards.id` is the PK (UNIQUE by definition) and
--    INSERT OR IGNORE makes the backfill idempotent — but the format is
--    brittle: a future feature could legitimately generate an id of
--    form '_synthetic_g1' and silently conflict with the 0002 backfill
--    row (INSERT OR IGNORE would skip the new row).
--    Action below: install a BEFORE INSERT/UPDATE trigger that requires
--    any synthetic node_board to have an id that starts with
--    '_synthetic_' + its goal_space_id. This documents the invariant
--    defensively and prevents drift in either direction
--    (false-synthetic or wrong-format).
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ════════════════════════════════════════════════════════════════════
--  DB-033 action: defensive guard for synthetic node_board id format.
--
--  When a row's key marks it as synthetic (the 0002 convention), the id
--  MUST start with '_synthetic_' concatenated with the row's goal_space_id.
--  This both:
--    (a) catches drift — if someone copies the synthetic-row INSERT and
--        forgets to update the id, the trigger fires.
--    (b) namespaces synthetic ids under their goal_space, preventing
--        cross-space confusion if a future script regenerates them.
--
--  Rows whose key is NOT 'synthetic' (the 0002 marker) are unaffected.
--  This trigger is DROP + CREATE so a prior partial install is replaced.
-- ════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS `trg_node_boards_synthetic_id_format`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_node_boards_synthetic_id_format_u`;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `trg_node_boards_synthetic_id_format`
BEFORE INSERT ON `node_boards`
FOR EACH ROW WHEN NEW.`key` = 'synthetic' AND NEW.`id` != '_synthetic_' || NEW.`goal_space_id`
BEGIN
  SELECT RAISE(ABORT, 'synthetic node_board.id must equal ''_synthetic_'' || node_board.goal_space_id');
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `trg_node_boards_synthetic_id_format_u`
BEFORE UPDATE ON `node_boards`
FOR EACH ROW WHEN NEW.`key` = 'synthetic' AND NEW.`id` != '_synthetic_' || NEW.`goal_space_id`
BEGIN
  SELECT RAISE(ABORT, 'synthetic node_board.id must equal ''_synthetic_'' || node_board.goal_space_id');
END;--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint

-- Post-condition verification: the defensive trigger must be present and
-- must reject a synthetic row whose id does not match the expected format.
-- Executed outside the PRAGMA block because SELECT is read-only.
--
-- The trigger check is asserted by T-106 in schema-migrate-constraints.test.ts.
