-- 0010: Wave 2 sub-group G — human_confirmations decided_by index per spec § 3.8
-- Findings: DB-041
--
-- DB-001 / DB-044 / DB-045 were already addressed in Wave 1 migration 0003
-- (goal_spaces rename + 6 columns + idx_goal_spaces_deleted_at).
--
-- DB-021 is a verify-only finding for this sub-group: GOAL_SPACE_STATUS_VALUES
-- in schema.ts (["draft","active","completed","cancelled"]) already matches
-- spec § 3.1, so no enum change is required.
--
-- DB-041: spec § 3.8 calls for idx_confirm_decided_by ON
-- human_confirmations(decided_by). The schema has the column as `decision_by`
-- (consistent with Drizzle's `decisionBy` field name); the index name follows
-- the spec while the column reference uses the actual column. Current schema
-- has the partial unique index on card_id (pending) plus status and
-- expires_at indexes only.
--
-- Note: the plan grouped DB-041 under "goal_spaces" sub-group, but DB-041
-- is actually about human_confirmations. The plan is implemented as written
-- here — adding the correct spec-mandated index on human_confirmations.
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-041: idx_human_confirmations_decided_by ON human_confirmations(decision_by)
--  (spec § 3.8 names the column "decided_by" but the schema and migrations
--   use "decision_by"; index name follows the spec, column references match
--   the actual schema)
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS `idx_human_confirmations_decided_by`
  ON `human_confirmations` (`decision_by`);--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;
