-- 0004: Wave 2 sub-group A — node_boards and node_board_members spec alignment
-- Findings: DB-003, DB-004, DB-005, DB-029, DB-045
-- Specs: docs/specs/database_design.md § 3.2, § 3.3
--
-- DB-003: node_boards.title → node_boards.name (spec § 3.2 uses 'name').
-- DB-004: node_boards.status enum 'paused' → 'completed' (spec § 3.2 lists
--         'active' | 'completed' | 'archived'). Defensive UPDATE migrates any
--         existing 'paused' rows.
-- DB-005: node_board_members.role enum replaced with 'owner' | 'member' | 'viewer';
--         default is now 'member' (spec § 3.3). Defensive UPDATEs migrate
--         'editor' → 'member' and 'observer' → 'viewer'.
-- DB-029: install BEFORE INSERT/UPDATE CHECK triggers for node_board_members.role
--         (Drizzle text({ enum }) is type-time only, not DB-enforced).
-- DB-045: re-stamp trg_node_boards_status_check (+ _u) with the new value list.
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.
-- Triggers are DROPped then CREATEd (CREATE TRIGGER IF NOT EXISTS would silently
-- no-op if the old trigger still exists with the old value set).

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-003: rename node_boards.title → node_boards.name
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE `node_boards` RENAME COLUMN `title` TO `name`;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-004 / DB-045: replace 'paused' with 'completed' in node_boards.status
-- ═══════════════════════════════════════════════════════════════════
-- Defensive backfill: any 'paused' row should be 0 in a fresh dev DB, but on
-- a populated S2 DB the UPDATE keeps the trigger swap from leaving dangling
-- 'paused' rows behind (triggers only constrain writes, not existing data).
UPDATE `node_boards` SET `status` = 'completed' WHERE `status` = 'paused';--> statement-breakpoint

-- Re-stamp the BEFORE INSERT trigger with the new value set.
DROP TRIGGER IF EXISTS `trg_node_boards_status_check`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_node_boards_status_check`
BEFORE INSERT ON `node_boards`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('active','completed','archived'))
BEGIN
  SELECT RAISE(ABORT, 'node_boards.status must be one of active|completed|archived');
END;--> statement-breakpoint

-- Symmetric BEFORE UPDATE trigger.
DROP TRIGGER IF EXISTS `trg_node_boards_status_check_u`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_node_boards_status_check_u`
BEFORE UPDATE ON `node_boards`
FOR EACH ROW WHEN NOT (NEW.`status` IN ('active','completed','archived'))
BEGIN
  SELECT RAISE(ABORT, 'node_boards.status must be one of active|completed|archived');
END;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  DB-005 / DB-029: replace node_board_members.role enum + install CHECK trigger
-- ═══════════════════════════════════════════════════════════════════
-- Defensive backfills: 0001 schema had role DEFAULT 'editor' with values
-- ('editor','viewer','observer'). 0000 had no role CHECK trigger, so existing
-- rows could be any string. Map the two known legacy values to the new set
-- so that the freshly-installed trigger permits the rows.
UPDATE `node_board_members` SET `role` = 'member' WHERE `role` = 'editor';--> statement-breakpoint
UPDATE `node_board_members` SET `role` = 'viewer' WHERE `role` = 'observer';--> statement-breakpoint

-- DB-029: install BEFORE INSERT trigger for the new role enum.
DROP TRIGGER IF EXISTS `trg_node_board_members_role_check`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_node_board_members_role_check`
BEFORE INSERT ON `node_board_members`
FOR EACH ROW WHEN NOT (NEW.`role` IN ('owner','member','viewer'))
BEGIN
  SELECT RAISE(ABORT, 'node_board_members.role must be one of owner|member|viewer');
END;--> statement-breakpoint

-- Symmetric BEFORE UPDATE trigger.
DROP TRIGGER IF EXISTS `trg_node_board_members_role_check_u`;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_node_board_members_role_check_u`
BEFORE UPDATE ON `node_board_members`
FOR EACH ROW WHEN NOT (NEW.`role` IN ('owner','member','viewer'))
BEGIN
  SELECT RAISE(ABORT, 'node_board_members.role must be one of owner|member|viewer');
END;--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;
