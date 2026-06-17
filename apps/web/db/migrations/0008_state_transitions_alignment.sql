-- 0008: Wave 2 sub-group E — state_transitions alignment per spec § 3.7
-- Findings: DB-010, DB-020, DB-040
-- Specs: docs/specs/database_design.md § 3.7
--
-- DB-009 (`card_id` FK) was already added in Wave 1 commit 0f911a3
-- (migration 0003) as a nullable column. This migration does NOT recreate
-- the column or its index.
--
-- DB-010: add `session_id` (nullable FK → sessions.id) per spec § 3.7.
-- DB-020: rename `created_at` → `timestamp`, rename `actor_type` → `actor`,
--         add `actor_name` (nullable) per spec § 3.7.
-- DB-040: add missing spec § 3.7 indexes — `(card_id, timestamp)`,
--         `(session_id)`, `(actor)`. The pre-existing
--         `idx_state_transitions_created_at` is dropped because
--         `RENAME COLUMN created_at → timestamp` does NOT update index
--         references in SQLite; the old index would otherwise dangle on
--         a non-existent column.
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-020: rename created_at → timestamp, actor_type → actor;
--          add actor_name
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `state_transitions` RENAME COLUMN `created_at` TO `timestamp`;--> statement-breakpoint
ALTER TABLE `state_transitions` RENAME COLUMN `actor_type` TO `actor`;--> statement-breakpoint
ALTER TABLE `state_transitions` ADD COLUMN `actor_name` text;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-010: add session_id FK to sessions
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `state_transitions` ADD COLUMN `session_id` text REFERENCES sessions(id);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-040: add missing spec § 3.7 indexes
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS `idx_state_transitions_card_timestamp`
  ON `state_transitions` (`card_id`, `timestamp`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_state_transitions_session_id`
  ON `state_transitions` (`session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_state_transitions_actor`
  ON `state_transitions` (`actor`);--> statement-breakpoint

-- Drop the legacy created_at index. SQLite's RENAME COLUMN does not update
-- the index's internal column reference, so the old index now points at a
-- non-existent column. The composite (card_id, timestamp) index above
-- covers the (timestamp) prefix for any read patterns that previously used
-- idx_state_transitions_created_at.
DROP INDEX IF EXISTS `idx_state_transitions_created_at`;--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
