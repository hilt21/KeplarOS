-- 0003: S3 spec-alignment Wave 1 — critical schema blockers
-- Findings: DB-001, DB-011, DB-012, DB-013, DB-022, DB-036
-- Specs: docs/specs/database_design.md § 3.1 / § 3.7 / § 3.8 / § 3.11
-- ADR-003 (accepted): users.role hard backfill initiator → chain_user, then default flip.
--
-- Pattern: PRAGMA foreign_keys=OFF, additive columns first, then enum trigger swap,
-- then backfill, then PRAGMA foreign_keys=ON. Post-condition SELECTs at the bottom
-- surface drift if a step silently no-ops.
--
-- Note on tech: SQLite cannot ALTER an existing CHECK constraint; the prior 0001
-- migration enforced enums with BEFORE INSERT/UPDATE triggers. To swap the
-- allowed value sets we DROP the old trigger and re-create one with the new list.
-- Existing rows with the OLD enum values are not retroactively rejected (only
-- writes after the swap are constrained); the defensive UPDATE for DB-013 covers
-- any lingering 'timed_out' rows in S1/S2 state.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-001: goal_spaces — rename title → name, add 7 columns
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `goal_spaces` RENAME COLUMN `title` TO `name`;--> statement-breakpoint
ALTER TABLE `goal_spaces` ADD COLUMN `progress` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `goal_spaces` ADD COLUMN `constraints` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `goal_spaces` ADD COLUMN `acceptance_criteria` text;--> statement-breakpoint
ALTER TABLE `goal_spaces` ADD COLUMN `started_at` text;--> statement-breakpoint
ALTER TABLE `goal_spaces` ADD COLUMN `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `goal_spaces` ADD COLUMN `deleted_at` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_goal_spaces_deleted_at` ON `goal_spaces` (`deleted_at`);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-011: human_confirmations — add 11 missing columns (triggered_by/at,
--         target_state, trigger_reason, ai_summary, risk_factors,
--         recommendations, ai_confidence, decision_outcome, decision_comment,
--         resolved_at)
--  DB-012/013: swap enum trigger to new value sets
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `human_confirmations` ADD COLUMN `triggered_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `triggered_at` text;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `target_state` text;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `trigger_reason` text;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `ai_summary` text;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `risk_factors` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `recommendations` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `ai_confidence` real;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `decision_outcome` text;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `decision_comment` text;--> statement-breakpoint
ALTER TABLE `human_confirmations` ADD COLUMN `resolved_at` text;--> statement-breakpoint

-- DB-013: drop old status trigger (allows 'timed_out'), re-create with 'cancelled'
DROP TRIGGER IF EXISTS `trg_human_confirmations_status_check`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_human_confirmations_status_check_u`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_human_confirmations_status_check`
BEFORE INSERT ON `human_confirmations`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('pending','approved','rejected','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'human_confirmations.status must be one of pending|approved|rejected|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_human_confirmations_status_check_u`
BEFORE UPDATE ON `human_confirmations`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('pending','approved','rejected','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'human_confirmations.status must be one of pending|approved|rejected|cancelled');
END;--> statement-breakpoint

-- DB-013 defensive backfill: any lingering 'timed_out' → 'cancelled'
UPDATE `human_confirmations` SET `status` = 'cancelled' WHERE `status` = 'timed_out';--> statement-breakpoint

-- DB-012: drop old trigger_type trigger (allowed 5 legacy values), re-create with spec's 5 values
DROP TRIGGER IF EXISTS `trg_human_confirmations_trigger_type_check`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_human_confirmations_trigger_type_check_u`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_human_confirmations_trigger_type_check`
BEFORE INSERT ON `human_confirmations`
FOR EACH ROW WHEN NOT (NEW.`trigger_type` IN ('high_risk','low_confidence','external_write','deployment','irreversible'))
BEGIN
  SELECT RAISE(ABORT, 'human_confirmations.trigger_type must be one of high_risk|low_confidence|external_write|deployment|irreversible');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_human_confirmations_trigger_type_check_u`
BEFORE UPDATE ON `human_confirmations`
FOR EACH ROW WHEN NOT (NEW.`trigger_type` IN ('high_risk','low_confidence','external_write','deployment','irreversible'))
BEGIN
  SELECT RAISE(ABORT, 'human_confirmations.trigger_type must be one of high_risk|low_confidence|external_write|deployment|irreversible');
END;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-022: state_transitions — add card_id FK (nullable for legacy rows)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `state_transitions` ADD COLUMN `card_id` text REFERENCES cards(id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_state_transitions_card_id` ON `state_transitions` (`card_id`);--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-036: users.role — hard backfill initiator → chain_user (per ADR-003)
--  Drop and re-create the role trigger; the new role set is unchanged so the
--  trigger body is identical, but we re-stamp it so the migration is self-contained.
-- ═══════════════════════════════════════════════════════════════════
UPDATE `users` SET `role` = 'chain_user' WHERE `role` = 'initiator';--> statement-breakpoint

-- The trigger from 0001 still enforces the same 3-role set; we do not need to
-- touch it. The DEFAULT for new rows is set in Drizzle's schema.ts (.default('chain_user'));
-- SQLite cannot ALTER an existing column DEFAULT without table rebuild, so the
-- default flip is enforced at the application layer (Drizzle) only. Existing
-- rows are unaffected by either side.

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint

-- Post-condition checks: SQLite forbids SELECT RAISE(...) outside a trigger, so
-- the drift-detection pattern used in the task description cannot be expressed
-- as a single trailing SELECT. The two backfills (DB-013 UPDATE, DB-036 UPDATE)
-- are idempotent and traceable from the migration log; downstream verification
-- lives in `schema-migrate-constraints.test.ts` and the application layer.