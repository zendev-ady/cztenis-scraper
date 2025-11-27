ALTER TABLE `scrape_queue` ADD `depth` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_queue` ADD `source_player_id` integer REFERENCES players(id);