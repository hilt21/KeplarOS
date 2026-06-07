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
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- Enum CHECK constraints (database_design.md § 3 + state_transition.md § 1 + authorization_matrix.md § 2)
-- Status / state / role columns used to be bare text, allowing DB-level writes
-- of any string. PR #1 review P2 #4: tighten at the storage layer.
-- SQLite CHECK cannot reference a value list, so the canonical equivalent
-- is BEFORE INSERT/UPDATE triggers that RAISE(ABORT) with a clear message.
CREATE TRIGGER IF NOT EXISTS trg_users_role_check
BEFORE INSERT ON `users`
FOR EACH ROW WHEN NOT (NEW.`role` IN ('initiator','chain_user','viewer'))
BEGIN
  SELECT RAISE(ABORT, 'users.role must be one of initiator|chain_user|viewer');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_goal_spaces_status_check
BEFORE INSERT ON `goal_spaces`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('draft','active','completed','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'goal_spaces.status must be one of draft|active|completed|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_node_boards_status_check
BEFORE INSERT ON `node_boards`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('active','paused','archived'))
BEGIN
  SELECT RAISE(ABORT, 'node_boards.status must be one of active|paused|archived');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_sessions_status_check
BEFORE INSERT ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('active','paused','expired','closed','crashed'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.status must be one of active|paused|expired|closed|crashed');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_cards_state_check
BEFORE INSERT ON `cards`
FOR EACH ROW WHEN NOT (NEW.`state` IN ('backlog','todo','dev','review','done','blocked','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'cards.state must be one of backlog|todo|dev|review|done|blocked|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_status_check
BEFORE INSERT ON `agent_executions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('queued','running','completed','failed','blocked','needs_confirmation','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.status must be one of queued|running|completed|failed|blocked|needs_confirmation|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_requested_by_type_check
BEFORE INSERT ON `agent_executions`
FOR EACH ROW WHEN NOT (NEW.`requested_by_type` IN ('human','ai_role','system'))
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.requested_by_type must be one of human|ai_role|system');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_human_confirmations_status_check
BEFORE INSERT ON `human_confirmations`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('pending','approved','rejected','timed_out'))
BEGIN
  SELECT RAISE(ABORT, 'human_confirmations.status must be one of pending|approved|rejected|timed_out');
END;--> statement-breakpoint

-- Symmetric UPDATE triggers
CREATE TRIGGER IF NOT EXISTS trg_users_role_check_u
BEFORE UPDATE ON `users`
FOR EACH ROW WHEN NOT (NEW.`role` IN ('initiator','chain_user','viewer'))
BEGIN
  SELECT RAISE(ABORT, 'users.role must be one of initiator|chain_user|viewer');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_goal_spaces_status_check_u
BEFORE UPDATE ON `goal_spaces`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('draft','active','completed','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'goal_spaces.status must be one of draft|active|completed|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_node_boards_status_check_u
BEFORE UPDATE ON `node_boards`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('active','paused','archived'))
BEGIN
  SELECT RAISE(ABORT, 'node_boards.status must be one of active|paused|archived');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_sessions_status_check_u
BEFORE UPDATE ON `sessions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('active','paused','expired','closed','crashed'))
BEGIN
  SELECT RAISE(ABORT, 'sessions.status must be one of active|paused|expired|closed|crashed');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_cards_state_check_u
BEFORE UPDATE ON `cards`
FOR EACH ROW WHEN NOT (NEW.`state` IN ('backlog','todo','dev','review','done','blocked','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'cards.state must be one of backlog|todo|dev|review|done|blocked|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_status_check_u
BEFORE UPDATE ON `agent_executions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('queued','running','completed','failed','blocked','needs_confirmation','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.status must be one of queued|running|completed|failed|blocked|needs_confirmation|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_requested_by_type_check_u
BEFORE UPDATE ON `agent_executions`
FOR EACH ROW WHEN NOT (NEW.`requested_by_type` IN ('human','ai_role','system'))
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.requested_by_type must be one of human|ai_role|system');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_human_confirmations_status_check_u
BEFORE UPDATE ON `human_confirmations`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('pending','approved','rejected','timed_out'))
BEGIN
  SELECT RAISE(ABORT, 'human_confirmations.status must be one of pending|approved|rejected|timed_out');
END;--> statement-breakpoint
-- NOT NULL enforcement for agent_executions.card_id (per PR #1 review P1 #2;
-- SQLite cannot ALTER an existing column to NOT NULL, so the trigger is the
-- idiomatic equivalent. Pairs with the column-level NOT NULL on goal_space_id
-- added in the same migration).
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_card_id_notnull
BEFORE INSERT ON `agent_executions`
FOR EACH ROW WHEN NEW.`card_id` IS NULL
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.card_id must not be NULL');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_agent_executions_card_id_notnull_u
BEFORE UPDATE ON `agent_executions`
FOR EACH ROW WHEN NEW.`card_id` IS NULL
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.card_id must not be NULL');
END;--> statement-breakpoint
