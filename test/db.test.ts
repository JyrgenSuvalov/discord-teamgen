import { describe, it, expect } from "vitest";
import { createDatabase, MessageRepository, type NewMessage } from "../src/db";

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

describe("Database Setup", () => {
	it("should create database instance", () => {
		const db = createDatabase(mockD1);
		expect(db).toBeDefined();
	});

	it("should create message repository", () => {
		const db = createDatabase(mockD1);
		const messageRepo = new MessageRepository(db);
		expect(messageRepo).toBeDefined();
	});

	it("should validate message data structure", () => {
		const messageData: NewMessage = {
			userId: "test-user-123",
			username: "testuser",
			message: "Hello, world!",
		};

		expect(messageData.userId).toBe("test-user-123");
		expect(messageData.username).toBe("testuser");
		expect(messageData.message).toBe("Hello, world!");
	});
});
