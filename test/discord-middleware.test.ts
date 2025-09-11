/**
 * Unit tests for Discord signature verification middleware
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
	discordSignatureMiddleware,
	getDiscordBody,
} from "../src/utils/discord-middleware";

// Mock the discord-verify module
vi.mock("../src/utils/discord-verify", () => ({
	verifyDiscordSignature: vi.fn(),
	DiscordSignatureError: class extends Error {
		constructor(message: string) {
			super(message);
			this.name = "DiscordSignatureError";
		}
	},
}));

import {
	verifyDiscordSignature,
	DiscordSignatureError,
} from "../src/utils/discord-verify";

describe("Discord Signature Middleware", () => {
	let app: Hono;
	const mockPublicKey =
		"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono();
	});

	describe("discordSignatureMiddleware", () => {
		it("should pass through valid requests", async () => {
			// Mock successful signature verification
			vi.mocked(verifyDiscordSignature).mockResolvedValue(true);

			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const mockBody = JSON.stringify({ type: 1 });
			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: mockBody,
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ success: true });
			expect(verifyDiscordSignature).toHaveBeenCalledWith(
				"valid-signature",
				"1640995200",
				mockBody,
				mockPublicKey,
			);
		});

		it("should reject requests with missing signature header", async () => {
			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: JSON.stringify({ type: 1 }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({
				error: "Missing signature headers",
			});
			expect(verifyDiscordSignature).not.toHaveBeenCalled();
		});

		it("should reject requests with missing timestamp header", async () => {
			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"content-type": "application/json",
				},
				body: JSON.stringify({ type: 1 }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({
				error: "Missing signature headers",
			});
			expect(verifyDiscordSignature).not.toHaveBeenCalled();
		});

		it("should reject requests with invalid signature", async () => {
			// Mock failed signature verification
			vi.mocked(verifyDiscordSignature).mockResolvedValue(false);

			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "invalid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: JSON.stringify({ type: 1 }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: "Invalid signature" });
		});

		it("should handle invalid JSON body", async () => {
			// Mock successful signature verification
			vi.mocked(verifyDiscordSignature).mockResolvedValue(true);

			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: "invalid-json",
			});

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: "Invalid JSON body" });
		});

		it("should handle DiscordSignatureError", async () => {
			// Mock signature verification throwing DiscordSignatureError
			vi.mocked(verifyDiscordSignature).mockRejectedValue(
				new DiscordSignatureError("Signature verification failed"),
			);

			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: JSON.stringify({ type: 1 }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({
				error: "Signature verification failed",
			});
		});

		it("should handle generic errors", async () => {
			// Mock signature verification throwing generic error
			vi.mocked(verifyDiscordSignature).mockRejectedValue(
				new Error("Generic error"),
			);

			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => c.json({ success: true }));

			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: JSON.stringify({ type: 1 }),
			});

			expect(response.status).toBe(500);
			expect(await response.json()).toEqual({ error: "Internal server error" });
		});

		it("should store parsed body in context for handlers", async () => {
			// Mock successful signature verification
			vi.mocked(verifyDiscordSignature).mockResolvedValue(true);

			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);
			app.post("/webhook", (c) => {
				const discordBody = getDiscordBody(c);
				return c.json({ receivedBody: discordBody });
			});

			const mockBody = { type: 1, data: { name: "ping" } };
			const response = await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: JSON.stringify(mockBody),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ receivedBody: mockBody });
		});
	});

	describe("getDiscordBody", () => {
		it("should return stored Discord body from context", async () => {
			const middleware = discordSignatureMiddleware(mockPublicKey);
			app.use("*", middleware);

			let capturedBody: any;
			app.post("/webhook", (c) => {
				capturedBody = getDiscordBody(c);
				return c.json({ success: true });
			});

			// Mock successful signature verification
			vi.mocked(verifyDiscordSignature).mockResolvedValue(true);

			const mockBody = { type: 1, data: { name: "test" } };
			await app.request("/webhook", {
				method: "POST",
				headers: {
					"x-signature-ed25519": "valid-signature",
					"x-signature-timestamp": "1640995200",
					"content-type": "application/json",
				},
				body: JSON.stringify(mockBody),
			});

			expect(capturedBody).toEqual(mockBody);
		});
	});
});
