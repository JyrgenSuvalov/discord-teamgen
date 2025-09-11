import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	TeamGenerationService,
	TeamGenerationError,
	type TournamentPlayer,
} from "../src/services/team-generation.js";

// Mock the teamgen module
vi.mock("../src/teamgen.js", () => ({
	optimizeTeams: vi.fn(),
}));

import { optimizeTeams } from "../src/teamgen.js";

describe("TeamGenerationService", () => {
	let service: TeamGenerationService;
	const mockOptimizeTeams = vi.mocked(optimizeTeams);

	beforeEach(() => {
		service = new TeamGenerationService();
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create service with default configuration", () => {
			const service = new TeamGenerationService();
			const config = service.getConfiguration();

			expect(config.defaultRuns).toBe(500);
			expect(config.maxRuns).toBe(1000);
			expect(config.teamSize).toBe(5);
		});

		it("should create service with custom configuration", () => {
			const service = new TeamGenerationService({
				defaultRuns: 100,
				maxRuns: 500,
				teamSize: 4,
			});
			const config = service.getConfiguration();

			expect(config.defaultRuns).toBe(100);
			expect(config.maxRuns).toBe(500);
			expect(config.teamSize).toBe(4);
		});

		it("should use defaults for partial configuration", () => {
			const service = new TeamGenerationService({
				defaultRuns: 200,
			});
			const config = service.getConfiguration();

			expect(config.defaultRuns).toBe(200);
			expect(config.maxRuns).toBe(1000);
			expect(config.teamSize).toBe(5);
		});
	});

	describe("generateBalancedTeams", () => {
		const createMockPlayers = (count: number): TournamentPlayer[] => {
			return Array.from({ length: count }, (_, i) => ({
				id: `player${i + 1}`,
				username: `Player${i + 1}`,
				display_name: `DisplayName${i + 1}`,
				adr: 50 + i * 10,
			}));
		};

		beforeEach(() => {
			// Mock successful optimization result
			mockOptimizeTeams.mockReturnValue({
				teams: [
					{
						players: [
							{ name: "DisplayName1", adr: 50 },
							{ name: "DisplayName2", adr: 60 },
							{ name: "DisplayName3", adr: 70 },
							{ name: "DisplayName4", adr: 80 },
							{ name: "DisplayName5", adr: 90 },
						],
						totalAdr: 350,
					},
					{
						players: [
							{ name: "DisplayName6", adr: 100 },
							{ name: "DisplayName7", adr: 110 },
							{ name: "DisplayName8", adr: 120 },
							{ name: "DisplayName9", adr: 130 },
							{ name: "DisplayName10", adr: 140 },
						],
						totalAdr: 600,
					},
				],
				adrDiff: 250,
			});
		});

		it("should generate balanced teams successfully", async () => {
			const players = createMockPlayers(10);

			const result = await service.generateBalancedTeams(players);

			expect(result.teams).toHaveLength(2);
			expect(result.teams[0].id).toBe("TEAM1");
			expect(result.teams[1].id).toBe("TEAM2");
			expect(result.teams[0].average_adr).toBe(70); // 350 / 5
			expect(result.teams[1].average_adr).toBe(120); // 600 / 5
			expect(result.adr_difference).toBe(250);
			expect(result.optimization_runs).toBe(500); // default
		});

		it("should use custom optimization runs", async () => {
			const players = createMockPlayers(10);

			await service.generateBalancedTeams(players, 100);

			expect(mockOptimizeTeams).toHaveBeenCalledWith(
				expect.any(Array),
				5, // team size
				1000, // max no improvement
				100, // custom runs
			);
		});

		it("should convert player data correctly", async () => {
			const players: TournamentPlayer[] = [
				{ id: "1", username: "User1", display_name: "Display1", adr: 50 },
				{ id: "2", username: "User2", adr: 60 }, // no display_name
				{ id: "3", username: "User3", display_name: "Display3", adr: 70 },
				{ id: "4", username: "User4", adr: 80 },
				{ id: "5", username: "User5", display_name: "Display5", adr: 90 },
			];

			await service.generateBalancedTeams(players);

			const expectedTeamgenPlayers = [
				{ name: "Display1", adr: 50 },
				{ name: "User2", adr: 60 }, // falls back to username
				{ name: "Display3", adr: 70 },
				{ name: "User4", adr: 80 },
				{ name: "Display5", adr: 90 },
			];

			expect(mockOptimizeTeams).toHaveBeenCalledWith(
				expectedTeamgenPlayers,
				5,
				1000,
				500,
			);
		});

		it("should round average ADR to 2 decimal places", async () => {
			mockOptimizeTeams.mockReturnValue({
				teams: [
					{
						players: [
							{ name: "Player1", adr: 33.333 },
							{ name: "Player2", adr: 33.333 },
							{ name: "Player3", adr: 33.334 },
							{ name: "Player4", adr: 33.333 },
							{ name: "Player5", adr: 33.334 },
						],
						totalAdr: 166.667,
					},
				],
				adrDiff: 0,
			});

			const players = createMockPlayers(5);
			const result = await service.generateBalancedTeams(players);

			expect(result.teams[0].average_adr).toBe(33.33); // 166.667 / 5 = 33.3334 rounded to 33.33
		});

		it("should throw error for empty player array", async () => {
			await expect(service.generateBalancedTeams([])).rejects.toThrow(
				TeamGenerationError,
			);

			await expect(service.generateBalancedTeams([])).rejects.toThrow(
				"No players provided for team generation",
			);
		});

		it("should throw error when player count not divisible by team size", async () => {
			const players = createMockPlayers(7); // 7 is not divisible by 5

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				TeamGenerationError,
			);

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				"Player count (7) must be divisible by team size (5)",
			);
		});

		it("should throw error for players missing ADR", async () => {
			const players: TournamentPlayer[] = [
				{ id: "1", username: "Player1", adr: 50 },
				{ id: "2", username: "Player2", adr: 60 },
				{ id: "3", username: "Player3" } as any, // missing adr
				{ id: "4", username: "Player4", adr: 80 },
				{ id: "5", username: "Player5", adr: 90 },
			];

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				TeamGenerationError,
			);

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				"Players missing ADR: Player3",
			);
		});

		it("should throw error for multiple players missing ADR", async () => {
			const players: TournamentPlayer[] = [
				{ id: "1", username: "Player1", adr: 50 },
				{ id: "2", username: "Player2" } as any, // missing adr
				{ id: "3", username: "Player3" } as any, // missing adr
				{ id: "4", username: "Player4", adr: 80 },
				{ id: "5", username: "Player5", adr: 90 },
			];

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				"Players missing ADR: Player2, Player3",
			);
		});

		it("should throw error for invalid ADR values", async () => {
			const players: TournamentPlayer[] = [
				{ id: "1", username: "Player1", adr: 50 },
				{ id: "2", username: "Player2", adr: -10 }, // negative
				{ id: "3", username: "Player3", adr: 1000 }, // too high
				{ id: "4", username: "Player4", adr: 80 },
				{ id: "5", username: "Player5", adr: 90 },
			];

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				"Players with invalid ADR values: Player2, Player3",
			);
		});

		it("should throw error for non-numeric ADR", async () => {
			const players: TournamentPlayer[] = [
				{ id: "1", username: "Player1", adr: 50 },
				{ id: "2", username: "Player2", adr: "invalid" as any },
				{ id: "3", username: "Player3", adr: 70 },
				{ id: "4", username: "Player4", adr: 80 },
				{ id: "5", username: "Player5", adr: 90 },
			];

			await expect(service.generateBalancedTeams(players)).rejects.toThrow(
				"Players with invalid ADR values: Player2",
			);
		});

		it("should validate optimization runs parameter", async () => {
			const players = createMockPlayers(5);

			// Test invalid runs
			await expect(service.generateBalancedTeams(players, 0)).rejects.toThrow(
				"Optimization runs must be a positive number",
			);

			await expect(service.generateBalancedTeams(players, -1)).rejects.toThrow(
				"Optimization runs must be a positive number",
			);

			await expect(
				service.generateBalancedTeams(players, "invalid" as any),
			).rejects.toThrow("Optimization runs must be a positive number");
		});

		it("should enforce maximum runs limit", async () => {
			const players = createMockPlayers(5);

			await expect(
				service.generateBalancedTeams(players, 1001),
			).rejects.toThrow(
				"Optimization runs (1001) exceeds maximum allowed (1000)",
			);
		});

		it("should respect custom max runs limit", async () => {
			const customService = new TeamGenerationService({ maxRuns: 100 });
			const players = createMockPlayers(5);

			await expect(
				customService.generateBalancedTeams(players, 101),
			).rejects.toThrow(
				"Optimization runs (101) exceeds maximum allowed (100)",
			);
		});
	});

	describe("team ID generation", () => {
		beforeEach(() => {
			mockOptimizeTeams.mockReturnValue({
				teams: [
					{ players: [], totalAdr: 0 },
					{ players: [], totalAdr: 0 },
					{ players: [], totalAdr: 0 },
				],
				adrDiff: 0,
			});
		});

		it("should generate sequential team IDs", async () => {
			const players = Array.from({ length: 15 }, (_, i) => ({
				id: `player${i + 1}`,
				username: `Player${i + 1}`,
				adr: 50,
			}));

			const result = await service.generateBalancedTeams(players);

			expect(result.teams[0].id).toBe("TEAM1");
			expect(result.teams[1].id).toBe("TEAM2");
			expect(result.teams[2].id).toBe("TEAM3");
		});
	});

	describe("getConfiguration", () => {
		it("should return current configuration", () => {
			const service = new TeamGenerationService({
				defaultRuns: 200,
				maxRuns: 800,
				teamSize: 4,
			});

			const config = service.getConfiguration();

			expect(config).toEqual({
				defaultRuns: 200,
				maxRuns: 800,
				teamSize: 4,
			});
		});
	});
});
