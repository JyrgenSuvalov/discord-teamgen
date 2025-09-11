import type { Tournament } from "../db/schema.js";
import type {
	MatchRepository,
	PlayerRepository,
	TeamRepository,
	TournamentRepository,
} from "../db/utils.js";
import {
	getCurrentDateInTimezone,
	isValidTimezone,
} from "../utils/timezone.js";
import type { PermissionService } from "./permission.js";
import {
	type GeneratedTeam,
	TeamGenerationError,
	type TeamGenerationService,
	type TournamentPlayer as TeamGenTournamentPlayer,
} from "./team-generation.js";

// Tournament-specific error classes
export class TournamentError extends Error {
	constructor(
		message: string,
		public code: string,
	) {
		super(message);
		this.name = "TournamentError";
	}
}

// Response types for tournament operations
export interface TournamentStatus {
	tournament_id: string;
	status: string;
	player_count: number;
	players_with_adr: number;
	teams_generated: boolean;
	teams_locked: boolean;
}

export interface PlayerAdrDisplay {
	player_id: string;
	username: string;
	display_name?: string;
	adr?: number;
	adr_locked: boolean;
	status: "submitted" | "pending";
}

export interface TeamDisplay {
	team_id: string;
	players: PlayerAdrDisplay[];
	average_adr: number;
	locked: boolean;
}

export interface MatchResult {
	match_id: number;
	team1_id: string;
	team2_id: string;
	score1: number;
	score2: number;
	created_at: string;
}

/**
 * Tournament business logic service
 * Orchestrates tournament operations using repository and service dependencies
 */
export class TournamentService {
	constructor(
		private tournamentRepo: TournamentRepository,
		private playerRepo: PlayerRepository,
		private teamRepo: TeamRepository,
		private matchRepo: MatchRepository,
		private teamGenService: TeamGenerationService,
		_permissionService: PermissionService,
		private timezone: string,
	) {
		// Validate timezone on construction
		if (!isValidTimezone(this.timezone)) {
			throw new TournamentError(
				`Invalid timezone: ${this.timezone}`,
				"INVALID_TIMEZONE",
			);
		}
	}

	/**
	 * Open a new tournament with unique ID generation
	 * @returns Promise<Tournament> The created tournament
	 * @throws TournamentError if a tournament is already open or creation fails
	 */
	async openTournament(): Promise<Tournament> {
		try {
			// Check if there's already an open tournament
			const existingTournament = await this.tournamentRepo.getOpenTournament();
			if (existingTournament) {
				throw new TournamentError(
					`Tournament ${existingTournament.id} is already open. Close it before opening a new one.`,
					"TOURNAMENT_ALREADY_OPEN",
				);
			}

			// Generate unique tournament ID for today using configured timezone
			const today = getCurrentDateInTimezone(this.timezone);
			console.log(
				`Generating tournament ID: timezone=${this.timezone}, date=${today}, UTC=${new Date().toISOString().split("T")[0]}`,
			);
			const tournamentId =
				await this.tournamentRepo.generateTournamentId(today);

			// Create the tournament
			await this.tournamentRepo.createTournament(tournamentId);

			// Retrieve and return the created tournament
			const tournament =
				await this.tournamentRepo.getTournamentById(tournamentId);
			if (!tournament) {
				throw new TournamentError(
					"Failed to retrieve created tournament",
					"TOURNAMENT_CREATION_FAILED",
				);
			}

			return tournament;
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to open tournament",
				"TOURNAMENT_OPEN_FAILED",
			);
		}
	}

	/**
	 * Close the currently open tournament
	 * @returns Promise<Tournament> The closed tournament
	 * @throws TournamentError if no tournament is open or closing fails
	 */
	async closeTournament(): Promise<Tournament> {
		try {
			// Get the open tournament
			const openTournament = await this.tournamentRepo.getOpenTournament();
			if (!openTournament) {
				throw new TournamentError(
					"No tournament is currently open",
					"NO_OPEN_TOURNAMENT",
				);
			}

			// Close the tournament
			await this.tournamentRepo.closeTournament(openTournament.id);

			// Retrieve and return the closed tournament
			const closedTournament = await this.tournamentRepo.getTournamentById(
				openTournament.id,
			);
			if (!closedTournament) {
				throw new TournamentError(
					"Failed to retrieve closed tournament",
					"TOURNAMENT_CLOSE_FAILED",
				);
			}

			return closedTournament;
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to close tournament",
				"TOURNAMENT_CLOSE_FAILED",
			);
		}
	}

	/**
	 * Get the current tournament status with statistics
	 * @returns Promise<TournamentStatus | null> Tournament status or null if no tournament is open
	 */
	async getTournamentStatus(): Promise<TournamentStatus | null> {
		try {
			const tournament = await this.tournamentRepo.getOpenTournament();
			if (!tournament) {
				return null;
			}

			// Get tournament players
			const players = await this.playerRepo.getTournamentPlayers(tournament.id);
			const playersWithAdr = players.filter(
				(p) => p.adr !== null && p.adr !== undefined,
			);

			// Check if teams exist and are locked
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			const teamsLocked = teamsExist
				? await this.teamRepo.areTeamsLocked(tournament.id)
				: false;

			return {
				tournament_id: tournament.id,
				status: tournament.status,
				player_count: players.length,
				players_with_adr: playersWithAdr.length,
				teams_generated: teamsExist,
				teams_locked: teamsLocked,
			};
		} catch (_error) {
			throw new TournamentError(
				"Failed to get tournament status",
				"TOURNAMENT_STATUS_FAILED",
			);
		}
	}

	/**
	 * Check if a tournament is currently open
	 * @returns Promise<boolean> true if a tournament is open
	 */
	async isTournamentOpen(): Promise<boolean> {
		try {
			const tournament = await this.tournamentRepo.getOpenTournament();
			return tournament !== null;
		} catch (_error) {
			throw new TournamentError(
				"Failed to check tournament status",
				"TOURNAMENT_CHECK_FAILED",
			);
		}
	}

	/**
	 * Get the currently open tournament
	 * @returns Promise<Tournament | null> The open tournament or null if none exists
	 */
	async getOpenTournament(): Promise<Tournament | null> {
		try {
			return await this.tournamentRepo.getOpenTournament();
		} catch (_error) {
			throw new TournamentError(
				"Failed to get open tournament",
				"TOURNAMENT_GET_FAILED",
			);
		}
	}

	/**
	 * Require that a tournament is open, throwing an error if not
	 * @returns Promise<Tournament> The open tournament
	 * @throws TournamentError if no tournament is open
	 */
	async requireOpenTournament(): Promise<Tournament> {
		const tournament = await this.getOpenTournament();
		if (!tournament) {
			throw new TournamentError(
				"No tournament is currently open",
				"NO_OPEN_TOURNAMENT",
			);
		}
		return tournament;
	}

	// ADR Management Methods

	/**
	 * Submit ADR for a player (player self-submission)
	 * @param playerId Discord user ID of the player
	 * @param username Player's Discord username
	 * @param displayName Player's display name (optional)
	 * @param adr ADR value to submit
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open, ADR is locked, or submission fails
	 */
	async submitPlayerAdr(
		playerId: string,
		username: string,
		displayName: string | undefined,
		adr: number,
	): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if player's ADR is locked
			const isLocked = await this.playerRepo.isPlayerAdrLocked(
				tournament.id,
				playerId,
			);
			if (isLocked) {
				throw new TournamentError(
					"Your ADR is locked and cannot be changed. Contact an admin if you need to update it.",
					"ADR_LOCKED",
				);
			}

			// Upsert player data with default ADR
			await this.playerRepo.upsertPlayer({
				id: playerId,
				username,
				displayName,
				defaultAdr: adr, // Update default ADR when player submits
			});

			// Upsert tournament player with ADR
			await this.playerRepo.upsertTournamentPlayer({
				tournamentId: tournament.id,
				playerId,
				adr,
				adrLocked: false,
			});
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to submit ADR",
				"ADR_SUBMISSION_FAILED",
			);
		}
	}

	/**
	 * Submit or override ADR for a player (admin action)
	 * @param adminPlayerId Discord user ID of the admin
	 * @param targetPlayerId Discord user ID of the target player
	 * @param targetUsername Target player's Discord username
	 * @param targetDisplayName Target player's display name (optional)
	 * @param adr ADR value to submit (can be null to clear)
	 * @param lock Whether to lock the ADR after submission
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open or submission fails
	 */
	async submitAdminAdr(
		_adminPlayerId: string,
		targetPlayerId: string,
		targetUsername: string,
		targetDisplayName: string | undefined,
		adr: number | null,
		lock?: boolean,
	): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Upsert target player data with default ADR (if ADR is being set)
			await this.playerRepo.upsertPlayer({
				id: targetPlayerId,
				username: targetUsername,
				displayName: targetDisplayName,
				defaultAdr: adr !== null ? adr : undefined, // Update default ADR only if setting an ADR
			});

			// Upsert tournament player with ADR (admin can override locked status)
			await this.playerRepo.upsertTournamentPlayer({
				tournamentId: tournament.id,
				playerId: targetPlayerId,
				adr,
				adrLocked: lock || false,
			});
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to submit admin ADR",
				"ADMIN_ADR_SUBMISSION_FAILED",
			);
		}
	}

	/**
	 * Lock a player's ADR to prevent further changes
	 * @param adminPlayerId Discord user ID of the admin
	 * @param targetPlayerId Discord user ID of the target player
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open, player not found, or locking fails
	 */
	async lockPlayerAdr(
		_adminPlayerId: string,
		targetPlayerId: string,
	): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if player exists in tournament
			const tournamentPlayer = await this.playerRepo.getTournamentPlayer(
				tournament.id,
				targetPlayerId,
			);
			if (!tournamentPlayer) {
				throw new TournamentError(
					"Player not found in current tournament. They must submit an ADR first.",
					"PLAYER_NOT_IN_TOURNAMENT",
				);
			}

			// Lock the player's ADR
			await this.playerRepo.setPlayerAdrLock(
				tournament.id,
				targetPlayerId,
				true,
			);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError("Failed to lock player ADR", "ADR_LOCK_FAILED");
		}
	}

	/**
	 * Unlock a player's ADR to allow changes
	 * @param adminPlayerId Discord user ID of the admin
	 * @param targetPlayerId Discord user ID of the target player
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open, player not found, or unlocking fails
	 */
	async unlockPlayerAdr(
		_adminPlayerId: string,
		targetPlayerId: string,
	): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if player exists in tournament
			const tournamentPlayer = await this.playerRepo.getTournamentPlayer(
				tournament.id,
				targetPlayerId,
			);
			if (!tournamentPlayer) {
				throw new TournamentError(
					"Player not found in current tournament.",
					"PLAYER_NOT_IN_TOURNAMENT",
				);
			}

			// Unlock the player's ADR
			await this.playerRepo.setPlayerAdrLock(
				tournament.id,
				targetPlayerId,
				false,
			);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to unlock player ADR",
				"ADR_UNLOCK_FAILED",
			);
		}
	}

	/**
	 * Get all players and their ADR status for display
	 * @returns Promise<PlayerAdrDisplay[]> Array of players with their ADR status
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getPlayerAdrs(): Promise<PlayerAdrDisplay[]> {
		try {
			const tournament = await this.requireOpenTournament();

			// Get all tournament players with their data
			const tournamentPlayers = await this.playerRepo.getTournamentPlayers(
				tournament.id,
			);

			return tournamentPlayers.map((tp) => ({
				player_id: tp.playerId,
				username: tp.player?.username || "Unknown",
				display_name: tp.player?.displayName || undefined,
				adr: tp.adr || undefined,
				adr_locked: tp.adrLocked,
				status:
					tp.adr !== null && tp.adr !== undefined ? "submitted" : "pending",
			}));
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get player ADRs",
				"ADR_RETRIEVAL_FAILED",
			);
		}
	}

	/**
	 * Get players who haven't submitted ADRs yet
	 * @returns Promise<PlayerAdrDisplay[]> Array of players without ADRs
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getPlayersWithoutAdr(): Promise<PlayerAdrDisplay[]> {
		try {
			const tournament = await this.requireOpenTournament();

			// Get players without ADRs
			const playersWithoutAdr = await this.playerRepo.getPlayersWithoutAdr(
				tournament.id,
			);

			return playersWithoutAdr.map((tp) => ({
				player_id: tp.playerId,
				username: tp.player?.username || "Unknown",
				display_name: tp.player?.displayName || undefined,
				adr: undefined,
				adr_locked: tp.adrLocked,
				status: "pending" as const,
			}));
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get players without ADR",
				"ADR_PENDING_RETRIEVAL_FAILED",
			);
		}
	}

	/**
	 * Check if all players have submitted ADRs
	 * @returns Promise<boolean> true if all players have ADRs
	 * @throws TournamentError if no tournament is open or check fails
	 */
	async allPlayersHaveAdr(): Promise<boolean> {
		try {
			const playersWithoutAdr = await this.getPlayersWithoutAdr();
			return playersWithoutAdr.length === 0;
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to check ADR completion status",
				"ADR_CHECK_FAILED",
			);
		}
	}

	// Team Generation Orchestration Methods

	/**
	 * Generate balanced teams using the team generation algorithm
	 * @param runs Number of optimization runs (optional, uses service default)
	 * @returns Promise<GeneratedTeam[]> Generated teams with statistics
	 * @throws TournamentError if no tournament is open, teams are locked, players missing ADRs, or generation fails
	 */
	async generateTeams(runs?: number): Promise<GeneratedTeam[]> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if teams are already locked
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (teamsExist) {
				const teamsLocked = await this.teamRepo.areTeamsLocked(tournament.id);
				if (teamsLocked) {
					throw new TournamentError(
						"Teams are currently locked. Unlock them before regenerating.",
						"TEAMS_LOCKED",
					);
				}
			}

			// Get all tournament players
			const tournamentPlayers = await this.playerRepo.getTournamentPlayers(
				tournament.id,
			);

			// Check if all players have ADRs
			const playersWithoutAdr = tournamentPlayers.filter(
				(p) => p.adr === null || p.adr === undefined,
			);
			if (playersWithoutAdr.length > 0) {
				const missingNames = playersWithoutAdr
					.map((p) => p.player?.username || p.playerId)
					.join(", ");
				throw new TournamentError(
					`Players missing ADR: ${missingNames}`,
					"PLAYERS_MISSING_ADR",
				);
			}

			// Validate player count is divisible by team size (5)
			if (tournamentPlayers.length % 5 !== 0) {
				throw new TournamentError(
					`Player count (${tournamentPlayers.length}) must be divisible by 5 for team generation`,
					"INVALID_PLAYER_COUNT",
				);
			}

			// Convert to team generation format
			const teamGenPlayers: TeamGenTournamentPlayer[] = tournamentPlayers.map(
				(tp) => ({
					id: tp.playerId,
					username: tp.player?.username || "Unknown",
					display_name:
						tp.player?.displayName || tp.player?.username || "Unknown",
					// biome-ignore lint/style/noNonNullAssertion: ADR is required for team generation, null check occurs earlier
					adr: tp.adr!,
				}),
			);

			// Generate teams using the team generation service
			const result = await this.teamGenService.generateBalancedTeams(
				teamGenPlayers,
				runs,
			);

			// Map player IDs back to the generated teams
			// Create a mapping from the name used in team generation to the original player
			const nameToPlayerMap = new Map<string, (typeof tournamentPlayers)[0]>();
			for (const tp of tournamentPlayers) {
				const nameUsedInTeamGen =
					tp.player?.displayName || tp.player?.username || "Unknown";
				nameToPlayerMap.set(nameUsedInTeamGen, tp);
			}

			const teamsWithPlayerIds = result.teams.map((team) => ({
				...team,
				players: team.players.map((player) => {
					const tournamentPlayer = nameToPlayerMap.get(player.username);

					if (!tournamentPlayer) {
						console.error(`Failed to map player: ${player.username}`);
						console.error(
							"Available mappings:",
							Array.from(nameToPlayerMap.keys()),
						);
						console.error(
							"Tournament players:",
							tournamentPlayers.map((tp) => ({
								id: tp.playerId,
								username: tp.player?.username,
								displayName: tp.player?.displayName,
								nameUsedInTeamGen:
									tp.player?.displayName || tp.player?.username || "Unknown",
							})),
						);
						throw new TournamentError(
							`Failed to map generated team player: ${player.username}`,
							"PLAYER_MAPPING_FAILED",
						);
					}

					return {
						...player,
						id: tournamentPlayer.playerId,
					};
				}),
			}));

			// Store teams in database
			const teamData = teamsWithPlayerIds.map((team) => ({
				id: team.id,
				players: team.players.map((p) => p.id),
			}));

			console.log("Team data to be saved:", JSON.stringify(teamData, null, 2));

			// Validate that all player IDs are non-empty
			for (const team of teamData) {
				for (const playerId of team.players) {
					if (!playerId || playerId.trim() === "") {
						throw new TournamentError(
							`Invalid player ID found in team ${team.id}: "${playerId}"`,
							"INVALID_PLAYER_ID",
						);
					}
				}
			}

			await this.teamRepo.createTeams(tournament.id, teamData);

			return teamsWithPlayerIds;
		} catch (error) {
			console.error("Team generation error details:", error);
			console.error("Error type:", error?.constructor?.name);
			console.error(
				"Error message:",
				error instanceof Error ? error.message : String(error),
			);

			if (
				error instanceof TournamentError ||
				error instanceof TeamGenerationError
			) {
				throw error;
			}
			throw new TournamentError(
				`Failed to generate teams: ${error instanceof Error ? error.message : String(error)}`,
				"TEAM_GENERATION_FAILED",
			);
		}
	}

	/**
	 * Lock all teams to prevent regeneration
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open, no teams exist, or locking fails
	 */
	async lockTeams(): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if teams exist
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (!teamsExist) {
				throw new TournamentError(
					"No teams have been generated yet. Generate teams before locking.",
					"NO_TEAMS_TO_LOCK",
				);
			}

			// Lock the teams
			await this.teamRepo.lockTeams(tournament.id);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError("Failed to lock teams", "TEAM_LOCK_FAILED");
		}
	}

	/**
	 * Unlock all teams to allow regeneration
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open, no teams exist, or unlocking fails
	 */
	async unlockTeams(): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if teams exist
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (!teamsExist) {
				throw new TournamentError(
					"No teams have been generated yet.",
					"NO_TEAMS_TO_UNLOCK",
				);
			}

			// Unlock the teams
			await this.teamRepo.unlockTeams(tournament.id);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError("Failed to unlock teams", "TEAM_UNLOCK_FAILED");
		}
	}

	/**
	 * Get current teams with player information for display
	 * @returns Promise<TeamDisplay[]> Array of teams with player details
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getTeams(): Promise<TeamDisplay[]> {
		try {
			const tournament = await this.requireOpenTournament();

			// Get teams with player data
			const teams = await this.teamRepo.getTeams(tournament.id);

			return teams.map((team) => {
				const players: PlayerAdrDisplay[] = (team.players || []).map((tp) => ({
					player_id: tp.playerId,
					username: tp.player?.username || "Unknown",
					display_name: tp.player?.displayName || undefined,
					adr: tp.adr || undefined,
					adr_locked: tp.adrLocked,
					status:
						tp.adr !== null && tp.adr !== undefined ? "submitted" : "pending",
				}));

				// Calculate average ADR
				const playersWithAdr = players.filter((p) => p.adr !== undefined);
				const averageAdr =
					playersWithAdr.length > 0
						? playersWithAdr.reduce((sum, p) => sum + (p.adr || 0), 0) /
							playersWithAdr.length
						: 0;

				return {
					team_id: team.id,
					players,
					average_adr: Math.round(averageAdr * 100) / 100, // Round to 2 decimal places
					locked: team.locked,
				};
			});
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError("Failed to get teams", "TEAM_RETRIEVAL_FAILED");
		}
	}

	/**
	 * Check if teams exist for the current tournament
	 * @returns Promise<boolean> true if teams have been generated
	 * @throws TournamentError if no tournament is open or check fails
	 */
	async teamsExist(): Promise<boolean> {
		try {
			const tournament = await this.requireOpenTournament();
			return await this.teamRepo.teamsExist(tournament.id);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to check if teams exist",
				"TEAM_EXISTENCE_CHECK_FAILED",
			);
		}
	}

	/**
	 * Check if teams are locked for the current tournament
	 * @returns Promise<boolean> true if teams are locked
	 * @throws TournamentError if no tournament is open, no teams exist, or check fails
	 */
	async areTeamsLocked(): Promise<boolean> {
		try {
			const tournament = await this.requireOpenTournament();

			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (!teamsExist) {
				return false;
			}

			return await this.teamRepo.areTeamsLocked(tournament.id);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to check if teams are locked",
				"TEAM_LOCK_CHECK_FAILED",
			);
		}
	}

	// Match Management Methods

	/**
	 * Parse and validate a match string in format TEAM1-score1-score2-TEAM2
	 * @param matchString Match string to parse
	 * @returns Parsed match components
	 * @throws TournamentError if match string format is invalid
	 */
	private parseMatchString(matchString: string): {
		team1Id: string;
		score1: number;
		score2: number;
		team2Id: string;
	} {
		const match = matchString.match(/^([A-Z0-9]+)-(\d+)-(\d+)-([A-Z0-9]+)$/);
		if (!match) {
			throw new TournamentError(
				"Invalid match string format. Expected format: TEAM1-score1-score2-TEAM2",
				"INVALID_MATCH_FORMAT",
			);
		}

		const [, team1Id, score1Str, score2Str, team2Id] = match;
		const score1 = parseInt(score1Str, 10);
		const score2 = parseInt(score2Str, 10);

		if (
			Number.isNaN(score1) ||
			Number.isNaN(score2) ||
			score1 < 0 ||
			score2 < 0
		) {
			throw new TournamentError(
				"Scores must be non-negative integers",
				"INVALID_SCORES",
			);
		}

		if (team1Id === team2Id) {
			throw new TournamentError(
				"Team cannot play against itself",
				"SAME_TEAM_MATCH",
			);
		}

		return { team1Id, score1, score2, team2Id };
	}

	/**
	 * Record a match result from a match string
	 * @param matchString Match string in format TEAM1-score1-score2-TEAM2
	 * @returns Promise<MatchResult> The recorded match result
	 * @throws TournamentError if no tournament is open, teams don't exist, or recording fails
	 */
	async recordMatch(matchString: string): Promise<MatchResult> {
		try {
			const tournament = await this.requireOpenTournament();

			// Parse and validate match string
			const { team1Id, score1, score2, team2Id } =
				this.parseMatchString(matchString);

			// Validate that both teams exist in the tournament
			const missingTeams = await this.matchRepo.validateTeamsExist(
				tournament.id,
				team1Id,
				team2Id,
			);
			if (missingTeams.length > 0) {
				throw new TournamentError(
					`Teams not found in tournament: ${missingTeams.join(", ")}`,
					"TEAMS_NOT_FOUND",
				);
			}

			// Create the match record
			const matchId = await this.matchRepo.createMatch({
				tournamentId: tournament.id,
				team1Id,
				team2Id,
				score1,
				score2,
			});

			// Capture team compositions at the time of the match
			try {
				const { team1Players, team2Players } =
					await this.teamRepo.getTeamCompositionsForMatch(
						tournament.id,
						team1Id,
						team2Id,
					);

				await this.matchRepo.captureMatchTeamComposition(
					matchId,
					team1Id,
					team2Id,
					team1Players,
					team2Players,
				);
			} catch (compositionError) {
				// Log error but don't fail the match recording
				console.warn(
					"Failed to capture team composition for match",
					matchId,
					compositionError,
				);
			}

			// Retrieve the created match
			const match = await this.matchRepo.getMatch(matchId);
			if (!match) {
				throw new TournamentError(
					"Failed to retrieve recorded match",
					"MATCH_RETRIEVAL_FAILED",
				);
			}

			return {
				match_id: match.id,
				team1_id: match.team1Id,
				team2_id: match.team2Id,
				score1: match.score1,
				score2: match.score2,
				created_at: match.createdAt,
			};
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to record match",
				"MATCH_RECORDING_FAILED",
			);
		}
	}

	/**
	 * Get all matches for the current tournament
	 * @returns Promise<MatchResult[]> Array of match results
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getMatches(): Promise<MatchResult[]> {
		try {
			const tournament = await this.requireOpenTournament();

			const matches = await this.matchRepo.getMatches(tournament.id);

			return matches.map((match) => ({
				match_id: match.id,
				team1_id: match.team1Id,
				team2_id: match.team2Id,
				score1: match.score1,
				score2: match.score2,
				created_at: match.createdAt,
			}));
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get matches",
				"MATCH_RETRIEVAL_FAILED",
			);
		}
	}

	/**
	 * Get matches between two specific teams
	 * @param team1Id First team ID
	 * @param team2Id Second team ID
	 * @returns Promise<MatchResult[]> Array of matches between the teams
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getMatchesBetweenTeams(
		team1Id: string,
		team2Id: string,
	): Promise<MatchResult[]> {
		try {
			const tournament = await this.requireOpenTournament();

			const matches = await this.matchRepo.getMatchesBetweenTeams(
				tournament.id,
				team1Id,
				team2Id,
			);

			return matches.map((match) => ({
				match_id: match.id,
				team1_id: match.team1Id,
				team2_id: match.team2Id,
				score1: match.score1,
				score2: match.score2,
				created_at: match.createdAt,
			}));
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get matches between teams",
				"MATCH_RETRIEVAL_FAILED",
			);
		}
	}

	/**
	 * Get match statistics for a specific team
	 * @param teamId Team ID to get statistics for
	 * @returns Promise<object> Team statistics including wins, losses, and scores
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getTeamStats(teamId: string): Promise<{
		team_id: string;
		wins: number;
		losses: number;
		total_matches: number;
		total_score_for: number;
		total_score_against: number;
		goal_difference: number;
	}> {
		try {
			const tournament = await this.requireOpenTournament();

			const stats = await this.matchRepo.getTeamStats(tournament.id, teamId);

			return {
				team_id: teamId,
				wins: stats.wins,
				losses: stats.losses,
				total_matches: stats.totalMatches,
				total_score_for: stats.totalScoreFor,
				total_score_against: stats.totalScoreAgainst,
				goal_difference: stats.totalScoreFor - stats.totalScoreAgainst,
			};
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get team statistics",
				"TEAM_STATS_FAILED",
			);
		}
	}

	/**
	 * Get comprehensive tournament match summary with statistics
	 * @returns Promise<object> Tournament summary with match and team statistics
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getTournamentSummary(): Promise<{
		tournament_id: string;
		total_matches: number;
		total_goals: number;
		average_goals_per_match: number;
		team_stats: Array<{
			team_id: string;
			wins: number;
			losses: number;
			total_matches: number;
			goal_difference: number;
		}>;
	}> {
		try {
			const tournament = await this.requireOpenTournament();

			const summary = await this.matchRepo.getTournamentSummary(tournament.id);

			return {
				tournament_id: tournament.id,
				total_matches: summary.totalMatches,
				total_goals: summary.totalGoals,
				average_goals_per_match:
					Math.round(summary.averageGoalsPerMatch * 100) / 100,
				team_stats: summary.teamStats.map((stat) => ({
					team_id: stat.teamId,
					wins: stat.wins,
					losses: stat.losses,
					total_matches: stat.totalMatches,
					goal_difference: stat.goalDifference,
				})),
			};
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get tournament summary",
				"TOURNAMENT_SUMMARY_FAILED",
			);
		}
	}

	// Join/Leave Tournament Methods

	/**
	 * Join a player to the current tournament
	 * @param playerId Discord user ID of the player
	 * @param username Player's Discord username
	 * @param displayName Player's display name (optional)
	 * @param isAdmin Whether this is an admin action
	 * @param targetPlayerId Target player ID (for admin actions)
	 * @returns Promise<void>
	 * @throws TournamentError if no tournament is open or join fails
	 */
	async joinTournament(
		playerId: string,
		username: string,
		displayName: string | undefined,
		isAdmin?: boolean,
		targetPlayerId?: string,
	): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Determine actual player to join (admin can join others)
			const actualPlayerId =
				isAdmin && targetPlayerId ? targetPlayerId : playerId;
			const actualUsername = username; // For admin actions, this should be the target's username
			const actualDisplayName = displayName; // For admin actions, this should be the target's display name

			// Check if player is already in tournament (for informative messaging)
			const _isAlreadyInTournament = await this.playerRepo.isPlayerInTournament(
				tournament.id,
				actualPlayerId,
			);

			// Join tournament (idempotent operation)
			await this.playerRepo.joinTournament(
				tournament.id,
				actualPlayerId,
				actualUsername,
				actualDisplayName,
			);

			// Return whether this was a new join or existing membership (can be used by handler for messaging)
			return;
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to join tournament",
				"TOURNAMENT_JOIN_FAILED",
			);
		}
	}

	/**
	 * Remove a player from the current tournament
	 * @param playerId Discord user ID of the requesting player
	 * @param isAdmin Whether this is an admin action
	 * @param targetPlayerId Target player ID (for admin remove)
	 * @returns Promise<boolean> true if player was removed, false if not in tournament
	 * @throws TournamentError if no tournament is open or removal fails
	 */
	async leaveTournament(
		playerId: string,
		isAdmin?: boolean,
		targetPlayerId?: string,
	): Promise<boolean> {
		try {
			const tournament = await this.requireOpenTournament();

			// Determine actual player to remove (admin can remove others)
			const actualPlayerId =
				isAdmin && targetPlayerId ? targetPlayerId : playerId;

			// Check if player is in tournament
			const isInTournament = await this.playerRepo.isPlayerInTournament(
				tournament.id,
				actualPlayerId,
			);
			if (!isInTournament) {
				return false; // Player was not in tournament
			}

			// Remove player from teams first (if teams exist)
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (teamsExist) {
				await this.teamRepo.removePlayerFromTeams(
					tournament.id,
					actualPlayerId,
				);
			}

			// Remove player from tournament
			await this.playerRepo.leaveTournament(tournament.id, actualPlayerId);
			return true; // Player was successfully removed
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to leave tournament",
				"TOURNAMENT_LEAVE_FAILED",
			);
		}
	}

	/**
	 * Check if a player is in the current tournament
	 * @param playerId Discord user ID of the player
	 * @returns Promise<boolean> true if player is in tournament
	 * @throws TournamentError if no tournament is open or check fails
	 */
	async isPlayerInTournament(playerId: string): Promise<boolean> {
		try {
			const tournament = await this.requireOpenTournament();
			return await this.playerRepo.isPlayerInTournament(
				tournament.id,
				playerId,
			);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to check tournament membership",
				"TOURNAMENT_MEMBERSHIP_CHECK_FAILED",
			);
		}
	}

	// Team Management Methods

	/**
	 * Exchange two players between teams
	 * @param adminPlayerId Discord user ID of the admin
	 * @param player1Id Discord user ID of first player
	 * @param player2Id Discord user ID of second player
	 * @returns Promise<{player1Team: string, player2Team: string}> Teams after exchange
	 * @throws TournamentError if exchange fails or validation fails
	 */
	async exchangePlayers(
		_adminPlayerId: string,
		player1Id: string,
		player2Id: string,
	): Promise<{ player1Team: string; player2Team: string }> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if teams exist and are generated
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (!teamsExist) {
				throw new TournamentError(
					"No teams have been generated yet",
					"NO_TEAMS_GENERATED",
				);
			}

			// Validate both players are in the tournament
			const [player1InTournament, player2InTournament] = await Promise.all([
				this.playerRepo.isPlayerInTournament(tournament.id, player1Id),
				this.playerRepo.isPlayerInTournament(tournament.id, player2Id),
			]);

			if (!player1InTournament) {
				throw new TournamentError(
					"First player is not in the current tournament",
					"PLAYER_NOT_IN_TOURNAMENT",
				);
			}

			if (!player2InTournament) {
				throw new TournamentError(
					"Second player is not in the current tournament",
					"PLAYER_NOT_IN_TOURNAMENT",
				);
			}

			// Get current team assignments
			const [player1Team, player2Team] = await Promise.all([
				this.teamRepo.getPlayerTeam(tournament.id, player1Id),
				this.teamRepo.getPlayerTeam(tournament.id, player2Id),
			]);

			if (!player1Team) {
				throw new TournamentError(
					"First player is not assigned to any team",
					"PLAYER_NOT_ON_TEAM",
				);
			}

			if (!player2Team) {
				throw new TournamentError(
					"Second player is not assigned to any team",
					"PLAYER_NOT_ON_TEAM",
				);
			}

			if (player1Team.teamId === player2Team.teamId) {
				throw new TournamentError(
					"Both players are on the same team",
					"PLAYERS_SAME_TEAM",
				);
			}

			// Perform the exchange
			await this.teamRepo.exchangePlayers(tournament.id, player1Id, player2Id);

			return {
				player1Team: player2Team.teamId, // Player 1 is now on player 2's original team
				player2Team: player1Team.teamId, // Player 2 is now on player 1's original team
			};
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to exchange players",
				"PLAYER_EXCHANGE_FAILED",
			);
		}
	}

	/**
	 * Add a player to a specific team (admin only)
	 * @param adminPlayerId Discord user ID of the admin
	 * @param targetPlayerId Discord user ID of the player to add
	 * @param teamId Team ID to add the player to
	 * @returns Promise<void>
	 * @throws TournamentError if operation fails or validation fails
	 */
	async addPlayerToTeam(
		_adminPlayerId: string,
		targetPlayerId: string,
		teamId: string,
	): Promise<void> {
		try {
			const tournament = await this.requireOpenTournament();

			// Check if teams exist and are generated
			const teamsExist = await this.teamRepo.teamsExist(tournament.id);
			if (!teamsExist) {
				throw new TournamentError(
					"No teams have been generated yet",
					"NO_TEAMS_GENERATED",
				);
			}

			// Validate the player is in the tournament
			const playerInTournament = await this.playerRepo.isPlayerInTournament(
				tournament.id,
				targetPlayerId,
			);
			if (!playerInTournament) {
				throw new TournamentError(
					"Player must be in the tournament before being added to a team",
					"PLAYER_NOT_IN_TOURNAMENT",
				);
			}

			// Add player to the team (with capacity validation)
			await this.teamRepo.addPlayerToTeam(
				tournament.id,
				targetPlayerId,
				teamId,
			);
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			// Handle DatabaseError from repository
			if (error instanceof Error && error.message.includes("Team")) {
				throw new TournamentError(error.message, "ADD_PLAYER_FAILED");
			}
			throw new TournamentError(
				"Failed to add player to team",
				"ADD_PLAYER_FAILED",
			);
		}
	}

	/**
	 * Get detailed match information including historical team compositions
	 * @param matchId Match ID to get details for
	 * @returns Promise<object> Match details with team compositions at time of play
	 * @throws TournamentError if match not found or retrieval fails
	 */
	async getMatchDetails(matchId: number): Promise<{
		match_id: number;
		tournament_id: string;
		team1_id: string;
		team2_id: string;
		score1: number;
		score2: number;
		created_at: string;
		team_compositions: {
			[teamId: string]: Array<{
				playerId: string;
				username: string;
				displayName?: string;
				adrAtTime: number | null;
			}>;
		};
	}> {
		try {
			// Get the match
			const match = await this.matchRepo.getMatch(matchId);
			if (!match) {
				throw new TournamentError("Match not found", "MATCH_NOT_FOUND");
			}

			// Get team compositions at time of match
			const teamCompositions =
				await this.matchRepo.getMatchTeamComposition(matchId);

			return {
				match_id: match.id,
				tournament_id: match.tournamentId,
				team1_id: match.team1Id,
				team2_id: match.team2Id,
				score1: match.score1,
				score2: match.score2,
				created_at: match.createdAt,
				team_compositions: teamCompositions,
			};
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get match details",
				"MATCH_DETAILS_FAILED",
			);
		}
	}

	/**
	 * Get all matches with their historical team compositions
	 * @returns Promise<Array> Array of matches with team compositions
	 * @throws TournamentError if no tournament is open or retrieval fails
	 */
	async getMatchesWithCompositions(): Promise<
		Array<{
			match_id: number;
			team1_id: string;
			team2_id: string;
			score1: number;
			score2: number;
			created_at: string;
			team_compositions: {
				[teamId: string]: Array<{
					playerId: string;
					username: string;
					displayName?: string;
					adrAtTime: number | null;
				}>;
			};
		}>
	> {
		try {
			const tournament = await this.requireOpenTournament();
			const matches = await this.matchRepo.getMatches(tournament.id);

			const matchesWithCompositions = await Promise.all(
				matches.map(async (match) => {
					const teamCompositions = await this.matchRepo.getMatchTeamComposition(
						match.id,
					);

					return {
						match_id: match.id,
						team1_id: match.team1Id,
						team2_id: match.team2Id,
						score1: match.score1,
						score2: match.score2,
						created_at: match.createdAt,
						team_compositions: teamCompositions,
					};
				}),
			);

			return matchesWithCompositions;
		} catch (error) {
			if (error instanceof TournamentError) {
				throw error;
			}
			throw new TournamentError(
				"Failed to get matches with compositions",
				"MATCHES_WITH_COMPOSITIONS_FAILED",
			);
		}
	}
}
