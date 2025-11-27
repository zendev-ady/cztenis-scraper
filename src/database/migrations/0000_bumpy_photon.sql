CREATE TABLE `h2h_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player1_id` integer NOT NULL,
	`player2_id` integer NOT NULL,
	`total_matches` integer DEFAULT 0,
	`player1_wins` integer DEFAULT 0,
	`player2_wins` integer DEFAULT 0,
	`last_match_date` integer,
	`first_match_date` integer,
	`last_winner_id` integer,
	`last_score` text,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`player1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_winner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_h2h_player1` ON `h2h_stats` (`player1_id`);--> statement-breakpoint
CREATE INDEX `idx_h2h_player2` ON `h2h_stats` (`player2_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `h2h_stats_player1_id_player2_id_unique` ON `h2h_stats` (`player1_id`,`player2_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`match_type` text NOT NULL,
	`competition_type` text NOT NULL,
	`round` text NOT NULL,
	`round_order` integer,
	`player1_id` integer,
	`player2_id` integer,
	`player1_partner_id` integer,
	`player2_partner_id` integer,
	`score` text,
	`score_set1` text,
	`score_set2` text,
	`score_set3` text,
	`is_walkover` integer DEFAULT false,
	`winner_id` integer,
	`points_earned` integer,
	`match_date` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player1_partner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player2_partner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_tournament` ON `matches` (`tournament_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_player1` ON `matches` (`player1_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_player2` ON `matches` (`player2_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_winner` ON `matches` (`winner_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_date` ON `matches` (`match_date`);--> statement-breakpoint
CREATE INDEX `idx_matches_type` ON `matches` (`match_type`,`competition_type`);--> statement-breakpoint
CREATE TABLE `player_rankings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`season_code` text NOT NULL,
	`youth_junior_rank` integer,
	`youth_junior_bh` integer,
	`youth_senior_rank` integer,
	`youth_senior_bh` integer,
	`junior_rank` integer,
	`junior_bh` integer,
	`adult_rank` integer,
	`adult_bh` integer,
	`club` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_code`) REFERENCES `seasons`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rankings_player` ON `player_rankings` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_rankings_season` ON `player_rankings` (`season_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_rankings_player_id_season_code_unique` ON `player_rankings` (`player_id`,`season_code`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`birth_year` integer,
	`current_club` text,
	`registration_valid_until` integer,
	`last_scraped_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_players_name` ON `players` (`name`);--> statement-breakpoint
CREATE INDEX `idx_players_birth_year` ON `players` (`birth_year`);--> statement-breakpoint
CREATE TABLE `scrape_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`priority` integer DEFAULT 0,
	`status` text DEFAULT 'pending',
	`attempts` integer DEFAULT 0,
	`last_attempt_at` integer,
	`error_message` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_queue_status` ON `scrape_queue` (`status`,`priority`);--> statement-breakpoint
CREATE UNIQUE INDEX `scrape_queue_player_id_unique` ON `scrape_queue` (`player_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`season_type` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_code_unique` ON `seasons` (`code`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`venue` text,
	`date` integer,
	`category` text,
	`category_points` integer,
	`age_category` text,
	`season_code` text,
	`singles_capacity` integer,
	`doubles_capacity` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`season_code`) REFERENCES `seasons`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tournaments_date` ON `tournaments` (`date`);--> statement-breakpoint
CREATE INDEX `idx_tournaments_season` ON `tournaments` (`season_code`);