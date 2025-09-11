import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "./index";
import {
	type Match,
	matches,
	matchTeamPlayers,
	type NewMatch,
	type NewMatchTeamPlayer,
	type NewPlayer,
	type NewTeam,
	type NewTeamPlayer,
	type NewTournament,
	type NewTournamentPlayer,
	type Player,
	players,
	type Team,
	type Tournament,
	type TournamentPlayer,
	teamPlayers,
	teams,
	tournamentPlayers,
	tournaments,
} from "./schema";
import { DatabaseError } from "./types";

/**
 * Database repository classes for tournament management
 */

/**
 * Repository for tournament operations
 */
export class TournamentRepository {
	constructor(private db: Database) {}

	/**
	 * Create a new tournament with the given ID
	 */
	async createTournament(id: string): Promise<void> {
		try {
			const newTournament: NewTournament = {
				id,
				status: "open",
			};

			await this.db.insert(tournaments).values(newTournament);
		} catch (error) {
			throw new DatabaseError("Failed to create tournament", error);
		}
	}

	/**
	 * Get the currently open tournament
	 */
	async getOpenTournament(): Promise<Tournament | null> {
		try {
			const result = await this.db
				.select()
				.from(tournaments)
				.where(eq(tournaments.status, "open"))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get open tournament", error);
		}
	}

	/**
	 * Get tournament by ID
	 */
	async getTournamentById(id: string): Promise<Tournament | null> {
		try {
			const result = await this.db
				.select()
				.from(tournaments)
				.where(eq(tournaments.id, id))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get tournament by ID", error);
		}
	}

	/**
	 * Close a tournament by setting its status to 'closed'
	 */
	async closeTournament(id: string): Promise<void> {
		try {
			await this.db
				.update(tournaments)
				.set({ status: "closed" })
				.where(eq(tournaments.id, id));
		} catch (error) {
			throw new DatabaseError("Failed to close tournament", error);
		}
	}

	/**
	 * Generate a unique tournament ID for the given date in YYYY-MM-DD-N format
	 */
	async generateTournamentId(date: string): Promise<string> {
		try {
			// Get all tournaments for the given date
			const existingTournaments = await this.db
				.select({ id: tournaments.id })
				.from(tournaments)
				.where(sql`${tournaments.id} LIKE ${`${date}-%`}`);

			// Extract the sequence numbers and find the next available one
			const sequenceNumbers = existingTournaments
				.map((t) => {
					const parts = t.id.split("-");
					return parseInt(parts[parts.length - 1], 10);
				})
				.filter((n) => !Number.isNaN(n))
				.sort((a, b) => a - b);

			// Find the next sequence number
			let nextSequence = 1;
			for (const num of sequenceNumbers) {
				if (num === nextSequence) {
					nextSequence++;
				} else {
					break;
				}
			}

			return `${date}-${nextSequence}`;
		} catch (error) {
			throw new DatabaseError("Failed to generate tournament ID", error);
		}
	}

	/**
	 * Check if a tournament with the given ID exists
	 */
	async tournamentExists(id: string): Promise<boolean> {
		try {
			const result = await this.db
				.select({ id: tournaments.id })
				.from(tournaments)
				.where(eq(tournaments.id, id))
				.limit(1);

			return result.length > 0;
		} catch (error) {
			throw new DatabaseError("Failed to check tournament existence", error);
		}
	}

	/**
	 * Get tournament status
	 */
	async getTournamentStatus(id: string): Promise<string | null> {
		try {
			const result = await this.db
				.select({ status: tournaments.status })
				.from(tournaments)
				.where(eq(tournaments.id, id))
				.limit(1);

			return result[0]?.status || null;
		} catch (error) {
			throw new DatabaseError("Failed to get tournament status", error);
		}
	}
}

/**
 * Repository for player operations
 */
export class PlayerRepository {
	constructor(private db: Database) {}

	/**
	 * Insert or update a player (UPSERT operation)
	 */
	async upsertPlayer(playerData: NewPlayer): Promise<void> {
		try {
			await this.db
				.insert(players)
				.values(playerData)
				.onConflictDoUpdate({
					target: players.id,
					set: {
						username: playerData.username,
						displayName: playerData.displayName,
						...(playerData.defaultAdr !== undefined && {
							defaultAdr: playerData.defaultAdr,
						}),
					},
				});
		} catch (error) {
			throw new DatabaseError("Failed to upsert player", error);
		}
	}

	/**
	 * Get a player by ID
	 */
	async getPlayer(id: string): Promise<Player | null> {
		try {
			const result = await this.db
				.select()
				.from(players)
				.where(eq(players.id, id))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get player", error);
		}
	}

	/**
	 * Get all players in a tournament with their ADR status
	 */
	async getTournamentPlayers(
		tournamentId: string,
	): Promise<(TournamentPlayer & { player?: Player })[]> {
		try {
			const result = await this.db
				.select({
					tournamentId: tournamentPlayers.tournamentId,
					playerId: tournamentPlayers.playerId,
					adr: tournamentPlayers.adr,
					adrLocked: tournamentPlayers.adrLocked,
					player: {
						id: players.id,
						username: players.username,
						displayName: players.displayName,
						defaultAdr: players.defaultAdr,
					},
				})
				.from(tournamentPlayers)
				.leftJoin(players, eq(tournamentPlayers.playerId, players.id))
				.where(eq(tournamentPlayers.tournamentId, tournamentId));

			return result.map((row) => ({
				tournamentId: row.tournamentId,
				playerId: row.playerId,
				adr: row.adr,
				adrLocked: row.adrLocked,
				player: row.player || undefined,
			}));
		} catch (error) {
			throw new DatabaseError("Failed to get tournament players", error);
		}
	}

	/**
	 * Insert or update a tournament player's ADR (UPSERT operation)
	 */
	async upsertTournamentPlayer(data: NewTournamentPlayer): Promise<void> {
		try {
			await this.db
				.insert(tournamentPlayers)
				.values(data)
				.onConflictDoUpdate({
					target: [tournamentPlayers.tournamentId, tournamentPlayers.playerId],
					set: {
						adr: data.adr,
						adrLocked: data.adrLocked ?? false,
					},
				});
		} catch (error) {
			throw new DatabaseError("Failed to upsert tournament player", error);
		}
	}

	/**
	 * Get a specific tournament player
	 */
	async getTournamentPlayer(
		tournamentId: string,
		playerId: string,
	): Promise<TournamentPlayer | null> {
		try {
			const result = await this.db
				.select()
				.from(tournamentPlayers)
				.where(
					and(
						eq(tournamentPlayers.tournamentId, tournamentId),
						eq(tournamentPlayers.playerId, playerId),
					),
				)
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get tournament player", error);
		}
	}

	/**
	 * Lock or unlock a player's ADR
	 */
	async setPlayerAdrLock(
		tournamentId: string,
		playerId: string,
		locked: boolean,
	): Promise<void> {
		try {
			await this.db
				.update(tournamentPlayers)
				.set({ adrLocked: locked })
				.where(
					and(
						eq(tournamentPlayers.tournamentId, tournamentId),
						eq(tournamentPlayers.playerId, playerId),
					),
				);
		} catch (error) {
			throw new DatabaseError("Failed to set player ADR lock", error);
		}
	}

	/**
	 * Check if a player's ADR is locked
	 */
	async isPlayerAdrLocked(
		tournamentId: string,
		playerId: string,
	): Promise<boolean> {
		try {
			const result = await this.db
				.select({ adrLocked: tournamentPlayers.adrLocked })
				.from(tournamentPlayers)
				.where(
					and(
						eq(tournamentPlayers.tournamentId, tournamentId),
						eq(tournamentPlayers.playerId, playerId),
					),
				)
				.limit(1);

			return result[0]?.adrLocked || false;
		} catch (error) {
			throw new DatabaseError("Failed to check player ADR lock status", error);
		}
	}

	/**
	 * Get players with missing ADRs for a tournament
	 */
	async getPlayersWithoutAdr(
		tournamentId: string,
	): Promise<(TournamentPlayer & { player?: Player })[]> {
		try {
			const result = await this.db
				.select({
					tournamentId: tournamentPlayers.tournamentId,
					playerId: tournamentPlayers.playerId,
					adr: tournamentPlayers.adr,
					adrLocked: tournamentPlayers.adrLocked,
					player: {
						id: players.id,
						username: players.username,
						displayName: players.displayName,
						defaultAdr: players.defaultAdr,
					},
				})
				.from(tournamentPlayers)
				.leftJoin(players, eq(tournamentPlayers.playerId, players.id))
				.where(
					and(
						eq(tournamentPlayers.tournamentId, tournamentId),
						sql`${tournamentPlayers.adr} IS NULL`,
					),
				);

			return result.map((row) => ({
				tournamentId: row.tournamentId,
				playerId: row.playerId,
				adr: row.adr,
				adrLocked: row.adrLocked,
				player: row.player || undefined,
			}));
		} catch (error) {
			throw new DatabaseError("Failed to get players without ADR", error);
		}
	}

	/**
	 * Update a player's default ADR
	 */
	async updateDefaultAdr(
		playerId: string,
		defaultAdr: number | null,
	): Promise<void> {
		try {
			await this.db
				.update(players)
				.set({ defaultAdr })
				.where(eq(players.id, playerId));
		} catch (error) {
			throw new DatabaseError("Failed to update default ADR", error);
		}
	}

	/**
	 * Join a player to a tournament (idempotent operation)
	 * Prefills ADR from player's defaultAdr if available
	 */
	async joinTournament(
		tournamentId: string,
		playerId: string,
		username: string,
		displayName?: string,
	): Promise<void> {
		try {
			// First, upsert the player record
			await this.upsertPlayer({
				id: playerId,
				username,
				displayName,
			});

			// Get the player's default ADR
			const player = await this.getPlayer(playerId);
			const defaultAdr = player?.defaultAdr || null;

			// Insert into tournament_players if not already present (idempotent)
			await this.db
				.insert(tournamentPlayers)
				.values({
					tournamentId,
					playerId,
					adr: defaultAdr,
					adrLocked: false,
				})
				.onConflictDoNothing();
		} catch (error) {
			throw new DatabaseError("Failed to join tournament", error);
		}
	}

	/**
	 * Remove a player from a tournament
	 * Only removes from tournament_players, keeps player record and history intact
	 */
	async leaveTournament(tournamentId: string, playerId: string): Promise<void> {
		try {
			await this.db
				.delete(tournamentPlayers)
				.where(
					and(
						eq(tournamentPlayers.tournamentId, tournamentId),
						eq(tournamentPlayers.playerId, playerId),
					),
				);
		} catch (error) {
			throw new DatabaseError("Failed to leave tournament", error);
		}
	}

	/**
	 * Check if a player is in a tournament
	 */
	async isPlayerInTournament(
		tournamentId: string,
		playerId: string,
	): Promise<boolean> {
		try {
			const result = await this.db
				.select({ playerId: tournamentPlayers.playerId })
				.from(tournamentPlayers)
				.where(
					and(
						eq(tournamentPlayers.tournamentId, tournamentId),
						eq(tournamentPlayers.playerId, playerId),
					),
				)
				.limit(1);

			return result.length > 0;
		} catch (error) {
			throw new DatabaseError("Failed to check tournament membership", error);
		}
	}
}

/**
 * Repository for team operations
 */
export class TeamRepository {
	constructor(private db: Database) {}

	/**
	 * Create teams for a tournament
	 */
	async createTeams(
		tournamentId: string,
		teamData: { id: string; players: string[] }[],
	): Promise<void> {
		try {
			console.log(
				`Creating teams for tournament ${tournamentId}:`,
				JSON.stringify(teamData, null, 2),
			);

			// First, clear any existing teams for this tournament
			await this.clearTeams(tournamentId);

			// Insert teams
			const teamInserts: NewTeam[] = teamData.map((team) => ({
				tournamentId,
				id: team.id,
				locked: false,
			}));

			console.log("Inserting teams:", JSON.stringify(teamInserts, null, 2));
			await this.db.insert(teams).values(teamInserts);

			// Insert team players
			const teamPlayerInserts: NewTeamPlayer[] = [];
			for (const team of teamData) {
				for (const playerId of team.players) {
					teamPlayerInserts.push({
						teamId: team.id,
						tournamentId,
						playerId,
					});
				}
			}

			console.log(
				"Inserting team players:",
				JSON.stringify(teamPlayerInserts, null, 2),
			);

			if (teamPlayerInserts.length > 0) {
				await this.db.insert(teamPlayers).values(teamPlayerInserts);
			}

			console.log("Teams created successfully");
		} catch (error) {
			console.error("Database error in createTeams:", error);
			console.error("Error details:", {
				name: error?.constructor?.name,
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			throw new DatabaseError("Failed to create teams", error);
		}
	}

	/**
	 * Get all teams for a tournament with their players
	 */
	async getTeams(
		tournamentId: string,
	): Promise<
		(Team & { players?: (TournamentPlayer & { player?: Player })[] })[]
	> {
		try {
			// Get teams
			const teamsResult = await this.db
				.select()
				.from(teams)
				.where(eq(teams.tournamentId, tournamentId));

			// Get team players with their data
			const teamPlayersResult = await this.db
				.select({
					teamId: teamPlayers.teamId,
					tournamentId: teamPlayers.tournamentId,
					playerId: teamPlayers.playerId,
					tournamentPlayer: {
						tournamentId: tournamentPlayers.tournamentId,
						playerId: tournamentPlayers.playerId,
						adr: tournamentPlayers.adr,
						adrLocked: tournamentPlayers.adrLocked,
					},
					player: {
						id: players.id,
						username: players.username,
						displayName: players.displayName,
						defaultAdr: players.defaultAdr,
					},
				})
				.from(teamPlayers)
				.leftJoin(
					tournamentPlayers,
					and(
						eq(teamPlayers.playerId, tournamentPlayers.playerId),
						eq(teamPlayers.tournamentId, tournamentPlayers.tournamentId),
					),
				)
				.leftJoin(players, eq(teamPlayers.playerId, players.id))
				.where(eq(teamPlayers.tournamentId, tournamentId));

			// Combine teams with their players
			return teamsResult.map((team) => ({
				...team,
				players: teamPlayersResult
					.filter((tp) => tp.teamId === team.id)
					.map((tp) => ({
						tournamentId: tp.tournamentPlayer?.tournamentId || tp.tournamentId,
						playerId: tp.playerId,
						adr: tp.tournamentPlayer?.adr || null,
						adrLocked: tp.tournamentPlayer?.adrLocked || false,
						player: tp.player || undefined,
					})),
			}));
		} catch (error) {
			throw new DatabaseError("Failed to get teams", error);
		}
	}

	/**
	 * Get a specific team by ID
	 */
	async getTeam(tournamentId: string, teamId: string): Promise<Team | null> {
		try {
			const result = await this.db
				.select()
				.from(teams)
				.where(and(eq(teams.tournamentId, tournamentId), eq(teams.id, teamId)))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get team", error);
		}
	}

	/**
	 * Lock all teams for a tournament
	 */
	async lockTeams(tournamentId: string): Promise<void> {
		try {
			await this.db
				.update(teams)
				.set({ locked: true })
				.where(eq(teams.tournamentId, tournamentId));
		} catch (error) {
			throw new DatabaseError("Failed to lock teams", error);
		}
	}

	/**
	 * Unlock all teams for a tournament
	 */
	async unlockTeams(tournamentId: string): Promise<void> {
		try {
			await this.db
				.update(teams)
				.set({ locked: false })
				.where(eq(teams.tournamentId, tournamentId));
		} catch (error) {
			throw new DatabaseError("Failed to unlock teams", error);
		}
	}

	/**
	 * Clear all teams and team players for a tournament
	 */
	async clearTeams(tournamentId: string): Promise<void> {
		try {
			// Delete team players first (due to foreign key constraints)
			await this.db
				.delete(teamPlayers)
				.where(eq(teamPlayers.tournamentId, tournamentId));

			// Delete teams
			await this.db.delete(teams).where(eq(teams.tournamentId, tournamentId));
		} catch (error) {
			throw new DatabaseError("Failed to clear teams", error);
		}
	}

	/**
	 * Remove a specific player from all teams in a tournament
	 */
	async removePlayerFromTeams(
		tournamentId: string,
		playerId: string,
	): Promise<void> {
		try {
			await this.db
				.delete(teamPlayers)
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						eq(teamPlayers.playerId, playerId),
					),
				);
		} catch (error) {
			throw new DatabaseError("Failed to remove player from teams", error);
		}
	}

	/**
	 * Check if teams exist for a tournament
	 */
	async teamsExist(tournamentId: string): Promise<boolean> {
		try {
			const result = await this.db
				.select({ id: teams.id })
				.from(teams)
				.where(eq(teams.tournamentId, tournamentId))
				.limit(1);

			return result.length > 0;
		} catch (error) {
			throw new DatabaseError("Failed to check if teams exist", error);
		}
	}

	/**
	 * Check if teams are locked for a tournament
	 */
	async areTeamsLocked(tournamentId: string): Promise<boolean> {
		try {
			const result = await this.db
				.select({ locked: teams.locked })
				.from(teams)
				.where(eq(teams.tournamentId, tournamentId))
				.limit(1);

			return result[0]?.locked || false;
		} catch (error) {
			throw new DatabaseError("Failed to check if teams are locked", error);
		}
	}

	/**
	 * Validate that team IDs exist for a tournament
	 */
	async validateTeamIds(
		tournamentId: string,
		teamIds: string[],
	): Promise<string[]> {
		try {
			const result = await this.db
				.select({ id: teams.id })
				.from(teams)
				.where(
					and(eq(teams.tournamentId, tournamentId), inArray(teams.id, teamIds)),
				);

			const existingIds = result.map((t) => t.id);
			return teamIds.filter((id) => !existingIds.includes(id));
		} catch (error) {
			throw new DatabaseError("Failed to validate team IDs", error);
		}
	}

	/**
	 * Get player's current team assignment
	 */
	async getPlayerTeam(
		tournamentId: string,
		playerId: string,
	): Promise<{ teamId: string; tournamentId: string } | null> {
		try {
			const result = await this.db
				.select({
					teamId: teamPlayers.teamId,
					tournamentId: teamPlayers.tournamentId,
				})
				.from(teamPlayers)
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						eq(teamPlayers.playerId, playerId),
					),
				)
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get player team", error);
		}
	}

	/**
	 * Exchange two players between teams
	 * Swaps their team assignments in team_players table only
	 */
	async exchangePlayers(
		tournamentId: string,
		player1Id: string,
		player2Id: string,
	): Promise<void> {
		try {
			// Get current team assignments
			const [player1Team, player2Team] = await Promise.all([
				this.getPlayerTeam(tournamentId, player1Id),
				this.getPlayerTeam(tournamentId, player2Id),
			]);

			if (!player1Team || !player2Team) {
				throw new DatabaseError(
					"One or both players not found in tournament teams",
					null,
				);
			}

			if (player1Team.teamId === player2Team.teamId) {
				throw new DatabaseError("Players are on the same team", null);
			}

			// Perform the swap using sequential updates
			// Note: Using sequential updates instead of transaction due to D1 compatibility

			// Update player 1 to player 2's team
			await this.db
				.update(teamPlayers)
				.set({ teamId: player2Team.teamId })
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						eq(teamPlayers.playerId, player1Id),
					),
				);

			// Update player 2 to player 1's team
			await this.db
				.update(teamPlayers)
				.set({ teamId: player1Team.teamId })
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						eq(teamPlayers.playerId, player2Id),
					),
				);
		} catch (error) {
			throw new DatabaseError("Failed to exchange players", error);
		}
	}

	/**
	 * Get current team compositions with player ADRs for match capture
	 */
	async getTeamCompositionsForMatch(
		tournamentId: string,
		teamId1: string,
		teamId2: string,
	): Promise<{
		team1Players: Array<{ playerId: string; adr: number | null }>;
		team2Players: Array<{ playerId: string; adr: number | null }>;
	}> {
		try {
			const result = await this.db
				.select({
					teamId: teamPlayers.teamId,
					playerId: teamPlayers.playerId,
					adr: tournamentPlayers.adr,
				})
				.from(teamPlayers)
				.leftJoin(
					tournamentPlayers,
					and(
						eq(teamPlayers.playerId, tournamentPlayers.playerId),
						eq(teamPlayers.tournamentId, tournamentPlayers.tournamentId),
					),
				)
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						inArray(teamPlayers.teamId, [teamId1, teamId2]),
					),
				);

			const team1Players = result
				.filter((row) => row.teamId === teamId1)
				.map((row) => ({ playerId: row.playerId, adr: row.adr }));

			const team2Players = result
				.filter((row) => row.teamId === teamId2)
				.map((row) => ({ playerId: row.playerId, adr: row.adr }));

			return { team1Players, team2Players };
		} catch (error) {
			throw new DatabaseError(
				"Failed to get team compositions for match",
				error,
			);
		}
	}

	/**
	 * Add a player to a specific team with capacity validation
	 */
	async addPlayerToTeam(
		tournamentId: string,
		playerId: string,
		teamId: string,
	): Promise<void> {
		try {
			// First check if the team exists
			const teamExists = await this.db
				.select({ id: teams.id })
				.from(teams)
				.where(and(eq(teams.tournamentId, tournamentId), eq(teams.id, teamId)))
				.limit(1);

			if (teamExists.length === 0) {
				throw new DatabaseError(
					`Team ${teamId} does not exist in tournament ${tournamentId}`,
					null,
				);
			}

			// Check current team size (max 5 players per team)
			const currentPlayers = await this.db
				.select({ playerId: teamPlayers.playerId })
				.from(teamPlayers)
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						eq(teamPlayers.teamId, teamId),
					),
				);

			if (currentPlayers.length >= 5) {
				throw new DatabaseError(
					`Team ${teamId} is already full (5 players maximum)`,
					null,
				);
			}

			// Check if player is already on a team in this tournament
			const existingTeamAssignment = await this.db
				.select({ teamId: teamPlayers.teamId })
				.from(teamPlayers)
				.where(
					and(
						eq(teamPlayers.tournamentId, tournamentId),
						eq(teamPlayers.playerId, playerId),
					),
				)
				.limit(1);

			if (existingTeamAssignment.length > 0) {
				throw new DatabaseError(
					`Player is already assigned to team ${existingTeamAssignment[0].teamId}. Use exchange command to move players between teams.`,
					null,
				);
			}

			// Add the player to the team
			await this.db.insert(teamPlayers).values({
				tournamentId,
				teamId,
				playerId,
			});
		} catch (error) {
			if (error instanceof DatabaseError) {
				throw error;
			}
			throw new DatabaseError("Failed to add player to team", error);
		}
	}
}

/**
 * Repository for match operations
 */
export class MatchRepository {
	constructor(private db: Database) {}

	/**
	 * Create a new match record
	 */
	async createMatch(matchData: Omit<NewMatch, "id">): Promise<number> {
		try {
			const result = await this.db
				.insert(matches)
				.values(matchData)
				.returning({ id: matches.id });

			return result[0].id;
		} catch (error) {
			throw new DatabaseError("Failed to create match", error);
		}
	}

	/**
	 * Get all matches for a tournament
	 */
	async getMatches(tournamentId: string): Promise<Match[]> {
		try {
			return await this.db
				.select()
				.from(matches)
				.where(eq(matches.tournamentId, tournamentId))
				.orderBy(desc(matches.createdAt));
		} catch (error) {
			throw new DatabaseError("Failed to get matches", error);
		}
	}

	/**
	 * Get a specific match by ID
	 */
	async getMatch(id: number): Promise<Match | null> {
		try {
			const result = await this.db
				.select()
				.from(matches)
				.where(eq(matches.id, id))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			throw new DatabaseError("Failed to get match", error);
		}
	}

	/**
	 * Get matches between specific teams
	 */
	async getMatchesBetweenTeams(
		tournamentId: string,
		team1Id: string,
		team2Id: string,
	): Promise<Match[]> {
		try {
			return await this.db
				.select()
				.from(matches)
				.where(
					and(
						eq(matches.tournamentId, tournamentId),
						sql`(
              (${matches.team1Id} = ${team1Id} AND ${matches.team2Id} = ${team2Id}) OR
              (${matches.team1Id} = ${team2Id} AND ${matches.team2Id} = ${team1Id})
            )`,
					),
				)
				.orderBy(desc(matches.createdAt));
		} catch (error) {
			throw new DatabaseError("Failed to get matches between teams", error);
		}
	}

	/**
	 * Get match statistics for a team
	 */
	async getTeamStats(
		tournamentId: string,
		teamId: string,
	): Promise<{
		wins: number;
		losses: number;
		totalMatches: number;
		totalScoreFor: number;
		totalScoreAgainst: number;
	}> {
		try {
			const teamMatches = await this.db
				.select()
				.from(matches)
				.where(
					and(
						eq(matches.tournamentId, tournamentId),
						sql`(${matches.team1Id} = ${teamId} OR ${matches.team2Id} = ${teamId})`,
					),
				);

			let wins = 0;
			let losses = 0;
			let totalScoreFor = 0;
			let totalScoreAgainst = 0;

			for (const match of teamMatches) {
				if (match.team1Id === teamId) {
					totalScoreFor += match.score1;
					totalScoreAgainst += match.score2;
					if (match.score1 > match.score2) wins++;
					else if (match.score1 < match.score2) losses++;
				} else {
					totalScoreFor += match.score2;
					totalScoreAgainst += match.score1;
					if (match.score2 > match.score1) wins++;
					else if (match.score2 < match.score1) losses++;
				}
			}

			return {
				wins,
				losses,
				totalMatches: teamMatches.length,
				totalScoreFor,
				totalScoreAgainst,
			};
		} catch (error) {
			throw new DatabaseError("Failed to get team stats", error);
		}
	}

	/**
	 * Validate that both teams exist in the tournament
	 */
	async validateTeamsExist(
		tournamentId: string,
		team1Id: string,
		team2Id: string,
	): Promise<string[]> {
		try {
			const result = await this.db
				.select({ id: teams.id })
				.from(teams)
				.where(
					and(
						eq(teams.tournamentId, tournamentId),
						sql`${teams.id} IN (${team1Id}, ${team2Id})`,
					),
				);

			const existingIds = result.map((t) => t.id);
			const missingTeams: string[] = [];

			if (!existingIds.includes(team1Id)) {
				missingTeams.push(team1Id);
			}
			if (!existingIds.includes(team2Id)) {
				missingTeams.push(team2Id);
			}

			return missingTeams;
		} catch (error) {
			throw new DatabaseError("Failed to validate teams exist", error);
		}
	}

	/**
	 * Get tournament match summary
	 */
	async getTournamentSummary(tournamentId: string): Promise<{
		totalMatches: number;
		totalGoals: number;
		averageGoalsPerMatch: number;
		teamStats: Array<{
			teamId: string;
			wins: number;
			losses: number;
			totalMatches: number;
			goalDifference: number;
		}>;
	}> {
		try {
			const allMatches = await this.getMatches(tournamentId);
			const totalMatches = allMatches.length;
			const totalGoals = allMatches.reduce(
				(sum, match) => sum + match.score1 + match.score2,
				0,
			);
			const averageGoalsPerMatch =
				totalMatches > 0 ? totalGoals / totalMatches : 0;

			// Get all teams in tournament
			const tournamentTeams = await this.db
				.select({ id: teams.id })
				.from(teams)
				.where(eq(teams.tournamentId, tournamentId));

			const teamStats = await Promise.all(
				tournamentTeams.map(async (team) => {
					const stats = await this.getTeamStats(tournamentId, team.id);
					return {
						teamId: team.id,
						wins: stats.wins,
						losses: stats.losses,
						totalMatches: stats.totalMatches,
						goalDifference: stats.totalScoreFor - stats.totalScoreAgainst,
					};
				}),
			);

			return {
				totalMatches,
				totalGoals,
				averageGoalsPerMatch,
				teamStats,
			};
		} catch (error) {
			throw new DatabaseError("Failed to get tournament summary", error);
		}
	}

	/**
	 * Capture the current team compositions for a match
	 */
	async captureMatchTeamComposition(
		matchId: number,
		team1Id: string,
		team2Id: string,
		team1Players: Array<{ playerId: string; adr: number | null }>,
		team2Players: Array<{ playerId: string; adr: number | null }>,
	): Promise<void> {
		try {
			const matchTeamPlayerData: NewMatchTeamPlayer[] = [];

			// Add team 1 players
			for (const player of team1Players) {
				matchTeamPlayerData.push({
					matchId,
					teamId: team1Id,
					playerId: player.playerId,
					adrAtTime: player.adr,
				});
			}

			// Add team 2 players
			for (const player of team2Players) {
				matchTeamPlayerData.push({
					matchId,
					teamId: team2Id,
					playerId: player.playerId,
					adrAtTime: player.adr,
				});
			}

			if (matchTeamPlayerData.length > 0) {
				await this.db.insert(matchTeamPlayers).values(matchTeamPlayerData);
			}
		} catch (error) {
			throw new DatabaseError(
				"Failed to capture match team composition",
				error,
			);
		}
	}

	/**
	 * Get team composition for a specific match
	 */
	async getMatchTeamComposition(matchId: number): Promise<{
		[teamId: string]: Array<{
			playerId: string;
			username: string;
			displayName?: string;
			adrAtTime: number | null;
		}>;
	}> {
		try {
			const result = await this.db
				.select({
					teamId: matchTeamPlayers.teamId,
					playerId: matchTeamPlayers.playerId,
					adrAtTime: matchTeamPlayers.adrAtTime,
					player: {
						username: players.username,
						displayName: players.displayName,
					},
				})
				.from(matchTeamPlayers)
				.leftJoin(players, eq(matchTeamPlayers.playerId, players.id))
				.where(eq(matchTeamPlayers.matchId, matchId));

			// biome-ignore lint/suspicious/noExplicitAny: Database query result has complex nested structure
			const teamComposition: { [teamId: string]: Array<any> } = {};

			for (const row of result) {
				if (!teamComposition[row.teamId]) {
					teamComposition[row.teamId] = [];
				}

				teamComposition[row.teamId].push({
					playerId: row.playerId,
					username: row.player?.username || "Unknown",
					displayName: row.player?.displayName,
					adrAtTime: row.adrAtTime,
				});
			}

			return teamComposition;
		} catch (error) {
			throw new DatabaseError("Failed to get match team composition", error);
		}
	}
}
