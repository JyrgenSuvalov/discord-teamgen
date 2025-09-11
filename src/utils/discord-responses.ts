import { z } from "zod";

/**
 * Discord Interaction Response Types
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type
 */
export const DISCORD_RESPONSE_TYPES = {
	PONG: 1,
	CHANNEL_MESSAGE_WITH_SOURCE: 4,
	DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
	DEFERRED_UPDATE_MESSAGE: 6,
	UPDATE_MESSAGE: 7,
	APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
	MODAL: 9,
	PREMIUM_REQUIRED: 10,
} as const;

/**
 * Discord Message Flags
 * https://discord.com/developers/docs/resources/channel#message-object-message-flags
 */
export const DISCORD_MESSAGE_FLAGS = {
	CROSSPOSTED: 1 << 0,
	IS_CROSSPOST: 1 << 1,
	SUPPRESS_EMBEDS: 1 << 2,
	SOURCE_MESSAGE_DELETED: 1 << 3,
	URGENT: 1 << 4,
	HAS_THREAD: 1 << 5,
	EPHEMERAL: 1 << 6,
	LOADING: 1 << 7,
	FAILED_TO_MENTION_SOME_ROLES_IN_THREAD: 1 << 8,
	SUPPRESS_NOTIFICATIONS: 1 << 12,
	IS_VOICE_MESSAGE: 1 << 13,
} as const;

/**
 * Discord Embed Schema
 */
export const DiscordEmbedSchema = z.object({
	title: z.string().max(256).optional(),
	type: z.string().optional(),
	description: z.string().max(4096).optional(),
	url: z.string().optional(),
	timestamp: z.string().optional(),
	color: z.number().optional(),
	footer: z
		.object({
			text: z.string().max(2048),
			icon_url: z.string().optional(),
			proxy_icon_url: z.string().optional(),
		})
		.optional(),
	image: z
		.object({
			url: z.string(),
			proxy_url: z.string().optional(),
			height: z.number().optional(),
			width: z.number().optional(),
		})
		.optional(),
	thumbnail: z
		.object({
			url: z.string(),
			proxy_url: z.string().optional(),
			height: z.number().optional(),
			width: z.number().optional(),
		})
		.optional(),
	video: z
		.object({
			url: z.string().optional(),
			proxy_url: z.string().optional(),
			height: z.number().optional(),
			width: z.number().optional(),
		})
		.optional(),
	provider: z
		.object({
			name: z.string().optional(),
			url: z.string().optional(),
		})
		.optional(),
	author: z
		.object({
			name: z.string().max(256),
			url: z.string().optional(),
			icon_url: z.string().optional(),
			proxy_icon_url: z.string().optional(),
		})
		.optional(),
	fields: z
		.array(
			z.object({
				name: z.string().max(256),
				value: z.string().max(1024),
				inline: z.boolean().optional(),
			}),
		)
		.max(25)
		.optional(),
});

/**
 * Discord Message Data Schema
 */
export const DiscordMessageDataSchema = z.object({
	tts: z.boolean().optional(),
	content: z.string().max(2000).optional(),
	embeds: z.array(DiscordEmbedSchema).max(10).optional(),
	allowed_mentions: z
		.object({
			parse: z.array(z.enum(["roles", "users", "everyone"])).optional(),
			roles: z.array(z.string()).optional(),
			users: z.array(z.string()).optional(),
			replied_user: z.boolean().optional(),
		})
		.optional(),
	flags: z.number().optional(),
	components: z.array(z.any()).optional(), // Simplified for now
	attachments: z.array(z.any()).optional(), // Simplified for now
});

/**
 * Discord Interaction Response Schema
 */
export const DiscordInteractionResponseSchema = z.object({
	type: z.number(),
	data: DiscordMessageDataSchema.optional(),
});

// Type exports
export type DiscordEmbed = z.infer<typeof DiscordEmbedSchema>;
export type DiscordMessageData = z.infer<typeof DiscordMessageDataSchema>;
export type DiscordInteractionResponse = z.infer<
	typeof DiscordInteractionResponseSchema
>;

/**
 * Creates a PONG response for Discord ping interactions
 */
export function createPongResponse(): DiscordInteractionResponse {
	return {
		type: DISCORD_RESPONSE_TYPES.PONG,
	};
}

/**
 * Creates a success response with a message
 */
export function createSuccessResponse(
	content: string,
	options: {
		ephemeral?: boolean;
		embeds?: DiscordEmbed[];
	} = {},
): DiscordInteractionResponse {
	const flags = options.ephemeral ? DISCORD_MESSAGE_FLAGS.EPHEMERAL : undefined;

	return {
		type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content,
			embeds: options.embeds,
			flags,
		},
	};
}

/**
 * Creates an error response with a message
 */
export function createErrorResponse(
	error: string,
	options: {
		ephemeral?: boolean;
		title?: string;
	} = {},
): DiscordInteractionResponse {
	const { ephemeral = true, title = "Error" } = options;
	const flags = ephemeral ? DISCORD_MESSAGE_FLAGS.EPHEMERAL : undefined;

	const embed: DiscordEmbed = {
		title,
		description: error,
		color: 0xff0000, // Red color for errors
	};

	return {
		type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			embeds: [embed],
			flags,
		},
	};
}

/**
 * Creates a deferred response (for long-running operations)
 */
export function createDeferredResponse(
	ephemeral: boolean = false,
): DiscordInteractionResponse {
	const flags = ephemeral ? DISCORD_MESSAGE_FLAGS.EPHEMERAL : undefined;

	return {
		type: DISCORD_RESPONSE_TYPES.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			flags,
		},
	};
}

/**
 * Creates a response with an embed
 */
export function createEmbedResponse(
	embed: DiscordEmbed,
	options: {
		ephemeral?: boolean;
		content?: string;
	} = {},
): DiscordInteractionResponse {
	const flags = options.ephemeral ? DISCORD_MESSAGE_FLAGS.EPHEMERAL : undefined;

	return {
		type: DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content: options.content,
			embeds: [embed],
			flags,
		},
	};
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(
	fieldName: string,
	message: string,
): DiscordInteractionResponse {
	return createErrorResponse(`Invalid ${fieldName}: ${message}`, {
		title: "Validation Error",
	});
}

/**
 * Creates a generic internal error response
 */
export function createInternalErrorResponse(): DiscordInteractionResponse {
	return createErrorResponse(
		"An internal error occurred. Please try again later.",
		{ title: "Internal Error" },
	);
}

/**
 * Validates and serializes a Discord interaction response
 */
export function serializeDiscordResponse(
	response: DiscordInteractionResponse,
): string {
	// Validate the response structure
	const validatedResponse = DiscordInteractionResponseSchema.parse(response);

	// Serialize to JSON with proper formatting
	return JSON.stringify(validatedResponse);
}

/**
 * Creates a Response object with proper Discord headers
 */
export function createDiscordHttpResponse(
	interactionResponse: DiscordInteractionResponse,
	status: number = 200,
): Response {
	const serializedResponse = serializeDiscordResponse(interactionResponse);

	return new Response(serializedResponse, {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}
