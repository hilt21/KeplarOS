-- 0009: Wave 2 sub-group F — audit_entries & realtime_events alignment per spec § 3.9, § 3.10
-- Findings: DB-016, DB-017, DB-018, DB-019, DB-031, DB-042, DB-043
--
-- DB-016 + DB-017 + DB-031: realtime_events column renames
--   event_type → type, payload → data, published_at → occurred_at;
--   replace idx_realtime_events_published_at with idx_realtime_events_occurred_at
--   (SQLite RENAME COLUMN does not update index references, so the old index
--   must be dropped and recreated against the new column name).
--
-- DB-019: audit_entries column renames
--   actor_type → actor, occurred_at → timestamp; add actor_name (nullable).
--
-- DB-042: replace idx_audit_entries_occurred_at with idx_audit_entries_timestamp
--   (same SQLite RENAME COLUMN / index quirk).
--
-- DB-043: idx_realtime_events_goal_space_sequence is preserved as-is
--   (DB-043 is a verify-only finding per the plan; no change needed).
--
-- DB-018: the resource_type CHECK trigger remains out of scope (this sub-group
--   is renames + indexes only; CHECK trigger is deferred).
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-016 + DB-017 + DB-031: realtime_events column renames
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `realtime_events` RENAME COLUMN `event_type` TO `type`;--> statement-breakpoint
ALTER TABLE `realtime_events` RENAME COLUMN `payload` TO `data`;--> statement-breakpoint
ALTER TABLE `realtime_events` RENAME COLUMN `published_at` TO `occurred_at`;--> statement-breakpoint

-- Replace the publishedAt index with an occurredAt index. SQLite's
-- RENAME COLUMN does not update the index's internal column reference,
-- so the old index would otherwise dangle on a non-existent column.
DROP INDEX IF EXISTS `idx_realtime_events_published_at`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_realtime_events_occurred_at`
  ON `realtime_events` (`occurred_at`);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-019: audit_entries column renames + add actor_name
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `audit_entries` RENAME COLUMN `actor_type` TO `actor`;--> statement-breakpoint
ALTER TABLE `audit_entries` RENAME COLUMN `occurred_at` TO `timestamp`;--> statement-breakpoint
ALTER TABLE `audit_entries` ADD COLUMN `actor_name` text;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-042: rename occurredAtIdx → idx_audit_entries_timestamp
-- ═══════════════════════════════════════════════════════════════════
-- Same SQLite quirk: RENAME COLUMN does not update index references.
DROP INDEX IF EXISTS `idx_audit_entries_occurred_at`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_entries_timestamp`
  ON `audit_entries` (`timestamp`);--> statement-breakpoint

-- DB-043: idx_realtime_events_goal_space_sequence is preserved (no change).

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;
