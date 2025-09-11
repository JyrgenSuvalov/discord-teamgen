import { describe, it, expect, beforeEach } from "vitest";
import {
	createDatabase,
	TournamentRepository,
	type Tournament,
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

describe("TournamentRepository", () => {
	let db: ReturnType<typeof createDatabase>;
	let tournamentRepo: TournamentRepository;

	beforeEach(() => {
		db = createDatabase(mockD1);
		tournamentRepo = new TournamentRepository(db);
	});

	describe("createTournament", () => {
		it("should create a tournament with given ID", async () => {
			// Mock the insert operation
			const mockInsert = {
				values: () => Promise.resolve(),
			};
			db.insert = () => mockInsert as any;

			await expect(
				tournamentRepo.createTournament("2025-08-30-1"),
			).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			// Mock insert to throw error
			db.insert = () => {
				throw new Error("Database error");
			};

			await expect(
				tournamentRepo.createTournament("2025-08-30-1"),
			).rejects.toThrow("Failed to create tournament");
		});
	});

	describe("getOpenTournament", () => {
		it("should return open tournament when exists", async () => {
			const mockTournament: Tournament = {
				id: "2025-08-30-1",
				status: "open",
				createdAt: "2025-08-30T10:00:00Z",
			};

			// Mock the select operation
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([mockTournament]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.getOpenTournament();
			expect(result).toEqual(mockTournament);
		});

		it("should return null when no open tournament exists", async () => {
			// Mock empty result
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.getOpenTournament();
			expect(result).toBeNull();
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(tournamentRepo.getOpenTournament()).rejects.toThrow(
				"Failed to get open tournament",
			);
		});
	});

	describe("getTournamentById", () => {
		it("should return tournament when exists", async () => {
			const mockTournament: Tournament = {
				id: "2025-08-30-1",
				status: "open",
				createdAt: "2025-08-30T10:00:00Z",
			};

			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([mockTournament]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.getTournamentById("2025-08-30-1");
			expect(result).toEqual(mockTournament);
		});

		it("should return null when tournament does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.getTournamentById("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("closeTournament", () => {
		it("should close tournament successfully", async () => {
			const mockUpdate = {
				set: () => ({
					where: () => Promise.resolve(),
				}),
			};
			db.update = () => mockUpdate as any;

			await expect(
				tournamentRepo.closeTournament("2025-08-30-1"),
			).resolves.not.toThrow();
		});

		it("should throw DatabaseError on failure", async () => {
			db.update = () => {
				throw new Error("Database error");
			};

			await expect(
				tournamentRepo.closeTournament("2025-08-30-1"),
			).rejects.toThrow("Failed to close tournament");
		});
	});

	describe("generateTournamentId", () => {
		it("should generate first tournament ID for date", async () => {
			// Mock empty result (no existing tournaments)
			const mockSelect = {
				from: () => ({
					where: () => Promise.resolve([]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.generateTournamentId("2025-08-30");
			expect(result).toBe("2025-08-30-1");
		});

		it("should generate next sequential ID when tournaments exist", async () => {
			// Mock existing tournaments
			const mockSelect = {
				from: () => ({
					where: () =>
						Promise.resolve([{ id: "2025-08-30-1" }, { id: "2025-08-30-2" }]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.generateTournamentId("2025-08-30");
			expect(result).toBe("2025-08-30-3");
		});

		it("should fill gaps in sequence numbers", async () => {
			// Mock tournaments with gap (missing -2)
			const mockSelect = {
				from: () => ({
					where: () =>
						Promise.resolve([{ id: "2025-08-30-1" }, { id: "2025-08-30-3" }]),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.generateTournamentId("2025-08-30");
			expect(result).toBe("2025-08-30-2");
		});

		it("should throw DatabaseError on failure", async () => {
			db.select = () => {
				throw new Error("Database error");
			};

			await expect(
				tournamentRepo.generateTournamentId("2025-08-30"),
			).rejects.toThrow("Failed to generate tournament ID");
		});
	});

	describe("tournamentExists", () => {
		it("should return true when tournament exists", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ id: "2025-08-30-1" }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.tournamentExists("2025-08-30-1");
			expect(result).toBe(true);
		});

		it("should return false when tournament does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.tournamentExists("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("getTournamentStatus", () => {
		it("should return tournament status when exists", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([{ status: "open" }]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.getTournamentStatus("2025-08-30-1");
			expect(result).toBe("open");
		});

		it("should return null when tournament does not exist", async () => {
			const mockSelect = {
				from: () => ({
					where: () => ({
						limit: () => Promise.resolve([]),
					}),
				}),
			};
			db.select = () => mockSelect as any;

			const result = await tournamentRepo.getTournamentStatus("nonexistent");
			expect(result).toBeNull();
		});
	});
});
