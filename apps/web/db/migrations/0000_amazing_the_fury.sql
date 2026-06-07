CREATE TABLE `agent_executions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`card_id` text,
	`session_id` text,
	`agent_role` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text DEFAULT '{}' NOT NULL,
	`output` text,
	`error` text,
	`duration_ms` integer,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_agent_executions_card` ON `agent_executions` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_executions_session` ON `agent_executions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_executions_status` ON `agent_executions` (`status`);--> statement-breakpoint
CREATE TABLE `audit_entries` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`before_state` text,
	`after_state` text,
	`details` text DEFAULT '{}' NOT NULL,
	`occurred_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entries_entity` ON `audit_entries` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_entries_occurred_at` ON `audit_entries` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `cards` (
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
	FOREIGN KEY (`node_board_id`) REFERENCES `node_boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cards_goal_space_display_id_active` ON `cards` (`goal_space_id`,`display_id`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_cards_goal_space` ON `cards` (`goal_space_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_node_board` ON `cards` (`node_board_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_state` ON `cards` (`state`);--> statement-breakpoint
CREATE INDEX `idx_cards_assigned_to` ON `cards` (`assigned_to`);--> statement-breakpoint
CREATE TABLE `goal_spaces` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`initiator_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`template_id` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`cancel_reason` text,
	FOREIGN KEY (`initiator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_goal_spaces_initiator` ON `goal_spaces` (`initiator_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_spaces_status` ON `goal_spaces` (`status`);--> statement-breakpoint
CREATE TABLE `human_confirmations` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`card_id` text NOT NULL,
	`trigger_type` text NOT NULL,
	`risk_level` text DEFAULT 'medium' NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_by` text,
	`decision_reason` text,
	`decided_at` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decision_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_human_confirmations_card_pending` ON `human_confirmations` (`card_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `idx_human_confirmations_status` ON `human_confirmations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_human_confirmations_expires_at` ON `human_confirmations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `node_board_members` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`board_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`invited_by` text,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	`removed_at` text,
	FOREIGN KEY (`board_id`) REFERENCES `node_boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_node_board_members_board_user_active` ON `node_board_members` (`board_id`,`user_id`) WHERE removed_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_node_board_members_user` ON `node_board_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `node_boards` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`goal_space_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`goal_space_id`) REFERENCES `goal_spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_node_boards_goal_space_key_active` ON `node_boards` (`goal_space_id`,`key`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_node_boards_goal_space` ON `node_boards` (`goal_space_id`);--> statement-breakpoint
CREATE TABLE `realtime_events` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`goal_space_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`published_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`goal_space_id`) REFERENCES `goal_spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_realtime_events_goal_space_sequence` ON `realtime_events` (`goal_space_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_realtime_events_published_at` ON `realtime_events` (`published_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`goal_space_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`last_active_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`closed_at` text,
	`close_reason` text,
	FOREIGN KEY (`goal_space_id`) REFERENCES `goal_spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_goal_space` ON `sessions` (`goal_space_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `sessions` (`status`);--> statement-breakpoint
CREATE TABLE `state_transitions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`from_state` text,
	`to_state` text NOT NULL,
	`trigger` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`reason` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_state_transitions_entity` ON `state_transitions` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_state_transitions_created_at` ON `state_transitions` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'initiator' NOT NULL,
	`preferences` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email_unique` ON `users` (`email`);