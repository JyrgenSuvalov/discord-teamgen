CREATE TABLE `match_team_players` (
	`match_id` integer NOT NULL,
	`team_id` text NOT NULL,
	`player_id` text NOT NULL,
	`adr_at_time` real,
	PRIMARY KEY(`match_id`, `team_id`, `player_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
