-- 0007: Wave 2 sub-group D — cards alignment
-- Findings: DB-014, DB-015, DB-023, DB-035, DB-038
-- Specs: docs/specs/database_design.md § 3.6, docs/specs/interface_spec.md § 4.1
--
-- DB-014: change `cards.priority` text → integer; change `cards.display_id`
--         integer → VARCHAR(50). Two type changes plus four new columns —
--         SQLite's `ALTER TABLE` can't change column types, so the rebuild
--         pattern (0002 / 0005) is required.
--
-- DB-015: spec § 3.6 says `priority INTEGER DEFAULT 0`. The plan's task
--         description says default 3, but the spec and the DB-015 finding
--         recommendation agree on 0. Spec wins.
--
-- DB-023: add `risk_level` (text, NOT NULL, enum), `evidence` (JSON array),
--         `confidence` (real, nullable), `dependencies` (JSON array of card
--         IDs). All carry their spec § 3.6 defaults.
--
-- DB-035: add a CHECK trigger pair (INSERT + UPDATE) enforcing the
--         `cards.state` enum `backlog|todo|dev|review|done|blocked|cancelled`.
--         The Drizzle schema already constrains writes through the
--         `{ enum: CARD_STATES }` literal; this trigger adds DB-level
--         enforcement for any direct SQL writer (replays, repair scripts).
--
-- DB-038: spec § 3.6 indexes. The existing schema has
--         `idx_cards_goal_space_display_id_active` (partial unique) and
--         single-column indexes for goal_space, node_board, state, and
--         assigned_to. Spec adds:
--           * `idx_cards_display_id` (DB-038 — single-column, now text)
--           * `idx_cards_priority` (DESC)
--           * `idx_cards_risk_level`
--           * `idx_cards_created` (DESC)
--         (The `idx_cards_tags USING GIN(tags)` from the spec is PostgreSQL-
--         only; SQLite has no GIN. We skip it and document the choice in
--         the migration ADR.)
--
-- Backfill strategy for the type changes:
--   * `display_id int → text`: `printf('CARD-%03d', display_id)` →
--     'CARD-001', 'CARD-002', ... . Matches the spec example exactly.
--   * `priority text → int`: map the legacy enum values
--     (critical→1, high→2, medium→3, low→4, deferred→5) so legacy rows
--     keep their semantic meaning. Unknown values fall back to 3 (spec
--     default). Note the spec default is 0, not 3 — the backfill default
--     is intentionally the *previous* medium so legacy rows don't all
--     flip to the lowest priority.
--   * `risk_level` / `evidence` / `confidence` / `dependencies`: new
--     columns, no legacy data. All backfill rows get the spec defaults.
--
-- Pattern: PRAGMA foreign_keys=OFF; BEGIN TRANSACTION; ... COMMIT; PRAGMA foreign_keys=ON.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  Build the new `cards` table (DB-014, DB-023)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE `__new_cards` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`goal_space_id` text NOT NULL,
	`node_board_id` text NOT NULL,
	`display_id` text NOT NULL,                                          -- DB-014: int → text
	`title` text NOT NULL,
	`description` text,
	`state` text DEFAULT 'backlog' NOT NULL,                             -- DB-035: enum via trigger
	`assigned_to` text,
	`priority` integer DEFAULT 0 NOT NULL,                               -- DB-014, DB-015: text → int
	`risk_level` text DEFAULT 'medium' NOT NULL,                         -- DB-023: new
	`evidence` text DEFAULT '[]' NOT NULL,                               -- DB-023: new (JSON)
	`confidence` real,                                                   -- DB-023: new (nullable)
	`dependencies` text DEFAULT '[]' NOT NULL,                           -- DB-023: new (JSON array)
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

-- ═══════════════════════════════════════════════════════════════════
--  Project legacy rows into __new_cards
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO `__new_cards` (
	`id`, `goal_space_id`, `node_board_id`, `display_id`, `title`, `description`, `state`,
	`assigned_to`, `priority`, `risk_level`, `evidence`, `confidence`, `dependencies`,
	`tags`, `context`, `blocked_reason`, `blocked_at`, `cancelled_reason`, `cancelled_at`,
	`created_at`, `updated_at`, `deleted_at`
)
SELECT
	`id`,
	`goal_space_id`,
	`node_board_id`,
	printf('CARD-%03d', `display_id`) AS `display_id`,                   -- int → 'CARD-NNN'
	`title`,
	`description`,
	`state`,
	`assigned_to`,
	CASE `priority`                                                      -- text → int (preserve semantics)
		WHEN 'critical'  THEN 5                                          -- highest priority per spec §3.6 (数值越大越优先)
		WHEN 'high'      THEN 4
		WHEN 'medium'    THEN 3
		WHEN 'low'       THEN 2
		WHEN 'deferred'  THEN 1                                          -- lowest priority per spec §3.6
		ELSE 3                                                            -- unknown values → medium-equivalent
	END AS `priority`,
	'medium' AS `risk_level`,                                            -- new column, default fill
	'[]' AS `evidence`,                                                  -- new column, default fill
	NULL AS `confidence`,                                                -- new column, nullable
	'[]' AS `dependencies`,                                              -- new column, default fill
	`tags`,
	COALESCE(`context`, '{}') AS `context`,
	`blocked_reason`,
	`blocked_at`,
	`cancelled_reason`,
	`cancelled_at`,
	`created_at`,
	`updated_at`,
	`deleted_at`
FROM `cards`;--> statement-breakpoint

DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  Recreate indexes (DB-038)
-- ═══════════════════════════════════════════════════════════════════
-- Single-column indexes called out in spec § 3.6.
CREATE INDEX `idx_cards_goal_space` ON `cards` (`goal_space_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_node_board` ON `cards` (`node_board_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_state` ON `cards` (`state`);--> statement-breakpoint
CREATE INDEX `idx_cards_assigned_to` ON `cards` (`assigned_to`);--> statement-breakpoint
-- DB-038: single-column index on display_id (now text). The
-- partial-unique index below also covers display_id, but a non-unique
-- btree supports the lookup patterns the spec calls out.
CREATE INDEX `idx_cards_display_id` ON `cards` (`display_id`);--> statement-breakpoint
-- Spec § 3.6 also requires priority, risk_level, and created_at indexes.
CREATE INDEX `idx_cards_priority` ON `cards` (`priority` DESC);--> statement-breakpoint
CREATE INDEX `idx_cards_risk_level` ON `cards` (`risk_level`);--> statement-breakpoint
CREATE INDEX `idx_cards_created` ON `cards` (`created_at` DESC);--> statement-breakpoint
-- The partial-unique index for (goal_space_id, display_id) is preserved
-- verbatim from 0000 — the only change is that display_id is text now
-- (the index definition is type-agnostic).
CREATE UNIQUE INDEX `idx_cards_goal_space_display_id_active`
	ON `cards` (`goal_space_id`, `display_id`)
	WHERE `deleted_at` IS NULL;--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════
--  CHECK trigger for cards.state (DB-035)
-- ═══════════════════════════════════════════════════════════════════
-- Symmetric INSERT + UPDATE. The Drizzle schema's { enum: CARD_STATES }
-- already constrains application writes; the trigger is the DB-level
-- belt-and-suspenders for direct SQL writers (replays, repair scripts).
CREATE TRIGGER IF NOT EXISTS `trg_cards_state_check`
BEFORE INSERT ON `cards`
FOR EACH ROW WHEN NOT (NEW.`state` IN ('backlog','todo','dev','review','done','blocked','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'cards.state must be one of backlog|todo|dev|review|done|blocked|cancelled');
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_cards_state_check_u`
BEFORE UPDATE OF `state` ON `cards`
FOR EACH ROW WHEN NOT (NEW.`state` IN ('backlog','todo','dev','review','done','blocked','cancelled'))
BEGIN
  SELECT RAISE(ABORT, 'cards.state must be one of backlog|todo|dev|review|done|blocked|cancelled');
END;--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;
