import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

// Messages table removed - was only used for the old ping command

// Tournament management
export const tournaments = sqliteTable("tournaments", {
	id: text("id").primaryKey(), // "2025-08-30-1" format
	status: text("status", { enum: ["open", "locked", "closed"] })
		.notNull()
		.default("open"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Player registry
export const players = sqliteTable("players", {
	id: text("id").primaryKey(), // Discord user ID
	username: text("username"),
	displayName: text("display_name"),
	defaultAdr: real("default_adr"), // Default ADR for future tournaments
});

// Tournament participation
export const tournamentPlayers = sqliteTable(
	"tournament_players",
	{
		tournamentId: text("tournament_id")
			.notNull()
			.references(() => tournaments.id),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id),
		adr: real("adr"), // Float with 2 decimals, nullable
		adrLocked: integer("adr_locked", { mode: "boolean" })
			.notNull()
			.default(false),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tournamentId, table.playerId] }),
	}),
);

// Generated teams
export const teams = sqliteTable(
	"teams",
	{
		tournamentId: text("tournament_id")
			.notNull()
			.references(() => tournaments.id),
		id: text("id").notNull(), // "TEAM1", "TEAM2", etc.
		locked: integer("locked", { mode: "boolean" }).notNull().default(false),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.tournamentId, table.id] }),
	}),
);

// Team composition
export const teamPlayers = sqliteTable(
	"team_players",
	{
		teamId: text("team_id").notNull(),
		tournamentId: text("tournament_id").notNull(),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id),
	},
	(table) => ({
		pk: primaryKey({
			columns: [table.tournamentId, table.teamId, table.playerId],
		}),
	}),
);

// Match results
export const matches = sqliteTable("matches", {
	id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
	tournamentId: text("tournament_id")
		.notNull()
		.references(() => tournaments.id),
	team1Id: text("team1_id").notNull(),
	team2Id: text("team2_id").notNull(),
	score1: integer("score1").notNull(),
	score2: integer("score2").notNull(),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Match team compositions - captures exact team lineups when match was played
export const matchTeamPlayers = sqliteTable(
	"match_team_players",
	{
		matchId: integer("match_id")
			.notNull()
			.references(() => matches.id),
		teamId: text("team_id").notNull(),
		playerId: text("player_id")
			.notNull()
			.references(() => players.id),
		adrAtTime: real("adr_at_time"), // ADR value at the time the match was played
	},
	(table) => ({
		pk: primaryKey({ columns: [table.matchId, table.teamId, table.playerId] }),
	}),
);

// Message types removed - were only used for the old ping command

// Type exports for tournament tables
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

export type TournamentPlayer = typeof tournamentPlayers.$inferSelect;
export type NewTournamentPlayer = typeof tournamentPlayers.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type NewTeamPlayer = typeof teamPlayers.$inferInsert;

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

export type MatchTeamPlayer = typeof matchTeamPlayers.$inferSelect;
export type NewMatchTeamPlayer = typeof matchTeamPlayers.$inferInsert;

// Indexes for better query performance
export const tournamentStatusIndex = index("tournament_status_idx").on(
	tournaments.status,
);
export const matchesTournamentIndex = index("matches_tournament_idx").on(
	matches.tournamentId,
);
export const matchesCreatedAtIndex = index("matches_created_at_idx").on(
	matches.createdAt,
);
