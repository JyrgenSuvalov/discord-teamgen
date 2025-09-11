import { describe, it, expect, beforeEach } from "vitest";
import {
	createDatabase,
	PlayerRepository,
	type Player,
	type TournamentPlayer,
} from "../src/db";

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

describe("PlayerRepository", () => {
	let db: ReturnType<typeof createDatabase>;
	let playerRepo: PlayerRepository;

	beforeEach(() => {
		db = createDatabase(mockD1);
		playerRepo = new PlayerRepository(db);
	});

	describe("upsertPlayer", () => {
		it("should upsert player successfully", async () => {
			const mockInsert = {
				values: () => ({
					onConflictDoUpdate: () => Promise.resolve(),
				}),
			};
			db.insert = () => mockInsert as any;

			const playerData = {
				id: "user123",
				username: "testuser",
				displayName: "Test User",
			};

			await expect(playerRepo.upsertPlayer(playerData)).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.insert = () => {
				throw new Error("Database error");
			};

			const playerData = {
				id: "user123",
				username: "testuser",
			};

			await expect(playerRepo.upsertPlayer(playerData)).rejects.toThrow(
				"Failed to upsert player",
			);
		});
	});

	describe("getPlayer", () => {
		it("should return player when exists", async () => {
			const mockPlayer: Player = {
				id: "user123",
				username: "testuser",
				displayName: "Test User",
			};

			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([mockPlayer]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getPlayer("user123");
			expect(result).toEqual(mockPlayer);
		});

		it("should return null when player does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getPlayer("nonexistent");
			expect(result).toBeNull();
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(playerRepo.getPlayer("user123")).rejects.toThrow(
				"Failed to get player",
			);
		});
	});

	describe("getTournamentPlayers", () => {
		it("should return tournament players with player data", async () => {
			const mockResult = [
				{
					tournamentId: "2025-08-30-1",
					playerId: "user123",
					adr: 85.5,
					adrLocked: false,
					player: {
						id: "user123",
						username: "testuser",
						displayName: "Test User",
					},
				},
			];

			const mockSelect = {
				from: () => ({
					leftJoin: () => ({
						where: () => Promise.resolve(mockResult),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getTournamentPlayers("2025-08-30-1");
			expect(result).toHaveLength(1);
			expect(result[0].playerId).toBe("user123");
			expect(result[0].adr).toBe(85.5);
			expect(result[0].player?.username).toBe("testuser");
		});

		it("should return empty array when no players found", async () => {
			const mockSelect = {
				from: () => ({
					leftJoin: () => ({
						where: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getTournamentPlayers("nonexistent");
			expect(result).toEqual([]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				playerRepo.getTournamentPlayers("2025-08-30-1"),
			).rejects.toThrow("Failed to get tournament players");
		});
	});

	describe("upsertTournamentPlayer", () => {
		it("should upsert tournament player successfully", async () => {
			const mockInsert = {
				values: () => ({
					onConflictDoUpdate: () => Promise.resolve(),
				}),
			};
			db.insert = () => mockInsert as any;

			const data = {
				tournamentId: "2025-08-30-1",
				playerId: "user123",
				adr: 85.5,
				adrLocked: false,
			};

			await expect(
				playerRepo.upsertTournamentPlayer(data),
			).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.insert = () => {
				throw new Error("Database error");
			};

			const data = {
				tournamentId: "2025-08-30-1",
				playerId: "user123",
				adr: 85.5,
			};

			await expect(playerRepo.upsertTournamentPlayer(data)).rejects.toThrow(
				"Failed to upsert tournament player",
			);
		});
	});

	describe("getTournamentPlayer", () => {
		it("should return tournament player when exists", async () => {
			const mockTournamentPlayer: TournamentPlayer = {
				tournamentId: "2025-08-30-1",
				playerId: "user123",
				adr: 85.5,
				adrLocked: false,
			};

			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([mockTournamentPlayer]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getTournamentPlayer(
				"2025-08-30-1",
				"user123",
			);
			expect(result).toEqual(mockTournamentPlayer);
		});

		it("should return null when tournament player does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getTournamentPlayer(
				"2025-08-30-1",
				"nonexistent",
			);
			expect(result).toBeNull();
		});
	});

	describe("setPlayerAdrLock", () => {
		it("should lock player ADR successfully", async () => {
			const mockUpdate = {
				set: () => ({
					where: () => Promise.resolve(),
				}),
			};
			db.update = () => mockUpdate as any;

			await expect(
				playerRepo.setPlayerAdrLock("2025-08-30-1", "user123", true),
			).resolves.not.toThrow();
		});

		it("should unlock player ADR successfully", async () => {
			const mockUpdate = {
				set: () => ({
					where: () => Promise.resolve(),
				}),
			};
			db.update = () => mockUpdate as any;

			await expect(
				playerRepo.setPlayerAdrLock("2025-08-30-1", "user123", false),
			).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.update = () => {
				throw new Error("Database error");
			};

			await expect(
				playerRepo.setPlayerAdrLock("2025-08-30-1", "user123", true),
			).rejects.toThrow("Failed to set player ADR lock");
		});
	});

	describe("isPlayerAdrLocked", () => {
		it("should return true when ADR is locked", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ adrLocked: true }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.isPlayerAdrLocked(
				"2025-08-30-1",
				"user123",
			);
			expect(result).toBe(true);
		});

		it("should return false when ADR is not locked", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ adrLocked: false }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.isPlayerAdrLocked(
				"2025-08-30-1",
				"user123",
			);
			expect(result).toBe(false);
		});

		it("should return false when player not found", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.isPlayerAdrLocked(
				"2025-08-30-1",
				"nonexistent",
			);
			expect(result).toBe(false);
		});
	});

	describe("getPlayersWithoutAdr", () => {
		it("should return players without ADR", async () => {
			const mockResult = [
				{
					tournamentId: "2025-08-30-1",
					playerId: "user123",
					adr: null,
					adrLocked: false,
					player: {
						id: "user123",
						username: "testuser",
						displayName: "Test User",
					},
				},
			];

			const mockSelect = {
				from: () => ({
					leftJoin: () => ({
						where: () => Promise.resolve(mockResult),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getPlayersWithoutAdr("2025-08-30-1");
			expect(result).toHaveLength(1);
			expect(result[0].adr).toBeNull();
			expect(result[0].player?.username).toBe("testuser");
		});

		it("should return empty array when all players have ADR", async () => {
			const mockSelect = {
				from: () => ({
					leftJoin: () => ({
						where: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await playerRepo.getPlayersWithoutAdr("2025-08-30-1");
			expect(result).toEqual([]);
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				playerRepo.getPlayersWithoutAdr("2025-08-30-1"),
			).rejects.toThrow("Failed to get players without ADR");
		});
	});
});
