-- 0002: composite FK cards(node_board_id, goal_space_id) -> node_boards(id, goal_space_id)
-- Closes PR #1 review P1 #3: a card in goal_space A pointing to a node_board in
-- goal_space B was previously possible. This constraint forces the two
-- ownership claims to be siblings.
--
-- Note on technique: SQLite's `ALTER TABLE ... ADD CONSTRAINT` is not a
-- supported statement, so the constraint is added by rebuilding the `cards`
-- table with the new FK in its CREATE TABLE definition. The old table is
-- copied 1:1, dropped, and `__new_cards` is renamed to `cards`. All existing
-- indexes are recreated. FK enforcement is off for the duration of the
-- rebuild so the DROP does not cascade to referencing tables
-- (agent_executions, human_confirmations, state_transitions) and so the
-- cross-space rows can be temporarily present in `__new_cards` while the
-- backfill reroutes them.
--
-- SQLite also requires a foreign key's referenced columns to be subject of a
-- UNIQUE or PRIMARY KEY constraint in the parent table. `node_boards(id)` is
-- the PK, but a composite `(id, goal_space_id)` is not. The migration adds a
-- supporting UNIQUE INDEX on `node_boards(id, goal_space_id)` so the new
-- composite FK has a valid target. Since `id` is already the PK, the index
-- is consistent with existing data and cannot fail validation.
PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Supporting UNIQUE INDEX for the new composite FK. Cannot be dropped while
-- the composite FK in `cards` references it.
CREATE UNIQUE INDEX `idx_node_boards_id_goal_space_unique` ON `node_boards` (`id`, `goal_space_id`);--> statement-breakpoint

-- Backfill (runs before the table rebuild so the cross-space rows are fixed
-- before we copy data into the new table; even with FKs off this is the
-- clearer order): for every goal_space that has a card whose
-- (node_board_id, goal_space_id) does not match a row in node_boards,
-- create a synthetic archived node_board in that goal_space and reroute all
-- such cards to it.
INSERT OR IGNORE INTO `node_boards` (`id`, `goal_space_id`, `key`, `title`, `status`, `display_order`)
SELECT '_synthetic_' || `goal_space_id`, `goal_space_id`, 'synthetic', 'Synthetic (auto-created by 0002 backfill)', 'archived', 0
FROM (
  SELECT DISTINCT `goal_space_id` FROM `cards`
  WHERE NOT EXISTS (
    SELECT 1 FROM `node_boards` nb
    WHERE nb.`id` = `cards`.`node_board_id` AND nb.`goal_space_id` = `cards`.`goal_space_id`
  )
);--> statement-breakpoint

UPDATE `cards`
SET `node_board_id` = '_synthetic_' || `goal_space_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `node_boards` nb
  WHERE nb.`id` = `cards`.`node_board_id` AND nb.`goal_space_id` = `cards`.`goal_space_id`
);--> statement-breakpoint

-- Table rebuild: copies the existing `cards` schema, swaps the single-column
-- node_board_id FK for the composite FK, then renames in place.
CREATE TABLE `__new_cards` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`goal_space_id` text NOT NULL,
	`node_board_id` text NOT NULL,
	`display_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`state` text DEFAULT 'backlog' NOT NULL,
	`assigned_to` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`blocked_reason` text,
	`blocked_at` text,
	`cancelled_reason` text,
	`cancelled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`goal_space_id`) REFERENCES `goal_spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_board_id`, `goal_space_id`) REFERENCES `node_boards`(`id`, `goal_space_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_cards` SELECT * FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint

-- Recreate the indexes that were attached to the old `cards` table.
CREATE UNIQUE INDEX `idx_cards_goal_space_display_id_active` ON `cards` (`goal_space_id`,`display_id`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_cards_goal_space` ON `cards` (`goal_space_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_node_board` ON `cards` (`node_board_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_state` ON `cards` (`state`);--> statement-breakpoint
CREATE INDEX `idx_cards_assigned_to` ON `cards` (`assigned_to`);--> statement-breakpoint
-- Enum CHECK for cards.state (Commit 4). The cards table was rebuilt above
-- (DROP/CREATE __new_cards → RENAME), so any trigger defined on the old cards
-- table in 0001 is dropped along with it. Re-establish the trigger here on
-- the rebuilt table so the CHECK actually enforces. Symmetric INSERT+UPDATE.
CREATE TRIGGER IF NOT EXISTS trg_cards_state_check
BEFORE INSERT ON `cards`
FOR EACH ROW WHEN NOT (NEW.`state` IN ('backlog','todo','dev','review','done','blocked','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'cards.state must be one of backlog|todo|dev|review|done|blocked|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS trg_cards_state_check_u
BEFORE UPDATE ON `cards`
FOR EACH ROW WHEN NOT (NEW.`state` IN ('backlog','todo','dev','review','done','blocked','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'cards.state must be one of backlog|todo|dev|review|done|blocked|cancelled');
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
