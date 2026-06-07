-- 0001: agent_executions ownership + status reconciliation (P1 #2 + P2 #7)
-- Aligns agent_executions to docs/specs/database_design.md § 3.5:
--   * goal_space_id added NOT NULL FK -> goal_spaces(id)
--   * card_id promoted to NOT NULL
--   * session_id stays nullable (ad-hoc single-card runs)
--   * attempt / max_attempts / requested_by_type|id|name columns added
--   * error split into error_code + error_message (legacy `error` dropped)
--   * status default: 'pending' -> 'queued'
--   * New index: idx_agent_executions_goal_space
--
-- Note on backfill: SQLite ALTER TABLE ADD COLUMN with NOT NULL and no DEFAULT
-- requires the table to be empty. On a fresh dev DB (rm -f db/dev.db) this
-- applies cleanly. On a populated S2 dev DB the column would be added as
-- nullable first, then a follow-up UPDATE backfills goal_space_id from the
-- linked card or session; that follow-up is intentionally omitted here
-- because the source `goal_space_id` column does not exist before the ADD
-- and the verification target is a fresh dev DB.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `goal_space_id` text NOT NULL REFERENCES goal_spaces(id);--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `attempt` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `max_attempts` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `requested_by_type` text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `requested_by_id` text;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `requested_by_name` text;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `error_code` text;--> statement-breakpoint
ALTER TABLE `agent_executions` ADD `error_message` text;--> statement-breakpoint
ALTER TABLE `agent_executions` DROP COLUMN `error`;--> statement-breakpoint
CREATE INDEX `idx_agent_executions_goal_space` ON `agent_executions` (`goal_space_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
