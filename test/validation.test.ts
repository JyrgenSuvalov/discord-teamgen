import { describe, it, expect } from "vitest";
import {
	DiscordInteractionSchema,
	PingCommandSchema,
	ValidationError,
	validateData,
	safeValidateData,
	extractCommandOptions,
	getOptionValue,
	isApplicationCommand,
	isPingInteraction,
	formatValidationErrorForDiscord,
	EnvironmentSchema,
	DISCORD_INTERACTION_TYPES,
} from "../src/validation";

describe("Discord Validation Schemas", () => {
	describe("DiscordInteractionSchema", () => {
		it("should validate a valid Discord interaction", () => {
			const validInteraction = {
				id: "123456789",
				application_id: "987654321",
				type: 2,
				data: {
					id: "111",
					name: "ping",
					options: [
						{
							name: "message",
							type: 3,
							value: "Hello World",
						},
					],
				},
				token: "interaction_token",
				version: 1,
			};

			expect(() =>
				validateData(DiscordInteractionSchema, validInteraction),
			).not.toThrow();
			const result = validateData(DiscordInteractionSchema, validInteraction);
			expect(result.id).toBe("123456789");
			expect(result.type).toBe(2);
		});

		it("should reject invalid Discord interaction", () => {
			const invalidInteraction = {
				id: 123, // Should be string
				type: "invalid", // Should be number
			};

			expect(() =>
				validateData(DiscordInteractionSchema, invalidInteraction),
			).toThrow(ValidationError);
		});

		it("should validate ping interaction", () => {
			const pingInteraction = {
				id: "123",
				application_id: "456",
				type: 1,
				token: "token",
				version: 1,
			};

			const result = validateData(DiscordInteractionSchema, pingInteraction);
			expect(result.type).toBe(1);
		});
	});

	describe("PingCommandSchema", () => {
		it("should validate valid ping command", () => {
			const validCommand = { message: "Hello World!" };

			const result = validateData(PingCommandSchema, validCommand);
			expect(result.message).toBe("Hello World!");
		});

		it("should trim whitespace from message", () => {
			const commandWithWhitespace = { message: "  Hello World!  " };

			const result = validateData(PingCommandSchema, commandWithWhitespace);
			expect(result.message).toBe("Hello World!");
		});

		it("should reject empty message", () => {
			const emptyCommand = { message: "" };

			expect(() => validateData(PingCommandSchema, emptyCommand)).toThrow(
				ValidationError,
			);
		});

		it("should reject message that is too long", () => {
			const longMessage = "a".repeat(2001);
			const longCommand = { message: longMessage };

			expect(() => validateData(PingCommandSchema, longCommand)).toThrow(
				ValidationError,
			);
		});

		it("should accept message at max length", () => {
			const maxMessage = "a".repeat(2000);
			const maxCommand = { message: maxMessage };

			expect(() => validateData(PingCommandSchema, maxCommand)).not.toThrow();
		});
	});
});

describe("Validation Utilities", () => {
	describe("validateData", () => {
		it("should return parsed data for valid input", () => {
			const schema = PingCommandSchema;
			const data = { message: "test" };

			const result = validateData(schema, data);
			expect(result.message).toBe("test");
		});

		it("should throw ValidationError for invalid input", () => {
			const schema = PingCommandSchema;
			const data = { message: "" };

			expect(() => validateData(schema, data)).toThrow(ValidationError);
		});
	});

	describe("safeValidateData", () => {
		it("should return success result for valid input", () => {
			const schema = PingCommandSchema;
			const data = { message: "test" };

			const result = safeValidateData(schema, data);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.message).toBe("test");
			}
		});

		it("should return error result for invalid input", () => {
			const schema = PingCommandSchema;
			const data = { message: "" };

			const result = safeValidateData(schema, data);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeInstanceOf(ValidationError);
			}
		});
	});

	describe("extractCommandOptions", () => {
		it("should extract options from Discord interaction", () => {
			const interaction = {
				id: "123",
				application_id: "456",
				type: 2,
				data: {
					id: "789",
					name: "ping",
					options: [
						{ name: "message", type: 3, value: "Hello" },
						{ name: "count", type: 4, value: 5 },
					],
				},
				token: "token",
				version: 1,
			};

			const options = extractCommandOptions(interaction);
			expect(options.message).toBe("Hello");
			expect(options.count).toBe(5);
		});

		it("should return empty object when no options", () => {
			const interaction = {
				id: "123",
				application_id: "456",
				type: 2,
				token: "token",
				version: 1,
			};

			const options = extractCommandOptions(interaction);
			expect(Object.keys(options)).toHaveLength(0);
		});
	});

	describe("getOptionValue", () => {
		it("should return option value when present", () => {
			const options = { message: "Hello", count: 5 };

			expect(getOptionValue(options, "message")).toBe("Hello");
			expect(getOptionValue(options, "count")).toBe(5);
		});

		it("should return default value when option not present", () => {
			const options = { message: "Hello" };

			expect(getOptionValue(options, "missing", "default")).toBe("default");
		});

		it("should return undefined when option not present and no default", () => {
			const options = { message: "Hello" };

			expect(getOptionValue(options, "missing")).toBeUndefined();
		});
	});

	describe("interaction type helpers", () => {
		it("should identify application command interactions", () => {
			const interaction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
			} as any;
			expect(isApplicationCommand(interaction)).toBe(true);

			const pingInteraction = { type: DISCORD_INTERACTION_TYPES.PING } as any;
			expect(isApplicationCommand(pingInteraction)).toBe(false);
		});

		it("should identify ping interactions", () => {
			const interaction = { type: DISCORD_INTERACTION_TYPES.PING } as any;
			expect(isPingInteraction(interaction)).toBe(true);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
			} as any;
			expect(isPingInteraction(commandInteraction)).toBe(false);
		});
	});

	describe("formatValidationErrorForDiscord", () => {
		it("should format single error message", () => {
			try {
				validateData(PingCommandSchema, { message: "" });
			} catch (error) {
				if (error instanceof ValidationError) {
					const formatted = formatValidationErrorForDiscord(error);
					expect(formatted).toContain("Message cannot be empty");
				}
			}
		});

		it("should format multiple error messages", () => {
			try {
				validateData(PingCommandSchema, { message: "a".repeat(2001) });
			} catch (error) {
				if (error instanceof ValidationError) {
					const formatted = formatValidationErrorForDiscord(error);
					expect(formatted).toContain("Message cannot exceed 2000 characters");
				}
			}
		});
	});

	describe("EnvironmentSchema", () => {
		it("should validate valid environment", () => {
			const env = { DISCORD_PUBLIC_KEY: "valid_key_123" };

			expect(() => validateData(EnvironmentSchema, env)).not.toThrow();
		});

		it("should reject missing DISCORD_PUBLIC_KEY", () => {
			const env = {};

			expect(() => validateData(EnvironmentSchema, env)).toThrow(
				ValidationError,
			);
		});

		it("should reject empty DISCORD_PUBLIC_KEY", () => {
			const env = { DISCORD_PUBLIC_KEY: "" };

			expect(() => validateData(EnvironmentSchema, env)).toThrow(
				ValidationError,
			);
		});
	});

	describe("Edge Cases and Error Handling", () => {
		it("should handle null input gracefully", () => {
			expect(() => validateData(PingCommandSchema, null)).toThrow(
				ValidationError,
			);
		});

		it("should handle undefined input gracefully", () => {
			expect(() => validateData(PingCommandSchema, undefined)).toThrow(
				ValidationError,
			);
		});

		it("should handle non-object input", () => {
			expect(() => validateData(PingCommandSchema, "not an object")).toThrow(
				ValidationError,
			);
			expect(() => validateData(PingCommandSchema, 123)).toThrow(
				ValidationError,
			);
			expect(() => validateData(PingCommandSchema, true)).toThrow(
				ValidationError,
			);
		});

		it("should handle message with only whitespace", () => {
			const whitespaceCommand = { message: "   \n\t   " };

			expect(() => validateData(PingCommandSchema, whitespaceCommand)).toThrow(
				ValidationError,
			);
		});

		it("should handle message with special characters", () => {
			const specialCharsCommand = { message: "!@#$%^&*()_+-=[]{}|;:,.<>?" };

			expect(() =>
				validateData(PingCommandSchema, specialCharsCommand),
			).not.toThrow();
		});

		it("should handle message with unicode characters", () => {
			const unicodeCommand = { message: "🎉 Hello 世界 🌍" };

			expect(() =>
				validateData(PingCommandSchema, unicodeCommand),
			).not.toThrow();
		});

		it("should handle message with newlines", () => {
			const multilineCommand = { message: "Line 1\nLine 2\nLine 3" };

			expect(() =>
				validateData(PingCommandSchema, multilineCommand),
			).not.toThrow();
		});

		it("should handle interaction with missing data field", () => {
			const interaction = {
				id: "123",
				application_id: "456",
				type: 2,
				token: "token",
				version: 1,
				// Missing data field
			};

			const options = extractCommandOptions(interaction);
			expect(Object.keys(options)).toHaveLength(0);
		});

		it("should handle interaction with undefined data field", () => {
			const interaction = {
				id: "123",
				application_id: "456",
				type: 2,
				data: undefined,
				token: "token",
				version: 1,
			};

			const options = extractCommandOptions(interaction);
			expect(Object.keys(options)).toHaveLength(0);
		});

		it("should handle interaction with missing options in data", () => {
			const interaction = {
				id: "123",
				application_id: "456",
				type: 2,
				data: {
					id: "789",
					name: "ping",
					// Missing options
				},
				token: "token",
				version: 1,
			};

			const options = extractCommandOptions(interaction);
			expect(Object.keys(options)).toHaveLength(0);
		});

		it("should handle options with null values", () => {
			const options = { message: "hello", count: 5 } as any;
			// Test with a modified options object that has null/undefined values
			options.message = null;
			options.count = undefined;

			expect(getOptionValue(options, "message")).toBeNull();
			expect(getOptionValue(options, "count")).toBeUndefined();
			expect(getOptionValue(options, "missing", "default")).toBe("default");
		});

		it("should handle complex nested validation errors", () => {
			const invalidInteraction = {
				id: 123, // Should be string
				type: "invalid", // Should be number
				data: {
					name: null, // Should be string
					options: "not an array", // Should be array
				},
			};

			expect(() =>
				validateData(DiscordInteractionSchema, invalidInteraction),
			).toThrow(ValidationError);
		});

		it("should format validation errors with multiple issues", () => {
			try {
				validateData(DiscordInteractionSchema, {
					id: 123,
					type: "invalid",
				});
			} catch (error) {
				if (error instanceof ValidationError) {
					const formatted = formatValidationErrorForDiscord(error);
					expect(formatted).toContain("expected string, received number");
				}
			}
		});

		it("should handle circular references in error formatting", () => {
			// Create a ValidationError by triggering a validation failure
			let circularError: ValidationError;
			try {
				validateData(PingCommandSchema, { message: "" });
			} catch (error) {
				circularError = error as ValidationError;
			}

			// Add circular reference
			(circularError! as any).circular = circularError!;

			expect(() =>
				formatValidationErrorForDiscord(circularError!),
			).not.toThrow();
		});
	});
});
