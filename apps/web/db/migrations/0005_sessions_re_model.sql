-- 0005: sessions re-model (database_design.md § 3.4)
-- Closes S2 review findings DB-006, DB-007, DB-021 (session portion).
--
-- § 3.4 specifies `sessions` as a *run-session* (status, trigger, actor,
-- actor_name, started_at, completed_at, context, created_at, updated_at).
-- The pre-0005 schema modeled it as a *user-session* (user_id, role,
-- expires_at, last_active_at, closed_at, close_reason). This migration
-- drops the auth-style columns and adds the run-session columns.
--
-- § 3.4 status enum: queued/running/completed/failed/cancelled
-- (replaces active/paused/expired/closed/crashed from 0001's trigger).
-- Trigger/actor/actor_name enums mirror the Drizzle schema's
-- SESSION_TRIGGER_VALUES / SESSION_ACTOR_VALUES.
--
-- The table-rebuild technique follows the 0002 pattern: SQLite has no
-- `ALTER TABLE ... DROP COLUMN`/`ADD CONSTRAINT` for the changes we need
-- (drop multiple columns, change defaults, change status enum), so we
-- create __new_sessions, project the preserved columns from the old table,
-- drop the old table, and rename. FK enforcement is disabled for the
-- rebuild so DROP doesn't cascade to referencing tables
-- (agent_executions.session_id).
--
-- Backfill (Option B from the plan): the old `user_id` is the only
-- meaningful user-attribution column we have. Since the new
-- `sessions.actor` enum is `human|ai_role|system` (free-form text
-- constrained by the trigger below) and a raw user_id is none of those
-- three, we set `actor = 'human'` for any legacy row that had a user_id
-- (every old row did) and fall back to `'system'` if user_id is somehow
-- null. The raw user_id is preserved by stuffing it into `actor_name`
-- (which is a free-form VARCHAR(100) per § 3.4 with no enum) so the
-- original attribution is not lost. `trigger` is set to 'manual_start'
-- — the only value in SESSION_TRIGGER_VALUES that maps to a real user
-- action. `started_at` is derived from `created_at` so the row has a
-- non-null run-session timeline.

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- The 0001 INSERT/UPDATE triggers on `sessions` enforce the old
-- active/paused/expired/closed/crashed enum and reference the old column
-- set. They would abort the rebuild (the new __new_sessions table won't
-- even have the old status values). Drop them now; the rebuild below
-- recreates the table from scratch and we redefine the trigger for the
-- new enum afterwards.
DROP TRIGGER IF EXISTS `trg_sessions_status_check`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_sessions_status_check_u`;--> statement-breakpoint

CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`goal_space_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`trigger` text NOT NULL,
	`actor` text NOT NULL,
	`actor_name` text,
	`context` text DEFAULT '{}' NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`goal_space_id`) REFERENCES `goal_spaces`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

-- Project preserved columns into __new_sessions. Notes on the cast:
--   * `status`: legacy rows that were `closed_at IS NOT NULL` with
--     `close_reason = 'completed'` map to 'completed'; any other
--     `closed_at IS NOT NULL` row maps to 'cancelled'; everything else
--     (still-open sessions) maps to 'running' — never 'queued' since
--     legacy rows were never in a queued state.
--   * `trigger` is hard-coded to 'manual_start' for legacy rows because
--     the old schema had no trigger concept and 'manual_start' is the
--     only value in SESSION_TRIGGER_VALUES that maps to a real user
--     action.
--   * `actor` is 'human' if the old row had a user_id, 'system'
--     otherwise. The raw user_id goes into `actor_name` so the original
--     attribution is preserved (actor_name is free-form VARCHAR(100)
--     per § 3.4 with no enum CHECK).
INSERT INTO `__new_sessions` (
	`id`, `goal_space_id`, `status`, `trigger`, `actor`, `actor_name`,
	`context`, `started_at`, `completed_at`, `created_at`, `updated_at`
)
SELECT
	`id`,
	`goal_space_id`,
	CASE
		WHEN `closed_at` IS NOT NULL AND `close_reason` = 'completed' THEN 'completed'
		WHEN `closed_at` IS NOT NULL THEN 'cancelled'
		ELSE 'running'
	END AS `status`,
	'manual_start' AS `trigger`,
	CASE WHEN `user_id` IS NOT NULL THEN 'human' ELSE 'system' END AS `actor`,
	`user_id` AS `actor_name`,
	COALESCE(`context`, '{}') AS `context`,
	COALESCE(`created_at`, datetime('now')) AS `started_at`,
	`closed_at` AS `completed_at`,
	`created_at`,
	`updated_at`
FROM `sessions`;--> statement-breakpoint

DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint

-- Recreate the indexes that the new table needs (per § 3.4):
--   idx_sessions_goal_space, idx_sessions_status, idx_sessions_created
-- The old idx_sessions_user is intentionally not recreated — the new
-- table has no user_id column.
CREATE INDEX `idx_sessions_goal_space` ON `sessions` (`goal_space_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_created` ON `sessions` (`created_at` DESC);--> statement-breakpoint

-- Enum CHECK triggers (per § 3.4 and § 3 schema_enforcement note).
-- These replace the 0001 triggers that were dropped at the top of this
-- migration. Symmetric INSERT + UPDATE.
CREATE TRIGGER IF NOT EXISTS `trg_sessions_status_check`
BEFORE INSERT ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('queued','running','completed','failed','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.status must be one of queued|running|completed|failed|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sessions_status_check_u`
BEFORE UPDATE ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('queued','running','completed','failed','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.status must be one of queued|running|completed|failed|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sessions_trigger_check`
BEFORE INSERT ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`trigger` IN ('manual_start','ai_retry','system_resume'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.trigger must be one of manual_start|ai_retry|system_resume');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sessions_trigger_check_u`
BEFORE UPDATE ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`trigger` IN ('manual_start','ai_retry','system_resume'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.trigger must be one of manual_start|ai_retry|system_resume');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sessions_actor_check`
BEFORE INSERT ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`actor` IN ('human','ai_role','system'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.actor must be one of human|ai_role|system');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_sessions_actor_check_u`
BEFORE UPDATE ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`actor` IN ('human','ai_role','system'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.actor must be one of human|ai_role|system');
END;--> statement-breakpoint

PRAGMA foreign_keys=ON;
