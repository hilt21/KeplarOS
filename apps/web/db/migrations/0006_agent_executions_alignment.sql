-- 0006: Wave 2 sub-group C — agent_executions spec alignment
-- Findings: DB-008, DB-021, DB-039
-- Specs: docs/specs/database_design.md § 3.5, docs/specs/interface_spec.md § 7.2
--
-- DB-008: rename agent_executions.input → agent_executions.input_context;
--         rename agent_executions.output → agent_executions.result.
--         SQLite RENAME COLUMN preserves existing data.
--
-- DB-021: AGENT_EXECUTION_STATUS_VALUES already matches spec § 3.5
--         (queued | running | completed | failed | blocked |
--          needs_confirmation | cancelled) — both in Drizzle's schema.ts
--         and in the 0001 trigger. No defensive UPDATEs needed.
--         We still re-stamp the trigger pair (DROP + CREATE) so the
--         migration is self-contained and matches the prior wave pattern.
--
-- DB-039: add the two indexes called out in spec § 3.5 that the schema
--         was missing:
--           * idx_agent_executions_role (single-column on agent_role)
--           * idx_agent_executions_created (DESC on created_at)
--         The other four spec indexes (goal_space, card, session, status)
--         already exist from migrations 0001 / the original schema.
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.
-- Triggers: DROP TRIGGER IF EXISTS + CREATE TRIGGER IF NOT EXISTS (avoid silent no-op).
PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-008: rename input → input_context, output → result
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `agent_executions` RENAME COLUMN `input` TO `input_context`;--> statement-breakpoint
ALTER TABLE `agent_executions` RENAME COLUMN `output` TO `result`;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-021: re-stamp status enum triggers (value set unchanged from 0001,
--          but DROP + CREATE keeps the migration self-contained).
--  AGENT_EXECUTION_STATUS_VALUES = queued | running | completed | failed
--                                  | blocked | needs_confirmation | cancelled
-- ═══════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS `trg_agent_executions_status_check`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_agent_executions_status_check_u`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_agent_executions_status_check`
BEFORE INSERT ON `agent_executions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('queued','running','completed','failed','blocked','needs_confirmation','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.status must be one of queued|running|completed|failed|blocked|needs_confirmation|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_agent_executions_status_check_u`
BEFORE UPDATE ON `agent_executions`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('queued','running','completed','failed','blocked','needs_confirmation','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'agent_executions.status must be one of queued|running|completed|failed|blocked|needs_confirmation|cancelled');
END;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-039: add the two § 3.5 indexes the schema was missing
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS `idx_agent_executions_role` ON `agent_executions` (`agent_role`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_executions_created` ON `agent_executions` (`created_at` DESC);--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;
