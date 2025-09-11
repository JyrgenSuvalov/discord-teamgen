import { describe, it, expect } from "vitest";
import {
	DISCORD_RESPONSE_TYPES,
	DISCORD_MESSAGE_FLAGS,
	createPongResponse,
	createSuccessResponse,
	createErrorResponse,
	createDeferredResponse,
	createEmbedResponse,
	createValidationErrorResponse,
	createInternalErrorResponse,
	serializeDiscordResponse,
	createDiscordHttpResponse,
	type DiscordEmbed,
	type DiscordInteractionResponse,
} from "../src/utils/discord-responses";

describe("Discord Response Helpers", () => {
	describe("createPongResponse", () => {
		it("should create a valid PONG response", () => {
			const response = createPongResponse();

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.PONG,
			});
		});
	});

	describe("createSuccessResponse", () => {
		it("should create a basic success response", () => {
			const content = "Operation completed successfully!";
			const response = createSuccessResponse(content);

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content,
					embeds: undefined,
					flags: undefined,
				},
			});
		});

		it("should create an ephemeral success response", () => {
			const content = "Private success message";
			const response = createSuccessResponse(content, { ephemeral: true });

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content,
					embeds: undefined,
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});

		it("should create a success response with embeds", () => {
			const content = "Success with embed";
			const embed: DiscordEmbed = {
				title: "Success",
				description: "Operation completed",
				color: 0x00ff00,
			};
			const response = createSuccessResponse(content, { embeds: [embed] });

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content,
					embeds: [embed],
					flags: undefined,
				},
			});
		});
	});

	describe("createErrorResponse", () => {
		it("should create a basic error response", () => {
			const error = "Something went wrong";
			const response = createErrorResponse(error);

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [
						{
							title: "Error",
							description: error,
							color: 0xff0000,
						},
					],
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});

		it("should create a public error response", () => {
			const error = "Public error message";
			const response = createErrorResponse(error, { ephemeral: false });

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [
						{
							title: "Error",
							description: error,
							color: 0xff0000,
						},
					],
					flags: undefined,
				},
			});
		});

		it("should create an error response with custom title", () => {
			const error = "Custom error";
			const title = "Custom Error Title";
			const response = createErrorResponse(error, { title });

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [
						{
							title,
							description: error,
							color: 0xff0000,
						},
					],
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});
	});

	describe("createDeferredResponse", () => {
		it("should create a basic deferred response", () => {
			const response = createDeferredResponse();

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					flags: undefined,
				},
			});
		});

		it("should create an ephemeral deferred response", () => {
			const response = createDeferredResponse(true);

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});
	});

	describe("createEmbedResponse", () => {
		it("should create a response with embed", () => {
			const embed: DiscordEmbed = {
				title: "Test Embed",
				description: "This is a test embed",
				color: 0x0099ff,
			};
			const response = createEmbedResponse(embed);

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: undefined,
					embeds: [embed],
					flags: undefined,
				},
			});
		});

		it("should create an ephemeral embed response with content", () => {
			const embed: DiscordEmbed = {
				title: "Private Embed",
				description: "This is private",
			};
			const content = "Additional content";
			const response = createEmbedResponse(embed, { ephemeral: true, content });

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content,
					embeds: [embed],
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});
	});

	describe("createValidationErrorResponse", () => {
		it("should create a validation error response", () => {
			const fieldName = "message";
			const message = "must be between 1 and 2000 characters";
			const response = createValidationErrorResponse(fieldName, message);

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [
						{
							title: "Validation Error",
							description: `Invalid ${fieldName}: ${message}`,
							color: 0xff0000,
						},
					],
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});
	});

	describe("createInternalErrorResponse", () => {
		it("should create an internal error response", () => {
			const response = createInternalErrorResponse();

			expect(response).toEqual({
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [
						{
							title: "Internal Error",
							description:
								"An internal error occurred. Please try again later.",
							color: 0xff0000,
						},
					],
					flags: DISCORD_MESSAGE_FLAGS.EPHEMERAL,
				},
			});
		});
	});

	describe("serializeDiscordResponse", () => {
		it("should serialize a valid response to JSON", () => {
			const response: DiscordInteractionResponse = {
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "Test message",
				},
			};

			const serialized = serializeDiscordResponse(response);
			const parsed = JSON.parse(serialized);

			expect(parsed).toEqual(response);
		});

		it("should throw error for invalid response structure", () => {
			const invalidResponse = {
				type: "invalid",
				data: {
					content: "Test",
				},
			} as any;

			expect(() => serializeDiscordResponse(invalidResponse)).toThrow();
		});

		it("should validate embed structure", () => {
			const response: DiscordInteractionResponse = {
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					embeds: [
						{
							title: "Valid Embed",
							description: "This is valid",
							color: 0x00ff00,
						},
					],
				},
			};

			const serialized = serializeDiscordResponse(response);
			expect(() => JSON.parse(serialized)).not.toThrow();
		});
	});

	describe("createDiscordHttpResponse", () => {
		it("should create a proper HTTP Response object", () => {
			const interactionResponse: DiscordInteractionResponse = {
				type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "Test response",
				},
			};

			const httpResponse = createDiscordHttpResponse(interactionResponse);

			expect(httpResponse.status).toBe(200);
			expect(httpResponse.headers.get("Content-Type")).toBe("application/json");
		});

		it("should create HTTP Response with custom status", () => {
			const interactionResponse = createErrorResponse("Test error");
			const httpResponse = createDiscordHttpResponse(interactionResponse, 400);

			expect(httpResponse.status).toBe(400);
			expect(httpResponse.headers.get("Content-Type")).toBe("application/json");
		});

		it("should contain valid JSON in response body", async () => {
			const interactionResponse = createSuccessResponse("Success message");
			const httpResponse = createDiscordHttpResponse(interactionResponse);

			const responseText = await httpResponse.text();
			const parsed = JSON.parse(responseText);

			expect(parsed.type).toBe(
				DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
			);
			expect(parsed.data.content).toBe("Success message");
		});
	});

	describe("Edge Cases and Validation", () => {
		it("should handle empty content in success response", () => {
			const response = createSuccessResponse("");

			expect(response.data?.content).toBe("");
		});

		it("should handle null content in success response", () => {
			const response = createSuccessResponse(null as any);

			expect(response.data?.content).toBeNull();
		});

		it("should handle undefined content in success response", () => {
			const response = createSuccessResponse(undefined as any);

			expect(response.data?.content).toBeUndefined();
		});

		it("should handle very long content", () => {
			const longContent = "a".repeat(2000);
			const response = createSuccessResponse(longContent);

			expect(response.data?.content).toBe(longContent);
		});

		it("should handle complex embed structures", () => {
			const complexEmbed: DiscordEmbed = {
				title: "Complex Embed",
				description: "This embed has many fields",
				color: 0x0099ff,
				author: {
					name: "Test Author",
					icon_url: "https://example.com/icon.png",
				},
				fields: [
					{ name: "Field 1", value: "Value 1", inline: true },
					{ name: "Field 2", value: "Value 2", inline: false },
				],
				footer: {
					text: "Footer text",
				},
				timestamp: new Date().toISOString(),
			};

			const response = createEmbedResponse(complexEmbed);
			const serialized = serializeDiscordResponse(response);

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it("should handle maximum embed limits", () => {
			const manyEmbeds: DiscordEmbed[] = Array(10)
				.fill(null)
				.map((_, i) => ({
					title: `Embed ${i + 1}`,
					description: `Description ${i + 1}`,
				}));

			const response = createSuccessResponse("Multiple embeds", {
				embeds: manyEmbeds,
			});
			const serialized = serializeDiscordResponse(response);

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it("should handle embed with maximum fields", () => {
			const maxFieldsEmbed: DiscordEmbed = {
				title: "Max Fields Embed",
				fields: Array(25)
					.fill(null)
					.map((_, i) => ({
						name: `Field ${i + 1}`,
						value: `Value ${i + 1}`,
					})),
			};

			const response = createEmbedResponse(maxFieldsEmbed);
			const serialized = serializeDiscordResponse(response);

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it("should handle embed with maximum title length", () => {
			const maxTitleEmbed: DiscordEmbed = {
				title: "a".repeat(256),
				description: "Valid description",
			};

			const response = createEmbedResponse(maxTitleEmbed);
			const serialized = serializeDiscordResponse(response);

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it("should handle embed with maximum description length", () => {
			const maxDescEmbed: DiscordEmbed = {
				title: "Valid title",
				description: "a".repeat(4096),
			};

			const response = createEmbedResponse(maxDescEmbed);
			const serialized = serializeDiscordResponse(response);

			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it("should handle all response flag combinations", () => {
			const ephemeralResponse = createSuccessResponse("Ephemeral", {
				ephemeral: true,
			});
			const publicResponse = createSuccessResponse("Public", {
				ephemeral: false,
			});
			const defaultResponse = createSuccessResponse("Default");

			expect(ephemeralResponse.data?.flags).toBe(
				DISCORD_MESSAGE_FLAGS.EPHEMERAL,
			);
			expect(publicResponse.data?.flags).toBeUndefined();
			expect(defaultResponse.data?.flags).toBeUndefined();
		});

		it("should handle invalid response type in serialization", () => {
			const invalidResponse = {
				type: "invalid-type",
				data: { content: "test" },
			} as any;

			expect(() => serializeDiscordResponse(invalidResponse)).toThrow();
		});

		it("should handle missing data field in response", () => {
			const responseWithoutData = {
				type: DISCORD_RESPONSE_TYPES.PONG,
			};

			const serialized = serializeDiscordResponse(responseWithoutData);
			expect(() => JSON.parse(serialized)).not.toThrow();
		});

		it("should handle HTTP response with custom headers", () => {
			const response = createSuccessResponse("Test");
			const httpResponse = createDiscordHttpResponse(response);

			expect(httpResponse.headers.get("Content-Type")).toBe("application/json");
		});

		it("should handle different HTTP status codes", () => {
			const response = createErrorResponse("Test error");

			const response200 = createDiscordHttpResponse(response, 200);
			const response400 = createDiscordHttpResponse(response, 400);
			const response500 = createDiscordHttpResponse(response, 500);

			expect(response200.status).toBe(200);
			expect(response400.status).toBe(400);
			expect(response500.status).toBe(500);
		});

		it("should handle special characters in error messages", () => {
			const specialCharsError =
				"Error with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?";
			const response = createErrorResponse(specialCharsError);

			expect(response.data?.embeds?.[0]?.description).toBe(specialCharsError);
		});

		it("should handle unicode characters in responses", () => {
			const unicodeContent = "🎉 Success! 世界 🌍";
			const response = createSuccessResponse(unicodeContent);

			expect(response.data?.content).toBe(unicodeContent);
		});

		it("should handle validation error with empty field name", () => {
			const response = createValidationErrorResponse("", "test message");

			expect(response.data?.embeds?.[0]?.description).toBe(
				"Invalid : test message",
			);
		});

		it("should handle validation error with empty message", () => {
			const response = createValidationErrorResponse("field", "");

			expect(response.data?.embeds?.[0]?.description).toBe("Invalid field: ");
		});
	});
});
