DROP INDEX IF EXISTS `idx_goal_spaces_story_application_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_goal_spaces_initiator_story_application_id_unique`
ON `goal_spaces` (`initiator_id`, `story_application_id`);--> statement-breakpoint
