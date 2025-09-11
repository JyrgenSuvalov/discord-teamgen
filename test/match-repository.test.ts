import { describe, it, expect, beforeEach } from "vitest";
import { createDatabase, MatchRepository, type Match } from "../src/db";

// Mock D1Database for testing
const mockD1: D1Database = {
	prepare: () => ({
		bind: () => ({
			all: () => Promise.resolve({ results: [], success: true, meta: {} }),
			first: () => Promise.resolve(null),
			run: () => Promise.resolve({ success: true, meta: {} }),
		}),
	}),
	dump: () => Promise.resolve(new ArrayBuffer(0)),
	batch: () => Promise.resolve([]),
	exec: () => Promise.resolve({ count: 0, duration: 0 }),
} as any;

describe("MatchRepository", () => {
	let db: ReturnType<typeof createDatabase>;
	let matchRepo: MatchRepository;

	beforeEach(() => {
		db = createDatabase(mockD1);
		matchRepo = new MatchRepository(db);
	});

	describe("createMatch", () => {
		it("should create match and return ID", async () => {
			const mockInsert = {
				values: () => ({
					returning: () => Promise.resolve([{ id: 1 }]),
				}),
			};
			db.insert = () => mockInsert as any;

			const matchData = {
				tournamentId: "2025-08-30-1",
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			};

			const result = await matchRepo.createMatch(matchData);
			expect(result).toBe(1);
		});

		it("should throw DatabaseError on failure", async () => {
			db.insert = () => {
				throw new Error("Database error");
			};

			const matchData = {
				tournamentId: "2025-08-30-1",
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
			};

			await expect(matchRepo.createMatch(matchData)).rejects.toThrow(
				"Failed to create match",
			);
		});
	});

	describe("getMatches", () => {
		it("should return matches for tournament", async () => {
			const mockMatches: Match[] = [
				{
					id: 1,
					tournamentId: "2025-08-30-1",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 2,
					score2: 1,
					createdAt: "2025-08-30T10:00:00Z",
				},
			];

			const mockSelect = {
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve(mockMatches),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getMatches("2025-08-30-1");
			expect(result).toEqual(mockMatches);
		});

		it("should return empty array when no matches found", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getMatches("nonexistent");
			expect(result).toEqual([]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(matchRepo.getMatches("2025-08-30-1")).rejects.toThrow(
				"Failed to get matches",
			);
		});
	});

	describe("getMatch", () => {
		it("should return match when exists", async () => {
			const mockMatch: Match = {
				id: 1,
				tournamentId: "2025-08-30-1",
				team1Id: "TEAM1",
				team2Id: "TEAM2",
				score1: 2,
				score2: 1,
				createdAt: "2025-08-30T10:00:00Z",
			};

			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([mockMatch]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getMatch(1);
			expect(result).toEqual(mockMatch);
		});

		it("should return null when match does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getMatch(999);
			expect(result).toBeNull();
		});
	});

	describe("getMatchesBetweenTeams", () => {
		it("should return matches between specific teams", async () => {
			const mockMatches: Match[] = [
				{
					id: 1,
					tournamentId: "2025-08-30-1",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 2,
					score2: 1,
					createdAt: "2025-08-30T10:00:00Z",
				},
			];

			const mockSelect = {
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve(mockMatches),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getMatchesBetweenTeams(
				"2025-08-30-1",
				"TEAM1",
				"TEAM2",
			);
			expect(result).toEqual(mockMatches);
		});

		it("should return empty array when no matches found", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						orderBy: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getMatchesBetweenTeams(
				"2025-08-30-1",
				"TEAM1",
				"TEAM2",
			);
			expect(result).toEqual([]);
		});
	});

	describe("getTeamStats", () => {
		it("should calculate team statistics correctly", async () => {
			const mockMatches: Match[] = [
				{
					id: 1,
					tournamentId: "2025-08-30-1",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 2,
					score2: 1,
					createdAt: "2025-08-30T10:00:00Z",
				},
				{
					id: 2,
					tournamentId: "2025-08-30-1",
					team1Id: "TEAM3",
					team2Id: "TEAM1",
					score1: 1,
					score2: 3,
					createdAt: "2025-08-30T11:00:00Z",
				},
			];

			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve(mockMatches),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getTeamStats("2025-08-30-1", "TEAM1");
			expect(result.wins).toBe(2);
			expect(result.losses).toBe(0);
			expect(result.totalMatches).toBe(2);
			expect(result.totalScoreFor).toBe(5); // 2 + 3
			expect(result.totalScoreAgainst).toBe(2); // 1 + 1
		});

		it("should handle team with no matches", async () => {
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getTeamStats("2025-08-30-1", "TEAM1");
			expect(result.wins).toBe(0);
			expect(result.losses).toBe(0);
			expect(result.totalMatches).toBe(0);
			expect(result.totalScoreFor).toBe(0);
			expect(result.totalScoreAgainst).toBe(0);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				matchRepo.getTeamStats("2025-08-30-1", "TEAM1"),
			).rejects.toThrow("Failed to get team stats");
		});
	});

	describe("validateTeamsExist", () => {
		it("should return empty array when both teams exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([{ id: "TEAM1" }, { id: "TEAM2" }]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.validateTeamsExist(
				"2025-08-30-1",
				"TEAM1",
				"TEAM2",
			);
			expect(result).toEqual([]);
		});

		it("should return missing team IDs", async () => {
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([{ id: "TEAM1" }]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.validateTeamsExist(
				"2025-08-30-1",
				"TEAM1",
				"TEAM2",
			);
			expect(result).toEqual(["TEAM2"]);
		});

		it("should return both team IDs when neither exists", async () => {
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.validateTeamsExist(
				"2025-08-30-1",
				"TEAM1",
				"TEAM2",
			);
			expect(result).toEqual(["TEAM1", "TEAM2"]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				matchRepo.validateTeamsExist("2025-08-30-1", "TEAM1", "TEAM2"),
			).rejects.toThrow("Failed to validate teams exist");
		});
	});

	describe("getTournamentSummary", () => {
		it("should return tournament summary with team stats", async () => {
			const mockMatches: Match[] = [
				{
					id: 1,
					tournamentId: "2025-08-30-1",
					team1Id: "TEAM1",
					team2Id: "TEAM2",
					score1: 2,
					score2: 1,
					createdAt: "2025-08-30T10:00:00Z",
				},
			];

			const mockTeams = [{ id: "TEAM1" }, { id: "TEAM2" }];

			let selectCallCount = 0;
			const mockSelect = {
				from: (table: any) => {
					selectCallCount++;
					if (selectCallCount === 1) {
						// First call for getMatches
						return {
							where: () => ({
								orderBy: () => Promise.resolve(mockMatches),
							}),
						};
					} else if (selectCallCount === 2) {
						// Second call for teams
						return {
							where: () => Promise.resolve(mockTeams),
						};
					} else {
						// Subsequent calls for team stats
						return {
							where: () => Promise.resolve(mockMatches),
						};
					}
				},
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getTournamentSummary("2025-08-30-1");
			expect(result.totalMatches).toBe(1);
			expect(result.totalGoals).toBe(3);
			expect(result.averageGoalsPerMatch).toBe(3);
			expect(result.teamStats).toHaveLength(2);
		});

		it("should handle tournament with no matches", async () => {
			let selectCallCount = 0;
			const mockSelect = {
				from: (table: any) => {
					selectCallCount++;
					if (selectCallCount === 1) {
						// First call for getMatches
						return {
							where: () => ({
								orderBy: () => Promise.resolve([]),
							}),
						};
					} else {
						// Second call for teams
						return {
							where: () => Promise.resolve([]),
						};
					}
				},
			};
			db.select = () => mockSelect as any;

			const result = await matchRepo.getTournamentSummary("2025-08-30-1");
			expect(result.totalMatches).toBe(0);
			expect(result.totalGoals).toBe(0);
			expect(result.averageGoalsPerMatch).toBe(0);
			expect(result.teamStats).toEqual([]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				matchRepo.getTournamentSummary("2025-08-30-1"),
			).rejects.toThrow("Failed to get tournament summary");
		});
	});
});
