ALTER TABLE `goal_spaces` ADD COLUMN `story_application_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_goal_spaces_story_application_id_unique`
ON `goal_spaces` (`story_application_id`);--> statement-breakpoint
