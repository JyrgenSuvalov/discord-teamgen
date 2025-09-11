import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { SELF } from "cloudflare:test";
import {
	createDatabase,
	TournamentRepository,
	PlayerRepository,
	TeamRepository,
	MatchRepository,
} from "../src/db";
import type { Env } from "../src/db/types";

describe("Repository Integration Tests", () => {
	let env: Env;
	let db: ReturnType<typeof createDatabase>;
	let tournamentRepo: TournamentRepository;
	let playerRepo: PlayerRepository;
	let teamRepo: TeamRepository;
	let matchRepo: MatchRepository;

	beforeAll(async () => {
		// Get the test environment with real D1 database
		env = (await import("cloudflare:test")).env as Env;

		// Run migrations to set up database schema
		await setupDatabase();
	});

	beforeEach(async () => {
		db = createDatabase(env.DB);

		tournamentRepo = new TournamentRepository(db);
		playerRepo = new PlayerRepository(db);
		teamRepo = new TeamRepository(db);
		matchRepo = new MatchRepository(db);

		// Clean up any existing test data
		await cleanupTestData();
	});

	afterEach(async () => {
		// Clean up test data after each test
		await cleanupTestData();
	});

	async function setupDatabase() {
		try {
			// Run the migrations to create tables
			const migrations = [
				// Migration 0000: Create messages table
				`CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, username text NOT NULL, message text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`,

				// Migration 0001: Create tournament tables
				`CREATE TABLE IF NOT EXISTS tournaments (id text PRIMARY KEY NOT NULL, status text DEFAULT 'open' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`,

				`CREATE TABLE IF NOT EXISTS players (id text PRIMARY KEY NOT NULL, username text, display_name text)`,

				`CREATE TABLE IF NOT EXISTS tournament_players (tournament_id text NOT NULL, player_id text NOT NULL, adr real, adr_locked integer DEFAULT false NOT NULL, PRIMARY KEY(tournament_id, player_id), FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON UPDATE no action ON DELETE no action, FOREIGN KEY (player_id) REFERENCES players(id) ON UPDATE no action ON DELETE no action)`,

				`CREATE TABLE IF NOT EXISTS teams (tournament_id text NOT NULL, id text NOT NULL, locked integer DEFAULT false NOT NULL, PRIMARY KEY(tournament_id, id), FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON UPDATE no action ON DELETE no action)`,

				`CREATE TABLE IF NOT EXISTS team_players (team_id text NOT NULL, tournament_id text NOT NULL, player_id text NOT NULL, PRIMARY KEY(tournament_id, team_id, player_id), FOREIGN KEY (player_id) REFERENCES players(id) ON UPDATE no action ON DELETE no action)`,

				`CREATE TABLE IF NOT EXISTS matches (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, tournament_id text NOT NULL, team1_id text NOT NULL, team2_id text NOT NULL, score1 integer NOT NULL, score2 integer NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON UPDATE no action ON DELETE no action)`,

				// Migration 0002: Create indexes
				`CREATE INDEX IF NOT EXISTS tournament_status_idx ON tournaments(status)`,
				`CREATE INDEX IF NOT EXISTS matches_tournament_idx ON matches(tournament_id)`,
				`CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches(created_at)`,
			];

			for (const migration of migrations) {
				await env.DB.exec(migration);
			}
		} catch (error) {
			console.error("Failed to set up database:", error);
			throw error;
		}
	}

	async function cleanupTestData() {
		try {
			// Delete in reverse dependency order
			await env.DB.exec(
				'DELETE FROM matches WHERE tournament_id LIKE "test-%"',
			);
			await env.DB.exec(
				'DELETE FROM team_players WHERE tournament_id LIKE "test-%"',
			);
			await env.DB.exec('DELETE FROM teams WHERE tournament_id LIKE "test-%"');
			await env.DB.exec(
				'DELETE FROM tournament_players WHERE tournament_id LIKE "test-%"',
			);
			await env.DB.exec('DELETE FROM tournaments WHERE id LIKE "test-%"');
			await env.DB.exec('DELETE FROM players WHERE id LIKE "test-%"');
		} catch (error) {
			// Ignore cleanup errors
		}
	}

	describe("Tournament Repository Integration", () => {
		it("should create and retrieve tournament", async () => {
			const tournamentId = "test-2025-08-30-1";

			await tournamentRepo.createTournament(tournamentId);

			const tournament = await tournamentRepo.getTournamentById(tournamentId);
			expect(tournament).toBeDefined();
			expect(tournament?.id).toBe(tournamentId);
			expect(tournament?.status).toBe("open");
		});

		it("should generate unique tournament IDs", async () => {
			const date = "2025-08-30";

			// Create first tournament
			const id1 = await tournamentRepo.generateTournamentId(`test-${date}`);
			expect(id1).toBe(`test-${date}-1`);
			await tournamentRepo.createTournament(id1);

			// Create second tournament
			const id2 = await tournamentRepo.generateTournamentId(`test-${date}`);
			expect(id2).toBe(`test-${date}-2`);
			await tournamentRepo.createTournament(id2);

			// Verify both exist
			const tournament1 = await tournamentRepo.getTournamentById(id1);
			const tournament2 = await tournamentRepo.getTournamentById(id2);
			expect(tournament1).toBeDefined();
			expect(tournament2).toBeDefined();
		});

		it("should handle tournament status changes", async () => {
			const tournamentId = "test-2025-08-30-1";

			await tournamentRepo.createTournament(tournamentId);

			// Check initial status
			let status = await tournamentRepo.getTournamentStatus(tournamentId);
			expect(status).toBe("open");

			// Close tournament
			await tournamentRepo.closeTournament(tournamentId);

			// Check updated status
			status = await tournamentRepo.getTournamentStatus(tournamentId);
			expect(status).toBe("closed");
		});

		it("should find open tournaments", async () => {
			const tournamentId = "test-2025-08-30-1";

			await tournamentRepo.createTournament(tournamentId);

			const openTournament = await tournamentRepo.getOpenTournament();
			expect(openTournament).toBeDefined();
			expect(openTournament?.id).toBe(tournamentId);

			// Close tournament
			await tournamentRepo.closeTournament(tournamentId);

			// Should not find open tournament
			const noOpenTournament = await tournamentRepo.getOpenTournament();
			expect(noOpenTournament).toBeNull();
		});
	});

	describe("Player Repository Integration", () => {
		let tournamentId: string;

		beforeEach(async () => {
			tournamentId = "test-2025-08-30-1";
			await tournamentRepo.createTournament(tournamentId);
		});

		it("should upsert and retrieve players", async () => {
			const playerData = {
				id: "test-player-123",
				username: "testuser",
				displayName: "Test User",
			};

			await playerRepo.upsertPlayer(playerData);

			const player = await playerRepo.getPlayer(playerData.id);
			expect(player).toBeDefined();
			expect(player?.username).toBe(playerData.username);
			expect(player?.displayName).toBe(playerData.displayName);
		});

		it("should update existing player on upsert", async () => {
			const playerId = "test-player-123";

			// Initial insert
			await playerRepo.upsertPlayer({
				id: playerId,
				username: "oldusername",
				displayName: "Old Name",
			});

			// Update via upsert
			await playerRepo.upsertPlayer({
				id: playerId,
				username: "newusername",
				displayName: "New Name",
			});

			const player = await playerRepo.getPlayer(playerId);
			expect(player?.username).toBe("newusername");
			expect(player?.displayName).toBe("New Name");
		});

		it("should manage tournament player associations", async () => {
			const playerId = "test-player-123";

			// Create player first
			await playerRepo.upsertPlayer({
				id: playerId,
				username: "testuser",
			});

			// Add to tournament with ADR
			await playerRepo.upsertTournamentPlayer({
				tournamentId,
				playerId,
				adr: 85.5,
				adrLocked: false,
			});

			const tournamentPlayer = await playerRepo.getTournamentPlayer(
				tournamentId,
				playerId,
			);
			expect(tournamentPlayer).toBeDefined();
			expect(tournamentPlayer?.adr).toBe(85.5);
			expect(tournamentPlayer?.adrLocked).toBe(false);
		});

		it("should retrieve tournament players with joined data", async () => {
			const playerId = "test-player-123";

			// Create player and add to tournament
			await playerRepo.upsertPlayer({
				id: playerId,
				username: "testuser",
				displayName: "Test User",
			});

			await playerRepo.upsertTournamentPlayer({
				tournamentId,
				playerId,
				adr: 85.5,
				adrLocked: false,
			});

			const tournamentPlayers =
				await playerRepo.getTournamentPlayers(tournamentId);
			expect(tournamentPlayers).toHaveLength(1);
			expect(tournamentPlayers[0].playerId).toBe(playerId);
			expect(tournamentPlayers[0].adr).toBe(85.5);
			expect(tournamentPlayers[0].player?.username).toBe("testuser");
		});

		it("should handle ADR locking", async () => {
			const playerId = "test-player-123";

			await playerRepo.upsertPlayer({ id: playerId, username: "testuser" });
			await playerRepo.upsertTournamentPlayer({
				tournamentId,
				playerId,
				adr: 85.5,
				adrLocked: false,
			});

			// Lock ADR
			await playerRepo.setPlayerAdrLock(tournamentId, playerId, true);

			let isLocked = await playerRepo.isPlayerAdrLocked(tournamentId, playerId);
			expect(isLocked).toBe(true);

			// Unlock ADR
			await playerRepo.setPlayerAdrLock(tournamentId, playerId, false);

			isLocked = await playerRepo.isPlayerAdrLocked(tournamentId, playerId);
			expect(isLocked).toBe(false);
		});

		it("should find players without ADR", async () => {
			const player1Id = "test-player-1";
			const player2Id = "test-player-2";

			// Create players
			await playerRepo.upsertPlayer({ id: player1Id, username: "user1" });
			await playerRepo.upsertPlayer({ id: player2Id, username: "user2" });

			// Add to tournament - one with ADR, one without
			await playerRepo.upsertTournamentPlayer({
				tournamentId,
				playerId: player1Id,
				adr: 85.5,
			});

			await playerRepo.upsertTournamentPlayer({
				tournamentId,
				playerId: player2Id,
				adr: null,
			});

			const playersWithoutAdr =
				await playerRepo.getPlayersWithoutAdr(tournamentId);
			expect(playersWithoutAdr).toHaveLength(1);
			expect(playersWithoutAdr[0].playerId).toBe(player2Id);
		});
	});

	describe("Team Repository Integration", () => {
		let tournamentId: string;
		let playerIds: string[];

		beforeEach(async () => {
			tournamentId = "test-2025-08-30-1";
			await tournamentRepo.createTournament(tournamentId);

			// Create test players
			playerIds = [
				"test-player-1",
				"test-player-2",
				"test-player-3",
				"test-player-4",
				"test-player-5",
			];
			for (const playerId of playerIds) {
				await playerRepo.upsertPlayer({
					id: playerId,
					username: `user${playerId.slice(-1)}`,
				});
			}
		});

		it("should create and retrieve teams", async () => {
			const teamData = [
				{ id: "TEAM1", players: playerIds.slice(0, 3) },
				{ id: "TEAM2", players: playerIds.slice(3, 5) },
			];

			await teamRepo.createTeams(tournamentId, teamData);

			const teams = await teamRepo.getTeams(tournamentId);
			expect(teams).toHaveLength(2);

			const team1 = teams.find((t) => t.id === "TEAM1");
			const team2 = teams.find((t) => t.id === "TEAM2");

			expect(team1).toBeDefined();
			expect(team1?.players).toHaveLength(3);
			expect(team2).toBeDefined();
			expect(team2?.players).toHaveLength(2);
		});

		it("should handle team locking", async () => {
			const teamData = [{ id: "TEAM1", players: playerIds.slice(0, 3) }];
			await teamRepo.createTeams(tournamentId, teamData);

			// Check initial lock status
			let areTeamsLocked = await teamRepo.areTeamsLocked(tournamentId);
			expect(areTeamsLocked).toBe(false);

			// Lock teams
			await teamRepo.lockTeams(tournamentId);

			areTeamsLocked = await teamRepo.areTeamsLocked(tournamentId);
			expect(areTeamsLocked).toBe(true);

			// Unlock teams
			await teamRepo.unlockTeams(tournamentId);

			areTeamsLocked = await teamRepo.areTeamsLocked(tournamentId);
			expect(areTeamsLocked).toBe(false);
		});

		it("should validate team IDs", async () => {
			const teamData = [
				{ id: "TEAM1", players: playerIds.slice(0, 3) },
				{ id: "TEAM2", players: playerIds.slice(3, 5) },
			];
			await teamRepo.createTeams(tournamentId, teamData);

			// Valid team IDs
			let missingTeams = await teamRepo.validateTeamIds(tournamentId, [
				"TEAM1",
				"TEAM2",
			]);
			expect(missingTeams).toEqual([]);

			// Some invalid team IDs
			missingTeams = await teamRepo.validateTeamIds(tournamentId, [
				"TEAM1",
				"TEAM3",
				"TEAM4",
			]);
			expect(missingTeams).toEqual(["TEAM3", "TEAM4"]);
		});

		it("should clear teams and team players", async () => {
			const teamData = [{ id: "TEAM1", players: playerIds.slice(0, 3) }];
			await teamRepo.createTeams(tournamentId, teamData);

			// Verify teams exist
			let teamsExist = await teamRepo.teamsExist(tournamentId);
			expect(teamsExist).toBe(true);

			// Clear teams
			await teamRepo.clearTeams(tournamentId);

			// Verify teams are cleared
			teamsExist = await teamRepo.teamsExist(tournamentId);
			expect(teamsExist).toBe(false);
		});

		it("should retrieve individual team", async () => {
			const teamData = [{ id: "TEAM1", players: playerIds.slice(0, 3) }];
			await teamRepo.createTeams(tournamentId, teamData);

			const team = await teamRepo.getTeam(tournamentId, "TEAM1");
			expect(team).toBeDefined();
			expect(team?.id).toBe("TEAM1");
			expect(team?.tournamentId).toBe(tournamentId);

			const nonExistentTeam = await teamRepo.getTeam(tournamentId, "TEAM999");
			expect(nonExistentTeam).toBeNull();
		});
	});

	describe("Match Repository Integration", () => {
		let tournamentId: string;
		let teamIds: string[];

		beforeEach(async () => {
			tournamentId = "test-2025-08-30-1";
			await tournamentRepo.createTournament(tournamentId);

			// Create test teams
			teamIds = ["TEAM1", "TEAM2"];
			const playerIds = [
				"test-player-1",
				"test-player-2",
				"test-player-3",
				"test-player-4",
				"test-player-5",
			];

			for (const playerId of playerIds) {
				await playerRepo.upsertPlayer({
					id: playerId,
					username: `user${playerId.slice(-1)}`,
				});
			}

			const teamData = [
				{ id: "TEAM1", players: playerIds.slice(0, 3) },
				{ id: "TEAM2", players: playerIds.slice(3, 5) },
			];
			await teamRepo.createTeams(tournamentId, teamData);
		});

		it("should create and retrieve matches", async () => {
			const matchData = {
				tournamentId,
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			};

			const matchId = await matchRepo.createMatch(matchData);
			expect(matchId).toBeGreaterThan(0);

			const match = await matchRepo.getMatch(matchId);
			expect(match).toBeDefined();
			expect(match?.team1Id).toBe("TEAM1");
			expect(match?.team2Id).toBe("TEAM2");
			expect(match?.score1).toBe(2);
			expect(match?.score2).toBe(1);
		});

		it("should retrieve matches for tournament", async () => {
			const match1Data = {
				tournamentId,
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			};

			const match2Data = {
				tournamentId,
				team1Id: "TEAM2",
				team2Id: "TEAM1",
				score1: 0,
				score2: 3,
			};

			await matchRepo.createMatch(match1Data);
			await matchRepo.createMatch(match2Data);

			const matches = await matchRepo.getMatches(tournamentId);
			expect(matches).toHaveLength(2);
		});

		it("should validate team existence for matches", async () => {
			// Valid teams
			let missingTeams = await matchRepo.validateTeamsExist(
				tournamentId,
				"TEAM1",
				"TEAM2",
			);
			expect(missingTeams).toEqual([]);

			// Invalid teams
			missingTeams = await matchRepo.validateTeamsExist(
				tournamentId,
				"TEAM1",
				"TEAM999",
			);
			expect(missingTeams).toEqual(["TEAM999"]);

			// Both invalid
			missingTeams = await matchRepo.validateTeamsExist(
				tournamentId,
				"TEAM999",
				"TEAM888",
			);
			expect(missingTeams).toEqual(["TEAM999", "TEAM888"]);
		});

		it("should calculate team statistics", async () => {
			// Create multiple matches for TEAM1
			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			});

			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM2",
				team2Id: "TEAM1",
				score1: 1,
				score2: 3,
			});

			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 1,
				score2: 2,
			});

			const stats = await matchRepo.getTeamStats(tournamentId, "TEAM1");
			expect(stats.totalMatches).toBe(3);
			expect(stats.wins).toBe(2); // Won 2-1 and 3-1
			expect(stats.losses).toBe(1); // Lost 1-2
			expect(stats.totalScoreFor).toBe(6); // 2 + 3 + 1
			expect(stats.totalScoreAgainst).toBe(4); // 1 + 1 + 2
		});

		it("should get matches between specific teams", async () => {
			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			});

			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM2",
				team2Id: "TEAM1",
				score1: 0,
				score2: 3,
			});

			const matches = await matchRepo.getMatchesBetweenTeams(
				tournamentId,
				"TEAM1",
				"TEAM2",
			);
			expect(matches).toHaveLength(2);
		});

		it("should generate tournament summary", async () => {
			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			});

			await matchRepo.createMatch({
				tournamentId,
				team1Id: "TEAM2",
				team2Id: "TEAM1",
				score1: 1,
				score2: 3,
			});

			const summary = await matchRepo.getTournamentSummary(tournamentId);
			expect(summary.totalMatches).toBe(2);
			expect(summary.totalGoals).toBe(7); // 2+1+1+3
			expect(summary.averageGoalsPerMatch).toBe(3.5);
			expect(summary.teamStats).toHaveLength(2);

			const team1Stats = summary.teamStats.find((s) => s.teamId === "TEAM1");
			expect(team1Stats?.wins).toBe(2);
			expect(team1Stats?.losses).toBe(0);
		});
	});

	describe("Foreign Key Constraints and Data Integrity", () => {
		let tournamentId: string;

		beforeEach(async () => {
			tournamentId = "test-2025-08-30-1";
			await tournamentRepo.createTournament(tournamentId);
		});

		it("should enforce foreign key constraints for tournament players", async () => {
			// Try to add tournament player without creating player first
			await expect(
				playerRepo.upsertTournamentPlayer({
					tournamentId,
					playerId: "nonexistent-player",
					adr: 85.5,
				}),
			).rejects.toThrow();
		});

		it("should enforce foreign key constraints for teams", async () => {
			// Try to create team with nonexistent tournament
			await expect(
				teamRepo.createTeams("nonexistent-tournament", [
					{ id: "TEAM1", players: ["test-player-1"] },
				]),
			).rejects.toThrow();
		});

		it("should enforce foreign key constraints for matches", async () => {
			// Try to create match with nonexistent tournament
			await expect(
				matchRepo.createMatch({
					tournamentId: "nonexistent-tournament",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 2,
					score2: 1,
				}),
			).rejects.toThrow();
		});

		it("should maintain referential integrity on cascading operations", async () => {
			const playerId = "test-player-1";

			// Create player and add to tournament
			await playerRepo.upsertPlayer({ id: playerId, username: "testuser" });
			await playerRepo.upsertTournamentPlayer({
				tournamentId,
				playerId,
				adr: 85.5,
			});

			// Create team with player
			await teamRepo.createTeams(tournamentId, [
				{ id: "TEAM1", players: [playerId] },
			]);

			// Verify all data exists
			const player = await playerRepo.getPlayer(playerId);
			const tournamentPlayer = await playerRepo.getTournamentPlayer(
				tournamentId,
				playerId,
			);
			const teams = await teamRepo.getTeams(tournamentId);

			expect(player).toBeDefined();
			expect(tournamentPlayer).toBeDefined();
			expect(teams).toHaveLength(1);
			expect(teams[0].players).toHaveLength(1);
		});
	});

	describe("Transaction Handling for Team Generation", () => {
		let tournamentId: string;
		let playerIds: string[];

		beforeEach(async () => {
			tournamentId = "test-2025-08-30-1";
			await tournamentRepo.createTournament(tournamentId);

			// Create test players
			playerIds = Array.from({ length: 10 }, (_, i) => `test-player-${i + 1}`);
			for (const playerId of playerIds) {
				await playerRepo.upsertPlayer({
					id: playerId,
					username: `user${playerId.slice(-1)}`,
				});
			}
		});

		it("should handle team generation atomically", async () => {
			const teamData = [
				{ id: "TEAM1", players: playerIds.slice(0, 5) },
				{ id: "TEAM2", players: playerIds.slice(5, 10) },
			];

			// Create teams
			await teamRepo.createTeams(tournamentId, teamData);

			// Verify all teams and players were created
			const teams = await teamRepo.getTeams(tournamentId);
			expect(teams).toHaveLength(2);

			const team1 = teams.find((t) => t.id === "TEAM1");
			const team2 = teams.find((t) => t.id === "TEAM2");

			expect(team1?.players).toHaveLength(5);
			expect(team2?.players).toHaveLength(5);
		});

		it("should clear existing teams before creating new ones", async () => {
			// Create initial teams
			const initialTeamData = [{ id: "TEAM1", players: playerIds.slice(0, 5) }];
			await teamRepo.createTeams(tournamentId, initialTeamData);

			// Verify initial team exists
			let teams = await teamRepo.getTeams(tournamentId);
			expect(teams).toHaveLength(1);

			// Create new teams (should clear old ones)
			const newTeamData = [
				{ id: "TEAM1", players: playerIds.slice(0, 3) },
				{ id: "TEAM2", players: playerIds.slice(3, 6) },
				{ id: "TEAM3", players: playerIds.slice(6, 9) },
			];
			await teamRepo.createTeams(tournamentId, newTeamData);

			// Verify new teams replaced old ones
			teams = await teamRepo.getTeams(tournamentId);
			expect(teams).toHaveLength(3);

			const team1 = teams.find((t) => t.id === "TEAM1");
			expect(team1?.players).toHaveLength(3); // Should be new team with 3 players, not 5
		});

		it("should handle concurrent team generation attempts", async () => {
			const teamData = [
				{ id: "TEAM1", players: playerIds.slice(0, 5) },
				{ id: "TEAM2", players: playerIds.slice(5, 10) },
			];

			// Simulate concurrent team creation attempts
			const promises = [
				teamRepo.createTeams(tournamentId, teamData),
				teamRepo.createTeams(tournamentId, teamData),
			];

			// One should succeed, one might fail due to unique constraint
			// But the createTeams method clears existing teams first, so both should succeed
			const results = await Promise.allSettled(promises);

			// At least one should succeed
			const successCount = results.filter(
				(r) => r.status === "fulfilled",
			).length;
			expect(successCount).toBeGreaterThan(0);

			const teams = await teamRepo.getTeams(tournamentId);
			expect(teams).toHaveLength(2);
		});
	});
});
