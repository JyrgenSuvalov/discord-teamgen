/**
 * Unit tests for Discord signature verification utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	verifyDiscordSignature,
	DiscordSignatureError,
} from "../src/utils/discord-verify";

// Mock Web Crypto API for testing
const mockCrypto = {
	subtle: {
		importKey: vi.fn(),
		verify: vi.fn(),
	},
};

// Mock global crypto
Object.defineProperty(globalThis, "crypto", {
	value: mockCrypto,
	writable: true,
});

describe("Discord Signature Verification", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("verifyDiscordSignature", () => {
		const mockPublicKey =
			"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
		const mockSignature =
			"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
		const mockTimestamp = "1640995200";
		const mockBody = '{"type":1}';

		it("should return true for valid signature", async () => {
			// Mock successful crypto operations
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(true);

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(true);
			expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
				"raw",
				expect.any(Uint8Array),
				{
					name: "Ed25519",
					namedCurve: "Ed25519",
				},
				false,
				["verify"],
			);
			expect(mockCrypto.subtle.verify).toHaveBeenCalledWith(
				"Ed25519",
				mockCryptoKey,
				expect.any(Uint8Array),
				expect.any(Uint8Array),
			);
		});

		it("should return false for invalid signature", async () => {
			// Mock crypto operations with invalid signature
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(false);

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should return false when crypto operations fail", async () => {
			// Mock crypto operation failure
			mockCrypto.subtle.importKey.mockRejectedValue(new Error("Crypto error"));

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle hex strings with 0x prefix", async () => {
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(true);

			const prefixedSignature = "0x" + mockSignature;
			const prefixedPublicKey = "0x" + mockPublicKey;

			const result = await verifyDiscordSignature(
				prefixedSignature,
				mockTimestamp,
				mockBody,
				prefixedPublicKey,
			);

			expect(result).toBe(true);
		});

		it("should handle odd-length hex strings by padding", async () => {
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(true);

			// Remove one character to make it odd length
			const oddLengthSignature = mockSignature.slice(1);

			const result = await verifyDiscordSignature(
				oddLengthSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(true);
		});

		it("should create correct message for verification", async () => {
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(true);

			await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			// Check that verify was called with the correct message (timestamp + body)
			const expectedMessage = new TextEncoder().encode(
				mockTimestamp + mockBody,
			);
			expect(mockCrypto.subtle.verify).toHaveBeenCalledWith(
				"Ed25519",
				mockCryptoKey,
				expect.any(Uint8Array),
				expectedMessage,
			);
		});

		it("should handle empty signature", async () => {
			// Mock crypto operations to fail for empty signature
			mockCrypto.subtle.importKey.mockRejectedValue(
				new Error("Invalid signature"),
			);

			const result = await verifyDiscordSignature(
				"",
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle empty public key", async () => {
			// Mock crypto operations to fail for empty public key
			mockCrypto.subtle.importKey.mockRejectedValue(
				new Error("Invalid public key"),
			);

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				"",
			);

			expect(result).toBe(false);
		});

		it("should handle empty timestamp", async () => {
			// Empty timestamp should still work as it's just concatenated
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(true);

			const result = await verifyDiscordSignature(
				mockSignature,
				"",
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(true);
		});

		it("should handle empty body", async () => {
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockResolvedValue(true);

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				"",
				mockPublicKey,
			);

			expect(result).toBe(true);
			// Should still work with empty body
			const expectedMessage = new TextEncoder().encode(mockTimestamp + "");
			expect(mockCrypto.subtle.verify).toHaveBeenCalledWith(
				"Ed25519",
				mockCryptoKey,
				expect.any(Uint8Array),
				expectedMessage,
			);
		});

		it("should handle invalid hex characters in signature", async () => {
			// Mock crypto operations to fail for invalid hex
			mockCrypto.subtle.importKey.mockRejectedValue(new Error("Invalid hex"));

			const invalidSignature = "invalid-hex-signature-with-non-hex-chars";

			const result = await verifyDiscordSignature(
				invalidSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle invalid hex characters in public key", async () => {
			// Mock crypto operations to fail for invalid hex
			mockCrypto.subtle.importKey.mockRejectedValue(new Error("Invalid hex"));

			const invalidPublicKey = "invalid-hex-key-with-non-hex-chars";

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				invalidPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle very long signature", async () => {
			// Mock crypto operations to fail for oversized signature
			mockCrypto.subtle.importKey.mockRejectedValue(
				new Error("Signature too long"),
			);

			const longSignature = "a".repeat(1000);

			const result = await verifyDiscordSignature(
				longSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle very long public key", async () => {
			// Mock crypto operations to fail for oversized key
			mockCrypto.subtle.importKey.mockRejectedValue(new Error("Key too long"));

			const longPublicKey = "a".repeat(1000);

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				longPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle crypto.subtle.importKey failure", async () => {
			mockCrypto.subtle.importKey.mockRejectedValue(
				new Error("Import key failed"),
			);

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});

		it("should handle crypto.subtle.verify failure", async () => {
			const mockCryptoKey = { type: "public" };
			mockCrypto.subtle.importKey.mockResolvedValue(mockCryptoKey);
			mockCrypto.subtle.verify.mockRejectedValue(new Error("Verify failed"));

			const result = await verifyDiscordSignature(
				mockSignature,
				mockTimestamp,
				mockBody,
				mockPublicKey,
			);

			expect(result).toBe(false);
		});
	});

	describe("DiscordSignatureError", () => {
		it("should create error with correct name and message", () => {
			const errorMessage = "Test signature error";
			const error = new DiscordSignatureError(errorMessage);

			expect(error.name).toBe("DiscordSignatureError");
			expect(error.message).toBe(errorMessage);
			expect(error).toBeInstanceOf(Error);
		});
	});
});
