ALTER TABLE `matches` ADD `season_code` text REFERENCES seasons(code);--> statement-breakpoint
CREATE INDEX `idx_matches_season` ON `matches` (`season_code`);