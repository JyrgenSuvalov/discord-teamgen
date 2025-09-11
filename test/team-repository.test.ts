import { describe, it, expect, beforeEach } from "vitest";
import { createDatabase, TeamRepository, type Team } from "../src/db";

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

describe("TeamRepository", () => {
	let db: ReturnType<typeof createDatabase>;
	let teamRepo: TeamRepository;

	beforeEach(() => {
		db = createDatabase(mockD1);
		teamRepo = new TeamRepository(db);
	});

	describe("createTeams", () => {
		it("should create teams with players successfully", async () => {
			const mockInsert = {
				values: () => Promise.resolve(),
			};
			const mockDelete = {
				where: () => Promise.resolve(),
			};

			db.insert = () => mockInsert as any;
			db.delete = () => mockDelete as any;

			const teamData = [
				{ id: "TEAM1", players: ["player1", "player2", "player3"] },
				{ id: "TEAM2", players: ["player4", "player5", "player6"] },
			];

			await expect(
				teamRepo.createTeams("2025-08-30-1", teamData),
			).resolves.not.toThrow();
		});

		it("should handle empty team data", async () => {
			const mockInsert = {
				values: () => Promise.resolve(),
			};
			const mockDelete = {
				where: () => Promise.resolve(),
			};

			db.insert = () => mockInsert as any;
			db.delete = () => mockDelete as any;

			await expect(
				teamRepo.createTeams("2025-08-30-1", []),
			).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.delete = () => {
				throw new Error("Database error");
			};

			const teamData = [{ id: "TEAM1", players: ["player1"] }];

			await expect(
				teamRepo.createTeams("2025-08-30-1", teamData),
			).rejects.toThrow("Failed to create teams");
		});
	});

	describe("getTeams", () => {
		it("should return teams with players", async () => {
			const mockTeams = [
				{ tournamentId: "2025-08-30-1", id: "TEAM1", locked: false },
			];

			const mockTeamPlayers = [
				{
					teamId: "TEAM1",
					tournamentId: "2025-08-30-1",
					playerId: "player1",
					tournamentPlayer: {
						tournamentId: "2025-08-30-1",
						playerId: "player1",
						adr: 85.5,
						adrLocked: false,
					},
					player: {
						id: "player1",
						username: "testuser",
						displayName: "Test User",
					},
				},
			];

			let selectCallCount = 0;
			const mockSelect = {
				from: (table: any) => {
					selectCallCount++;
					if (selectCallCount === 1) {
						// First call for teams
						return {
							where: () => Promise.resolve(mockTeams),
						};
					} else {
						// Second call for team players
						return {
							leftJoin: () => ({
								leftJoin: () => ({
									where: () => Promise.resolve(mockTeamPlayers),
								}),
							}),
						};
					}
				},
			};

			db.select = () => mockSelect as any;

			const result = await teamRepo.getTeams("2025-08-30-1");
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("TEAM1");
			expect(result[0].players).toHaveLength(1);
			expect(result[0].players?.[0].playerId).toBe("player1");
		});

		it("should return empty array when no teams found", async () => {
			let selectCallCount = 0;
			const mockSelect = {
				from: (table: any) => {
					selectCallCount++;
					if (selectCallCount === 1) {
						// First call for teams
						return {
							where: () => Promise.resolve([]),
						};
					} else {
						// Second call for team players
						return {
							leftJoin: () => ({
								leftJoin: () => ({
									where: () => Promise.resolve([]),
								}),
							}),
						};
					}
				},
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.getTeams("nonexistent");
			expect(result).toEqual([]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(teamRepo.getTeams("2025-08-30-1")).rejects.toThrow(
				"Failed to get teams",
			);
		});
	});

	describe("getTeam", () => {
		it("should return team when exists", async () => {
			const mockTeam: Team = {
				tournamentId: "2025-08-30-1",
				id: "TEAM1",
				locked: false,
			};

			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([mockTeam]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.getTeam("2025-08-30-1", "TEAM1");
			expect(result).toEqual(mockTeam);
		});

		it("should return null when team does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.getTeam("2025-08-30-1", "NONEXISTENT");
			expect(result).toBeNull();
		});
	});

	describe("lockTeams", () => {
		it("should lock teams successfully", async () => {
			const mockUpdate = {
				set: () => ({
					where: () => Promise.resolve(),
				}),
			};
			db.update = () => mockUpdate as any;

			await expect(teamRepo.lockTeams("2025-08-30-1")).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.update = () => {
				throw new Error("Database error");
			};

			await expect(teamRepo.lockTeams("2025-08-30-1")).rejects.toThrow(
				"Failed to lock teams",
			);
		});
	});

	describe("unlockTeams", () => {
		it("should unlock teams successfully", async () => {
			const mockUpdate = {
				set: () => ({
					where: () => Promise.resolve(),
				}),
			};
			db.update = () => mockUpdate as any;

			await expect(teamRepo.unlockTeams("2025-08-30-1")).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.update = () => {
				throw new Error("Database error");
			};

			await expect(teamRepo.unlockTeams("2025-08-30-1")).rejects.toThrow(
				"Failed to unlock teams",
			);
		});
	});

	describe("clearTeams", () => {
		it("should clear teams and team players successfully", async () => {
			const mockDelete = {
				where: () => Promise.resolve(),
			};
			db.delete = () => mockDelete as any;

			await expect(teamRepo.clearTeams("2025-08-30-1")).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.delete = () => {
				throw new Error("Database error");
			};

			await expect(teamRepo.clearTeams("2025-08-30-1")).rejects.toThrow(
				"Failed to clear teams",
			);
		});
	});

	describe("teamsExist", () => {
		it("should return true when teams exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ id: "TEAM1" }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.teamsExist("2025-08-30-1");
			expect(result).toBe(true);
		});

		it("should return false when no teams exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.teamsExist("2025-08-30-1");
			expect(result).toBe(false);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(teamRepo.teamsExist("2025-08-30-1")).rejects.toThrow(
				"Failed to check if teams exist",
			);
		});
	});

	describe("areTeamsLocked", () => {
		it("should return true when teams are locked", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ locked: true }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.areTeamsLocked("2025-08-30-1");
			expect(result).toBe(true);
		});

		it("should return false when teams are not locked", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ locked: false }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.areTeamsLocked("2025-08-30-1");
			expect(result).toBe(false);
		});

		it("should return false when no teams exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.areTeamsLocked("2025-08-30-1");
			expect(result).toBe(false);
		});
	});

	describe("validateTeamIds", () => {
		it("should return empty array when all team IDs exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([{ id: "TEAM1" }, { id: "TEAM2" }]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.validateTeamIds("2025-08-30-1", [
				"TEAM1",
				"TEAM2",
			]);
			expect(result).toEqual([]);
		});

		it("should return missing team IDs", async () => {
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([{ id: "TEAM1" }]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await teamRepo.validateTeamIds("2025-08-30-1", [
				"TEAM1",
				"TEAM2",
				"TEAM3",
			]);
			expect(result).toEqual(["TEAM2", "TEAM3"]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				teamRepo.validateTeamIds("2025-08-30-1", ["TEAM1"]),
			).rejects.toThrow("Failed to validate team IDs");
		});
	});
});
