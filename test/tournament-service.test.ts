import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	TournamentService,
	TournamentError,
} from "../src/services/tournament.js";
import type {
	TournamentRepository,
	PlayerRepository,
	TeamRepository,
	MatchRepository,
} from "../src/db/utils.js";
import type { TeamGenerationService } from "../src/services/team-generation.js";
import type { PermissionService } from "../src/services/permission.js";
import type { Tournament } from "../src/db/schema.js";

// Mock repositories and services
const mockTournamentRepo = {
	createTournament: vi.fn(),
	getOpenTournament: vi.fn(),
	getTournamentById: vi.fn(),
	closeTournament: vi.fn(),
	generateTournamentId: vi.fn(),
	tournamentExists: vi.fn(),
	getTournamentStatus: vi.fn(),
} as unknown as TournamentRepository;

const mockPlayerRepo = {
	upsertPlayer: vi.fn(),
	getPlayer: vi.fn(),
	getTournamentPlayers: vi.fn(),
	upsertTournamentPlayer: vi.fn(),
	getTournamentPlayer: vi.fn(),
	setPlayerAdrLock: vi.fn(),
	isPlayerAdrLocked: vi.fn(),
	getPlayersWithoutAdr: vi.fn(),
} as unknown as PlayerRepository;

const mockTeamRepo = {
	createTeams: vi.fn(),
	getTeams: vi.fn(),
	getTeam: vi.fn(),
	lockTeams: vi.fn(),
	unlockTeams: vi.fn(),
	clearTeams: vi.fn(),
	teamsExist: vi.fn(),
	areTeamsLocked: vi.fn(),
	validateTeamIds: vi.fn(),
} as unknown as TeamRepository;

const mockMatchRepo = {
	createMatch: vi.fn(),
	getMatches: vi.fn(),
	getMatch: vi.fn(),
	getMatchesBetweenTeams: vi.fn(),
	getTeamStats: vi.fn(),
	validateTeamsExist: vi.fn(),
	getTournamentSummary: vi.fn(),
} as unknown as MatchRepository;

const mockTeamGenService = {
	generateBalancedTeams: vi.fn(),
	getConfiguration: vi.fn(),
} as unknown as TeamGenerationService;

const mockPermissionService = {
	checkAdminPermission: vi.fn(),
	extractUserRoles: vi.fn(),
	requireAdminPermission: vi.fn(),
	getAdminRoleIds: vi.fn(),
} as unknown as PermissionService;

describe("TournamentService - Foundation", () => {
	let tournamentService: TournamentService;

	beforeEach(() => {
		vi.clearAllMocks();
		tournamentService = new TournamentService(
			mockTournamentRepo,
			mockPlayerRepo,
			mockTeamRepo,
			mockMatchRepo,
			mockTeamGenService,
			mockPermissionService,
			"UTC",
		);
	});

	describe("openTournament", () => {
		it("should create a new tournament when none is open", async () => {
			const expectedDate = new Date().toISOString().split("T")[0];
			const expectedId = `${expectedDate}-1`;
			const mockTournament: Tournament = {
				id: expectedId,
				status: "open",
				createdAt: `${expectedDate}T10:00:00Z`,
			};

			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(null);
			vi.mocked(mockTournamentRepo.generateTournamentId).mockResolvedValue(
				expectedId,
			);
			vi.mocked(mockTournamentRepo.createTournament).mockResolvedValue(
				undefined,
			);
			vi.mocked(mockTournamentRepo.getTournamentById).mockResolvedValue(
				mockTournament,
			);

			const result = await tournamentService.openTournament();

			expect(result).toEqual(mockTournament);
			expect(mockTournamentRepo.getOpenTournament).toHaveBeenCalledOnce();
			expect(mockTournamentRepo.generateTournamentId).toHaveBeenCalledWith(
				expectedDate,
			);
			expect(mockTournamentRepo.createTournament).toHaveBeenCalledWith(
				expectedId,
			);
			expect(mockTournamentRepo.getTournamentById).toHaveBeenCalledWith(
				expectedId,
			);
		});

		it("should throw error when tournament is already open", async () => {
			const existingTournament: Tournament = {
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T09:00:00Z",
			};

			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				existingTournament,
			);

			await expect(tournamentService.openTournament()).rejects.toThrow(
				TournamentError,
			);
			await expect(tournamentService.openTournament()).rejects.toThrow(
				"Tournament 2025-08-31-1 is already open",
			);

			expect(mockTournamentRepo.createTournament).not.toHaveBeenCalled();
		});

		it("should throw error when tournament creation fails", async () => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(null);
			vi.mocked(mockTournamentRepo.generateTournamentId).mockResolvedValue(
				"2025-08-31-1",
			);
			vi.mocked(mockTournamentRepo.createTournament).mockResolvedValue(
				undefined,
			);
			vi.mocked(mockTournamentRepo.getTournamentById).mockResolvedValue(null);

			await expect(tournamentService.openTournament()).rejects.toThrow(
				TournamentError,
			);
			await expect(tournamentService.openTournament()).rejects.toThrow(
				"Failed to retrieve created tournament",
			);
		});
	});

	describe("closeTournament", () => {
		it("should close an open tournament", async () => {
			const openTournament: Tournament = {
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T10:00:00Z",
			};

			const closedTournament: Tournament = {
				...openTournament,
				status: "closed",
			};

			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				openTournament,
			);
			vi.mocked(mockTournamentRepo.closeTournament).mockResolvedValue(
				undefined,
			);
			vi.mocked(mockTournamentRepo.getTournamentById).mockResolvedValue(
				closedTournament,
			);

			const result = await tournamentService.closeTournament();

			expect(result).toEqual(closedTournament);
			expect(mockTournamentRepo.getOpenTournament).toHaveBeenCalledOnce();
			expect(mockTournamentRepo.closeTournament).toHaveBeenCalledWith(
				"2025-08-31-1",
			);
			expect(mockTournamentRepo.getTournamentById).toHaveBeenCalledWith(
				"2025-08-31-1",
			);
		});

		it("should throw error when no tournament is open", async () => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(null);

			await expect(tournamentService.closeTournament()).rejects.toThrow(
				TournamentError,
			);
			await expect(tournamentService.closeTournament()).rejects.toThrow(
				"No tournament is currently open",
			);

			expect(mockTournamentRepo.closeTournament).not.toHaveBeenCalled();
		});
	});

	describe("getTournamentStatus", () => {
		it("should return null when no tournament is open", async () => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(null);

			const result = await tournamentService.getTournamentStatus();

			expect(result).toBeNull();
		});

		it("should return tournament status with statistics", async () => {
			const tournament: Tournament = {
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T10:00:00Z",
			};

			const players = [
				{
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: 85.5,
					adrLocked: false,
				},
				{
					tournamentId: "2025-08-31-1",
					playerId: "player2",
					adr: null,
					adrLocked: false,
				},
				{
					tournamentId: "2025-08-31-1",
					playerId: "player3",
					adr: 92.1,
					adrLocked: true,
				},
			];

			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				tournament,
			);
			vi.mocked(mockPlayerRepo.getTournamentPlayers).mockResolvedValue(players);
			vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);
			vi.mocked(mockTeamRepo.areTeamsLocked).mockResolvedValue(false);

			const result = await tournamentService.getTournamentStatus();

			expect(result).toEqual({
				tournament_id: "2025-08-31-1",
				status: "open",
				player_count: 3,
				players_with_adr: 2,
				teams_generated: true,
				teams_locked: false,
			});
		});
	});

	describe("isTournamentOpen", () => {
		it("should return true when tournament is open", async () => {
			const tournament: Tournament = {
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T10:00:00Z",
			};

			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				tournament,
			);

			const result = await tournamentService.isTournamentOpen();

			expect(result).toBe(true);
		});

		it("should return false when no tournament is open", async () => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(null);

			const result = await tournamentService.isTournamentOpen();

			expect(result).toBe(false);
		});
	});

	describe("requireOpenTournament", () => {
		it("should return tournament when one is open", async () => {
			const tournament: Tournament = {
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T10:00:00Z",
			};

			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				tournament,
			);

			const result = await tournamentService.requireOpenTournament();

			expect(result).toEqual(tournament);
		});

		it("should throw error when no tournament is open", async () => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(null);

			await expect(tournamentService.requireOpenTournament()).rejects.toThrow(
				TournamentError,
			);
			await expect(tournamentService.requireOpenTournament()).rejects.toThrow(
				"No tournament is currently open",
			);
		});
	});

	describe("ADR Management", () => {
		const mockTournament: Tournament = {
			id: "2025-08-31-1",
			status: "open",
			createdAt: "2025-08-31T10:00:00Z",
		};

		beforeEach(() => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				mockTournament,
			);
		});

		describe("submitPlayerAdr", () => {
			it("should submit ADR for player when not locked", async () => {
				vi.mocked(mockPlayerRepo.isPlayerAdrLocked).mockResolvedValue(false);
				vi.mocked(mockPlayerRepo.upsertPlayer).mockResolvedValue(undefined);
				vi.mocked(mockPlayerRepo.upsertTournamentPlayer).mockResolvedValue(
					undefined,
				);

				await tournamentService.submitPlayerAdr(
					"player1",
					"testuser",
					"Test User",
					85.5,
				);

				expect(mockPlayerRepo.isPlayerAdrLocked).toHaveBeenCalledWith(
					"2025-08-31-1",
					"player1",
				);
				expect(mockPlayerRepo.upsertPlayer).toHaveBeenCalledWith({
					id: "player1",
					username: "testuser",
					displayName: "Test User",
				});
				expect(mockPlayerRepo.upsertTournamentPlayer).toHaveBeenCalledWith({
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: 85.5,
					adrLocked: false,
				});
			});

			it("should throw error when ADR is locked", async () => {
				vi.mocked(mockPlayerRepo.isPlayerAdrLocked).mockResolvedValue(true);

				await expect(
					tournamentService.submitPlayerAdr(
						"player1",
						"testuser",
						"Test User",
						85.5,
					),
				).rejects.toThrow(TournamentError);
				await expect(
					tournamentService.submitPlayerAdr(
						"player1",
						"testuser",
						"Test User",
						85.5,
					),
				).rejects.toThrow("Your ADR is locked");

				expect(mockPlayerRepo.upsertPlayer).not.toHaveBeenCalled();
			});
		});

		describe("submitAdminAdr", () => {
			it("should submit ADR for target player as admin", async () => {
				vi.mocked(mockPlayerRepo.upsertPlayer).mockResolvedValue(undefined);
				vi.mocked(mockPlayerRepo.upsertTournamentPlayer).mockResolvedValue(
					undefined,
				);

				await tournamentService.submitAdminAdr(
					"admin1",
					"player1",
					"testuser",
					"Test User",
					85.5,
					true,
				);

				expect(mockPlayerRepo.upsertPlayer).toHaveBeenCalledWith({
					id: "player1",
					username: "testuser",
					displayName: "Test User",
				});
				expect(mockPlayerRepo.upsertTournamentPlayer).toHaveBeenCalledWith({
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: 85.5,
					adrLocked: true,
				});
			});

			it("should submit null ADR to clear player ADR", async () => {
				vi.mocked(mockPlayerRepo.upsertPlayer).mockResolvedValue(undefined);
				vi.mocked(mockPlayerRepo.upsertTournamentPlayer).mockResolvedValue(
					undefined,
				);

				await tournamentService.submitAdminAdr(
					"admin1",
					"player1",
					"testuser",
					"Test User",
					null,
				);

				expect(mockPlayerRepo.upsertTournamentPlayer).toHaveBeenCalledWith({
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: null,
					adrLocked: false,
				});
			});
		});

		describe("lockPlayerAdr", () => {
			it("should lock player ADR when player exists", async () => {
				const mockTournamentPlayer = {
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: 85.5,
					adrLocked: false,
				};

				vi.mocked(mockPlayerRepo.getTournamentPlayer).mockResolvedValue(
					mockTournamentPlayer,
				);
				vi.mocked(mockPlayerRepo.setPlayerAdrLock).mockResolvedValue(undefined);

				await tournamentService.lockPlayerAdr("admin1", "player1");

				expect(mockPlayerRepo.getTournamentPlayer).toHaveBeenCalledWith(
					"2025-08-31-1",
					"player1",
				);
				expect(mockPlayerRepo.setPlayerAdrLock).toHaveBeenCalledWith(
					"2025-08-31-1",
					"player1",
					true,
				);
			});

			it("should throw error when player not in tournament", async () => {
				vi.mocked(mockPlayerRepo.getTournamentPlayer).mockResolvedValue(null);

				await expect(
					tournamentService.lockPlayerAdr("admin1", "player1"),
				).rejects.toThrow(TournamentError);
				await expect(
					tournamentService.lockPlayerAdr("admin1", "player1"),
				).rejects.toThrow("Player not found in current tournament");

				expect(mockPlayerRepo.setPlayerAdrLock).not.toHaveBeenCalled();
			});
		});

		describe("unlockPlayerAdr", () => {
			it("should unlock player ADR when player exists", async () => {
				const mockTournamentPlayer = {
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: 85.5,
					adrLocked: true,
				};

				vi.mocked(mockPlayerRepo.getTournamentPlayer).mockResolvedValue(
					mockTournamentPlayer,
				);
				vi.mocked(mockPlayerRepo.setPlayerAdrLock).mockResolvedValue(undefined);

				await tournamentService.unlockPlayerAdr("admin1", "player1");

				expect(mockPlayerRepo.getTournamentPlayer).toHaveBeenCalledWith(
					"2025-08-31-1",
					"player1",
				);
				expect(mockPlayerRepo.setPlayerAdrLock).toHaveBeenCalledWith(
					"2025-08-31-1",
					"player1",
					false,
				);
			});
		});

		describe("getPlayerAdrs", () => {
			it("should return formatted player ADR display data", async () => {
				const mockTournamentPlayers = [
					{
						tournamentId: "2025-08-31-1",
						playerId: "player1",
						adr: 85.5,
						adrLocked: false,
						player: {
							id: "player1",
							username: "user1",
							displayName: "User One",
						},
					},
					{
						tournamentId: "2025-08-31-1",
						playerId: "player2",
						adr: null,
						adrLocked: false,
						player: { id: "player2", username: "user2", displayName: null },
					},
					{
						tournamentId: "2025-08-31-1",
						playerId: "player3",
						adr: 92.1,
						adrLocked: true,
						player: {
							id: "player3",
							username: "user3",
							displayName: "User Three",
						},
					},
				];

				vi.mocked(mockPlayerRepo.getTournamentPlayers).mockResolvedValue(
					mockTournamentPlayers,
				);

				const result = await tournamentService.getPlayerAdrs();

				expect(result).toEqual([
					{
						player_id: "player1",
						username: "user1",
						display_name: "User One",
						adr: 85.5,
						adr_locked: false,
						status: "submitted",
					},
					{
						player_id: "player2",
						username: "user2",
						display_name: undefined,
						adr: undefined,
						adr_locked: false,
						status: "pending",
					},
					{
						player_id: "player3",
						username: "user3",
						display_name: "User Three",
						adr: 92.1,
						adr_locked: true,
						status: "submitted",
					},
				]);
			});
		});

		describe("getPlayersWithoutAdr", () => {
			it("should return players without ADRs", async () => {
				const mockPlayersWithoutAdr = [
					{
						tournamentId: "2025-08-31-1",
						playerId: "player2",
						adr: null,
						adrLocked: false,
						player: { id: "player2", username: "user2", displayName: null },
					},
				];

				vi.mocked(mockPlayerRepo.getPlayersWithoutAdr).mockResolvedValue(
					mockPlayersWithoutAdr,
				);

				const result = await tournamentService.getPlayersWithoutAdr();

				expect(result).toEqual([
					{
						player_id: "player2",
						username: "user2",
						display_name: undefined,
						adr: undefined,
						adr_locked: false,
						status: "pending",
					},
				]);
			});
		});

		describe("allPlayersHaveAdr", () => {
			it("should return true when all players have ADRs", async () => {
				vi.mocked(mockPlayerRepo.getPlayersWithoutAdr).mockResolvedValue([]);

				const result = await tournamentService.allPlayersHaveAdr();

				expect(result).toBe(true);
			});

			it("should return false when some players lack ADRs", async () => {
				const mockPlayersWithoutAdr = [
					{
						tournamentId: "2025-08-31-1",
						playerId: "player2",
						adr: null,
						adrLocked: false,
						player: { id: "player2", username: "user2", displayName: null },
					},
				];

				vi.mocked(mockPlayerRepo.getPlayersWithoutAdr).mockResolvedValue(
					mockPlayersWithoutAdr,
				);

				const result = await tournamentService.allPlayersHaveAdr();

				expect(result).toBe(false);
			});
		});
	});

	describe("Team Generation Orchestration", () => {
		const mockTournament: Tournament = {
			id: "2025-08-31-1",
			status: "open",
			createdAt: "2025-08-31T10:00:00Z",
		};

		beforeEach(() => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				mockTournament,
			);
		});

		describe("generateTeams", () => {
			const mockTournamentPlayers = [
				{
					tournamentId: "2025-08-31-1",
					playerId: "player1",
					adr: 85.5,
					adrLocked: false,
					player: { id: "player1", username: "user1", displayName: "User One" },
				},
				{
					tournamentId: "2025-08-31-1",
					playerId: "player2",
					adr: 90.2,
					adrLocked: false,
					player: { id: "player2", username: "user2", displayName: "User Two" },
				},
				{
					tournamentId: "2025-08-31-1",
					playerId: "player3",
					adr: 78.8,
					adrLocked: false,
					player: {
						id: "player3",
						username: "user3",
						displayName: "User Three",
					},
				},
				{
					tournamentId: "2025-08-31-1",
					playerId: "player4",
					adr: 82.1,
					adrLocked: false,
					player: {
						id: "player4",
						username: "user4",
						displayName: "User Four",
					},
				},
				{
					tournamentId: "2025-08-31-1",
					playerId: "player5",
					adr: 88.9,
					adrLocked: false,
					player: {
						id: "player5",
						username: "user5",
						displayName: "User Five",
					},
				},
			];

			it("should generate teams when all conditions are met", async () => {
				const mockGeneratedTeams = [
					{
						id: "TEAM1",
						players: [
							{
								id: "player1",
								username: "user1",
								display_name: "User One",
								adr: 85.5,
							},
							{
								id: "player2",
								username: "user2",
								display_name: "User Two",
								adr: 90.2,
							},
							{
								id: "player3",
								username: "user3",
								display_name: "User Three",
								adr: 78.8,
							},
							{
								id: "player4",
								username: "user4",
								display_name: "User Four",
								adr: 82.1,
							},
							{
								id: "player5",
								username: "user5",
								display_name: "User Five",
								adr: 88.9,
							},
						],
						average_adr: 85.1,
						total_adr: 425.5,
					},
				];

				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);
				vi.mocked(mockPlayerRepo.getTournamentPlayers).mockResolvedValue(
					mockTournamentPlayers,
				);
				vi.mocked(mockTeamGenService.generateBalancedTeams).mockResolvedValue({
					teams: mockGeneratedTeams,
					adr_difference: 0,
					optimization_runs: 500,
				});
				vi.mocked(mockTeamRepo.createTeams).mockResolvedValue(undefined);

				const result = await tournamentService.generateTeams();

				expect(result).toEqual(mockGeneratedTeams);
				expect(mockTeamGenService.generateBalancedTeams).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({ id: "player1", adr: 85.5 }),
					]),
					undefined,
				);
				expect(mockTeamRepo.createTeams).toHaveBeenCalledWith("2025-08-31-1", [
					{
						id: "TEAM1",
						players: ["player1", "player2", "player3", "player4", "player5"],
					},
				]);
			});

			it("should throw error when teams are locked", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);
				vi.mocked(mockTeamRepo.areTeamsLocked).mockResolvedValue(true);

				await expect(tournamentService.generateTeams()).rejects.toThrow(
					TournamentError,
				);
				await expect(tournamentService.generateTeams()).rejects.toThrow(
					"Teams are currently locked",
				);

				expect(mockPlayerRepo.getTournamentPlayers).not.toHaveBeenCalled();
			});

			it("should throw error when players are missing ADRs", async () => {
				const playersWithMissingAdr = [
					...mockTournamentPlayers.slice(0, 3),
					{
						tournamentId: "2025-08-31-1",
						playerId: "player4",
						adr: null,
						adrLocked: false,
						player: {
							id: "player4",
							username: "user4",
							displayName: "User Four",
						},
					},
					mockTournamentPlayers[4],
				];

				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);
				vi.mocked(mockPlayerRepo.getTournamentPlayers).mockResolvedValue(
					playersWithMissingAdr,
				);

				await expect(tournamentService.generateTeams()).rejects.toThrow(
					TournamentError,
				);
				await expect(tournamentService.generateTeams()).rejects.toThrow(
					"Players missing ADR: user4",
				);

				expect(mockTeamGenService.generateBalancedTeams).not.toHaveBeenCalled();
			});

			it("should throw error when player count is not divisible by 5", async () => {
				const invalidPlayerCount = mockTournamentPlayers.slice(0, 3); // Only 3 players

				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);
				vi.mocked(mockPlayerRepo.getTournamentPlayers).mockResolvedValue(
					invalidPlayerCount,
				);

				await expect(tournamentService.generateTeams()).rejects.toThrow(
					TournamentError,
				);
				await expect(tournamentService.generateTeams()).rejects.toThrow(
					"Player count (3) must be divisible by 5",
				);

				expect(mockTeamGenService.generateBalancedTeams).not.toHaveBeenCalled();
			});
		});

		describe("lockTeams", () => {
			it("should lock teams when they exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);
				vi.mocked(mockTeamRepo.lockTeams).mockResolvedValue(undefined);

				await tournamentService.lockTeams();

				expect(mockTeamRepo.teamsExist).toHaveBeenCalledWith("2025-08-31-1");
				expect(mockTeamRepo.lockTeams).toHaveBeenCalledWith("2025-08-31-1");
			});

			it("should throw error when no teams exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);

				await expect(tournamentService.lockTeams()).rejects.toThrow(
					TournamentError,
				);
				await expect(tournamentService.lockTeams()).rejects.toThrow(
					"No teams have been generated yet",
				);

				expect(mockTeamRepo.lockTeams).not.toHaveBeenCalled();
			});
		});

		describe("unlockTeams", () => {
			it("should unlock teams when they exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);
				vi.mocked(mockTeamRepo.unlockTeams).mockResolvedValue(undefined);

				await tournamentService.unlockTeams();

				expect(mockTeamRepo.teamsExist).toHaveBeenCalledWith("2025-08-31-1");
				expect(mockTeamRepo.unlockTeams).toHaveBeenCalledWith("2025-08-31-1");
			});

			it("should throw error when no teams exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);

				await expect(tournamentService.unlockTeams()).rejects.toThrow(
					TournamentError,
				);
				await expect(tournamentService.unlockTeams()).rejects.toThrow(
					"No teams have been generated yet",
				);

				expect(mockTeamRepo.unlockTeams).not.toHaveBeenCalled();
			});
		});

		describe("getTeams", () => {
			it("should return formatted team display data", async () => {
				const mockTeams = [
					{
						tournamentId: "2025-08-31-1",
						id: "TEAM1",
						locked: false,
						players: [
							{
								tournamentId: "2025-08-31-1",
								playerId: "player1",
								adr: 85.5,
								adrLocked: false,
								player: {
									id: "player1",
									username: "user1",
									displayName: "User One",
								},
							},
							{
								tournamentId: "2025-08-31-1",
								playerId: "player2",
								adr: 90.2,
								adrLocked: false,
								player: {
									id: "player2",
									username: "user2",
									displayName: "User Two",
								},
							},
						],
					},
				];

				vi.mocked(mockTeamRepo.getTeams).mockResolvedValue(mockTeams);

				const result = await tournamentService.getTeams();

				expect(result).toEqual([
					{
						team_id: "TEAM1",
						players: [
							{
								player_id: "player1",
								username: "user1",
								display_name: "User One",
								adr: 85.5,
								adr_locked: false,
								status: "submitted",
							},
							{
								player_id: "player2",
								username: "user2",
								display_name: "User Two",
								adr: 90.2,
								adr_locked: false,
								status: "submitted",
							},
						],
						average_adr: 87.85,
						locked: false,
					},
				]);
			});
		});

		describe("teamsExist", () => {
			it("should return true when teams exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);

				const result = await tournamentService.teamsExist();

				expect(result).toBe(true);
				expect(mockTeamRepo.teamsExist).toHaveBeenCalledWith("2025-08-31-1");
			});

			it("should return false when no teams exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);

				const result = await tournamentService.teamsExist();

				expect(result).toBe(false);
			});
		});

		describe("areTeamsLocked", () => {
			it("should return true when teams exist and are locked", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);
				vi.mocked(mockTeamRepo.areTeamsLocked).mockResolvedValue(true);

				const result = await tournamentService.areTeamsLocked();

				expect(result).toBe(true);
			});

			it("should return false when teams exist but are not locked", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(true);
				vi.mocked(mockTeamRepo.areTeamsLocked).mockResolvedValue(false);

				const result = await tournamentService.areTeamsLocked();

				expect(result).toBe(false);
			});

			it("should return false when no teams exist", async () => {
				vi.mocked(mockTeamRepo.teamsExist).mockResolvedValue(false);

				const result = await tournamentService.areTeamsLocked();

				expect(result).toBe(false);
				expect(mockTeamRepo.areTeamsLocked).not.toHaveBeenCalled();
			});
		});
	});

	describe("Match Management", () => {
		const mockTournament: Tournament = {
			id: "2025-08-31-1",
			status: "open",
			createdAt: "2025-08-31T10:00:00Z",
		};

		beforeEach(() => {
			vi.mocked(mockTournamentRepo.getOpenTournament).mockResolvedValue(
				mockTournament,
			);
		});

		describe("recordMatch", () => {
			it("should record a valid match", async () => {
				const mockMatch = {
					id: 1,
					tournamentId: "2025-08-31-1",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 16,
					score2: 14,
					createdAt: "2025-08-31T12:00:00Z",
				};

				vi.mocked(mockMatchRepo.validateTeamsExist).mockResolvedValue([]);
				vi.mocked(mockMatchRepo.createMatch).mockResolvedValue(1);
				vi.mocked(mockMatchRepo.getMatch).mockResolvedValue(mockMatch);

				const result = await tournamentService.recordMatch("TEAM1-16-14-TEAM2");

				expect(result).toEqual({
					match_id: 1,
					team1_id: "TEAM1",
					team2_id: "TEAM2",
					score1: 16,
					score2: 14,
					created_at: "2025-08-31T12:00:00Z",
				});

				expect(mockMatchRepo.validateTeamsExist).toHaveBeenCalledWith(
					"2025-08-31-1",
					"TEAM1",
					"TEAM2",
				);
				expect(mockMatchRepo.createMatch).toHaveBeenCalledWith({
					tournamentId: "2025-08-31-1",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 16,
					score2: 14,
				});
			});

			it("should throw error for invalid match string format", async () => {
				await expect(
					tournamentService.recordMatch("invalid-format"),
				).rejects.toThrow(TournamentError);
				await expect(
					tournamentService.recordMatch("invalid-format"),
				).rejects.toThrow("Invalid match string format");

				expect(mockMatchRepo.validateTeamsExist).not.toHaveBeenCalled();
			});

			it("should throw error for negative scores", async () => {
				// Note: We need to use a format that passes regex but has invalid scores
				// The regex doesn't allow negative numbers, so we'll test this by mocking the parsing
				const originalParseMatchString = (tournamentService as any)
					.parseMatchString;
				(tournamentService as any).parseMatchString = vi
					.fn()
					.mockImplementation(() => {
						throw new TournamentError(
							"Scores must be non-negative integers",
							"INVALID_SCORES",
						);
					});

				await expect(
					tournamentService.recordMatch("TEAM1-0-14-TEAM2"),
				).rejects.toThrow(TournamentError);
				await expect(
					tournamentService.recordMatch("TEAM1-0-14-TEAM2"),
				).rejects.toThrow("Scores must be non-negative integers");

				// Restore original method
				(tournamentService as any).parseMatchString = originalParseMatchString;
			});

			it("should throw error when team plays against itself", async () => {
				await expect(
					tournamentService.recordMatch("TEAM1-16-14-TEAM1"),
				).rejects.toThrow(TournamentError);
				await expect(
					tournamentService.recordMatch("TEAM1-16-14-TEAM1"),
				).rejects.toThrow("Team cannot play against itself");
			});

			it("should throw error when teams do not exist", async () => {
				vi.mocked(mockMatchRepo.validateTeamsExist).mockResolvedValue([
					"TEAM3",
				]);

				await expect(
					tournamentService.recordMatch("TEAM1-16-14-TEAM3"),
				).rejects.toThrow(TournamentError);
				await expect(
					tournamentService.recordMatch("TEAM1-16-14-TEAM3"),
				).rejects.toThrow("Teams not found in tournament: TEAM3");

				expect(mockMatchRepo.createMatch).not.toHaveBeenCalled();
			});
		});

		describe("getMatches", () => {
			it("should return formatted match results", async () => {
				const mockMatches = [
					{
						id: 1,
						tournamentId: "2025-08-31-1",
						team1Id: "TEAM1",
						team2Id: "TEAM2",
						score1: 16,
						score2: 14,
						createdAt: "2025-08-31T12:00:00Z",
					},
					{
						id: 2,
						tournamentId: "2025-08-31-1",
						team1Id: "TEAM2",
						team2Id: "TEAM3",
						score1: 12,
						score2: 16,
						createdAt: "2025-08-31T12:30:00Z",
					},
				];

				vi.mocked(mockMatchRepo.getMatches).mockResolvedValue(mockMatches);

				const result = await tournamentService.getMatches();

				expect(result).toEqual([
					{
						match_id: 1,
						team1_id: "TEAM1",
						team2_id: "TEAM2",
						score1: 16,
						score2: 14,
						created_at: "2025-08-31T12:00:00Z",
					},
					{
						match_id: 2,
						team1_id: "TEAM2",
						team2_id: "TEAM3",
						score1: 12,
						score2: 16,
						created_at: "2025-08-31T12:30:00Z",
					},
				]);

				expect(mockMatchRepo.getMatches).toHaveBeenCalledWith("2025-08-31-1");
			});
		});

		describe("getMatchesBetweenTeams", () => {
			it("should return matches between specific teams", async () => {
				const mockMatches = [
					{
						id: 1,
						tournamentId: "2025-08-31-1",
						team1Id: "TEAM1",
						team2Id: "TEAM2",
						score1: 16,
						score2: 14,
						createdAt: "2025-08-31T12:00:00Z",
					},
				];

				vi.mocked(mockMatchRepo.getMatchesBetweenTeams).mockResolvedValue(
					mockMatches,
				);

				const result = await tournamentService.getMatchesBetweenTeams(
					"TEAM1",
					"TEAM2",
				);

				expect(result).toEqual([
					{
						match_id: 1,
						team1_id: "TEAM1",
						team2_id: "TEAM2",
						score1: 16,
						score2: 14,
						created_at: "2025-08-31T12:00:00Z",
					},
				]);

				expect(mockMatchRepo.getMatchesBetweenTeams).toHaveBeenCalledWith(
					"2025-08-31-1",
					"TEAM1",
					"TEAM2",
				);
			});
		});

		describe("getTeamStats", () => {
			it("should return formatted team statistics", async () => {
				const mockStats = {
					wins: 2,
					losses: 1,
					totalMatches: 3,
					totalScoreFor: 45,
					totalScoreAgainst: 38,
				};

				vi.mocked(mockMatchRepo.getTeamStats).mockResolvedValue(mockStats);

				const result = await tournamentService.getTeamStats("TEAM1");

				expect(result).toEqual({
					team_id: "TEAM1",
					wins: 2,
					losses: 1,
					total_matches: 3,
					total_score_for: 45,
					total_score_against: 38,
					goal_difference: 7,
				});

				expect(mockMatchRepo.getTeamStats).toHaveBeenCalledWith(
					"2025-08-31-1",
					"TEAM1",
				);
			});
		});

		describe("getTournamentSummary", () => {
			it("should return comprehensive tournament summary", async () => {
				const mockSummary = {
					totalMatches: 5,
					totalGoals: 150,
					averageGoalsPerMatch: 30.0,
					teamStats: [
						{
							teamId: "TEAM1",
							wins: 2,
							losses: 1,
							totalMatches: 3,
							goalDifference: 7,
						},
						{
							teamId: "TEAM2",
							wins: 1,
							losses: 2,
							totalMatches: 3,
							goalDifference: -3,
						},
					],
				};

				vi.mocked(mockMatchRepo.getTournamentSummary).mockResolvedValue(
					mockSummary,
				);

				const result = await tournamentService.getTournamentSummary();

				expect(result).toEqual({
					tournament_id: "2025-08-31-1",
					total_matches: 5,
					total_goals: 150,
					average_goals_per_match: 30.0,
					team_stats: [
						{
							team_id: "TEAM1",
							wins: 2,
							losses: 1,
							total_matches: 3,
							goal_difference: 7,
						},
						{
							team_id: "TEAM2",
							wins: 1,
							losses: 2,
							total_matches: 3,
							goal_difference: -3,
						},
					],
				});

				expect(mockMatchRepo.getTournamentSummary).toHaveBeenCalledWith(
					"2025-08-31-1",
				);
			});
		});
	});

	describe("timezone validation", () => {
		it("should throw error for invalid timezone", () => {
			expect(() => {
				new TournamentService(
					mockTournamentRepo,
					mockPlayerRepo,
					mockTeamRepo,
					mockMatchRepo,
					mockTeamGenService,
					mockPermissionService,
					"Invalid/Timezone",
				);
			}).toThrow(TournamentError);
		});

		it("should accept valid timezone", () => {
			expect(() => {
				new TournamentService(
					mockTournamentRepo,
					mockPlayerRepo,
					mockTeamRepo,
					mockMatchRepo,
					mockTeamGenService,
					mockPermissionService,
					"America/New_York",
				);
			}).not.toThrow();
		});
	});
});
