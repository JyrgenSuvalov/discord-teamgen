import {
	optimizeTeams,
	type Player as TeamgenPlayer,
	type Team as TeamgenTeam,
} from "../teamgen.js";

// Tournament-specific types
export interface TournamentPlayer {
	id: string; // Discord user ID
	username: string;
	display_name?: string;
	adr: number;
}

export interface GeneratedTeam {
	id: string; // TEAM1, TEAM2, etc.
	players: TournamentPlayer[];
	average_adr: number;
	total_adr: number;
}

export interface TeamGenerationResult {
	teams: GeneratedTeam[];
	adr_difference: number;
	optimization_runs: number;
}

export class TeamGenerationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TeamGenerationError";
	}
}

export class TeamGenerationService {
	private defaultRuns: number;
	private maxRuns: number;
	private teamSize: number;

	constructor(
		options: {
			defaultRuns?: number;
			maxRuns?: number;
			teamSize?: number;
		} = {},
	) {
		// Optimized defaults for Cloudflare Workers execution limits
		this.defaultRuns = options.defaultRuns ?? 200; // Optimized default
		this.maxRuns = options.maxRuns ?? 200; // Maximum safe limit
		this.teamSize = options.teamSize ?? 5;
	}

	/**
	 * Generate balanced teams using the existing optimization algorithm
	 * @param players Array of tournament players with ADRs
	 * @param runs Number of optimization runs (optional, uses default if not provided)
	 * @returns Promise<TeamGenerationResult> Generated teams with statistics
	 */
	async generateBalancedTeams(
		players: TournamentPlayer[],
		runs?: number,
	): Promise<TeamGenerationResult> {
		// Validate inputs
		this.validatePlayers(players);

		const optimizationRuns = this.validateRuns(runs);

		// Convert to teamgen format
		const teamgenPlayers = this.convertToTeamgenFormat(players);

		// Run optimization algorithm with timeout protection
		const startTime = Date.now();
		const maxExecutionTime = 25000; // 25 seconds (Cloudflare Workers limit is 30s)

		try {
			// Run optimization algorithm with reduced iterations for Workers
			const maxIterations = Math.min(500, Math.floor(10000 / optimizationRuns)); // Dynamic based on runs

			console.log(
				`Starting team generation: ${optimizationRuns} runs, ${maxIterations} max iterations per run`,
			);

			const result = optimizeTeams(
				teamgenPlayers,
				this.teamSize,
				maxIterations,
				optimizationRuns,
			);

			const executionTime = Date.now() - startTime;
			console.log(`Team generation completed in ${executionTime}ms`);

			if (executionTime > maxExecutionTime) {
				console.warn(
					`Team generation took ${executionTime}ms, approaching timeout limit`,
				);
			}

			// Convert back to tournament format
			const tournamentTeams = this.convertFromTeamgenFormat(result.teams);

			return {
				teams: tournamentTeams,
				adr_difference: result.adrDiff,
				optimization_runs: optimizationRuns,
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			console.error(`Team generation failed after ${executionTime}ms:`, error);

			if (executionTime > maxExecutionTime * 0.8) {
				throw new TeamGenerationError(
					`Team generation timed out. Try reducing the number of optimization runs (current: ${optimizationRuns}). ` +
						`Recommended: ${Math.max(10, Math.floor(optimizationRuns / 4))} runs or fewer.`,
				);
			}

			throw error;
		}
	}

	/**
	 * Validate player data for team generation
	 * @param players Array of tournament players
	 * @throws TeamGenerationError if validation fails
	 */
	private validatePlayers(players: TournamentPlayer[]): void {
		if (players.length === 0) {
			throw new TeamGenerationError("No players provided for team generation");
		}

		if (players.length % this.teamSize !== 0) {
			throw new TeamGenerationError(
				`Player count (${players.length}) must be divisible by team size (${this.teamSize})`,
			);
		}

		// Check for missing ADRs
		const playersWithoutAdr = players.filter(
			(p) => p.adr === undefined || p.adr === null,
		);
		if (playersWithoutAdr.length > 0) {
			const missingNames = playersWithoutAdr.map((p) => p.username).join(", ");
			throw new TeamGenerationError(`Players missing ADR: ${missingNames}`);
		}

		// Validate ADR values
		const invalidAdrPlayers = players.filter(
			(p) => typeof p.adr !== "number" || p.adr < 0 || p.adr > 999.99,
		);
		if (invalidAdrPlayers.length > 0) {
			const invalidNames = invalidAdrPlayers.map((p) => p.username).join(", ");
			throw new TeamGenerationError(
				`Players with invalid ADR values: ${invalidNames}`,
			);
		}
	}

	/**
	 * Validate and normalize optimization runs parameter
	 * @param runs Optional number of runs
	 * @returns number Validated runs count
	 */
	private validateRuns(runs?: number): number {
		if (runs === undefined) {
			return this.defaultRuns;
		}

		if (typeof runs !== "number" || runs < 1) {
			throw new TeamGenerationError(
				"Optimization runs must be a positive number",
			);
		}

		if (runs > this.maxRuns) {
			throw new TeamGenerationError(
				`Optimization runs (${runs}) exceeds maximum allowed (${this.maxRuns})`,
			);
		}

		return runs;
	}

	/**
	 * Convert tournament player format to teamgen algorithm format
	 * @param players Tournament players
	 * @returns TeamgenPlayer[] Players in teamgen format
	 */
	private convertToTeamgenFormat(players: TournamentPlayer[]): TeamgenPlayer[] {
		return players.map((player) => ({
			name: player.display_name || player.username,
			adr: player.adr,
		}));
	}

	/**
	 * Convert teamgen result format back to tournament format with team IDs
	 * @param teams Teams from teamgen algorithm
	 * @returns GeneratedTeam[] Teams in tournament format
	 */
	private convertFromTeamgenFormat(teams: TeamgenTeam[]): GeneratedTeam[] {
		return teams.map((team, index) => {
			const teamId = this.generateTeamId(index + 1);
			const averageAdr =
				team.players.length > 0 ? team.totalAdr / team.players.length : 0;

			return {
				id: teamId,
				players: team.players.map((player) => ({
					id: "", // Will be populated by the service layer
					username: player.name,
					display_name: player.name,
					adr: player.adr,
				})),
				average_adr: Math.round(averageAdr * 100) / 100, // Round to 2 decimal places
				total_adr: team.totalAdr,
			};
		});
	}

	/**
	 * Generate team ID in format TEAM1, TEAM2, etc.
	 * @param teamNumber Team number (1-based)
	 * @returns string Team ID
	 */
	private generateTeamId(teamNumber: number): string {
		return `TEAM${teamNumber}`;
	}

	/**
	 * Get configuration values
	 * @returns object Configuration settings
	 */
	getConfiguration(): {
		defaultRuns: number;
		maxRuns: number;
		teamSize: number;
	} {
		return {
			defaultRuns: this.defaultRuns,
			maxRuns: this.maxRuns,
			teamSize: this.teamSize,
		};
	}
}
