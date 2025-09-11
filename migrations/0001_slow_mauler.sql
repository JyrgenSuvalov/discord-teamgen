CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` text NOT NULL,
	`team1_id` text NOT NULL,
	`team2_id` text NOT NULL,
	`score1` integer NOT NULL,
	`score2` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`display_name` text
);
--> statement-breakpoint
CREATE TABLE `team_players` (
	`team_id` text NOT NULL,
	`tournament_id` text NOT NULL,
	`player_id` text NOT NULL,
	PRIMARY KEY(`tournament_id`, `team_id`, `player_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`tournament_id` text NOT NULL,
	`id` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`tournament_id`, `id`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournament_players` (
	`tournament_id` text NOT NULL,
	`player_id` text NOT NULL,
	`adr` real,
	`adr_locked` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`tournament_id`, `player_id`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
