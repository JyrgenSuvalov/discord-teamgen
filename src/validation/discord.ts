import { z } from "zod";

// Discord interaction types
export const DISCORD_INTERACTION_TYPES = {
	PING: 1,
	APPLICATION_COMMAND: 2,
	MESSAGE_COMPONENT: 3,
	APPLICATION_COMMAND_AUTOCOMPLETE: 4,
	MODAL_SUBMIT: 5,
} as const;

// Discord application command option types
export const DISCORD_OPTION_TYPES = {
	SUB_COMMAND: 1,
	SUB_COMMAND_GROUP: 2,
	STRING: 3,
	INTEGER: 4,
	BOOLEAN: 5,
	USER: 6,
	CHANNEL: 7,
	ROLE: 8,
	MENTIONABLE: 9,
	NUMBER: 10,
	ATTACHMENT: 11,
} as const;

// Discord user schema
export const DiscordUserSchema = z.object({
	id: z.string(),
	username: z.string(),
	discriminator: z.string().optional(),
	global_name: z.string().nullable().optional(),
	avatar: z.string().nullable().optional(),
	bot: z.boolean().optional(),
	system: z.boolean().optional(),
	mfa_enabled: z.boolean().optional(),
	banner: z.string().nullable().optional(),
	accent_color: z.number().nullable().optional(),
	locale: z.string().optional(),
	verified: z.boolean().optional(),
	email: z.string().nullable().optional(),
	flags: z.number().optional(),
	premium_type: z.number().optional(),
	public_flags: z.number().optional(),
});

// Define the type first for recursive reference
type DiscordCommandOptionType = {
	name: string;
	type: number;
	value?: string | number | boolean;
	options?: DiscordCommandOptionType[];
	focused?: boolean;
};

// Discord application command option schema
export const DiscordCommandOptionSchema: z.ZodType<DiscordCommandOptionType> =
	z.object({
		name: z.string(),
		type: z.number(),
		value: z.union([z.string(), z.number(), z.boolean()]).optional(),
		options: z.array(z.lazy(() => DiscordCommandOptionSchema)).optional(),
		focused: z.boolean().optional(),
	});

// Discord application command data schema
export const DiscordCommandDataSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.number().optional(),
	resolved: z.record(z.string(), z.any()).optional(),
	options: z.array(DiscordCommandOptionSchema).optional(),
	guild_id: z.string().optional(),
	target_id: z.string().optional(),
});

// Discord guild member schema
export const DiscordGuildMemberSchema = z.object({
	user: DiscordUserSchema.optional(),
	nick: z.string().nullable().optional(),
	avatar: z.string().nullable().optional(),
	roles: z.array(z.string()),
	joined_at: z.string(),
	premium_since: z.string().nullable().optional(),
	deaf: z.boolean().optional(),
	mute: z.boolean().optional(),
	flags: z.number().optional(),
	pending: z.boolean().optional(),
	permissions: z.string().optional(),
	communication_disabled_until: z.string().nullable().optional(),
});

// Main Discord interaction schema
export const DiscordInteractionSchema = z.object({
	id: z.string(),
	application_id: z.string(),
	type: z.number(),
	data: DiscordCommandDataSchema.optional(),
	guild_id: z.string().optional(),
	channel_id: z.string().optional(),
	member: DiscordGuildMemberSchema.optional(),
	user: DiscordUserSchema.optional(),
	token: z.string(),
	version: z.number(),
	message: z.record(z.string(), z.any()).optional(),
	app_permissions: z.string().optional(),
	locale: z.string().optional(),
	guild_locale: z.string().optional(),
});

// Type exports
export type DiscordUser = z.infer<typeof DiscordUserSchema>;
export type DiscordCommandOption = z.infer<typeof DiscordCommandOptionSchema>;
export type DiscordCommandData = z.infer<typeof DiscordCommandDataSchema>;
export type DiscordGuildMember = z.infer<typeof DiscordGuildMemberSchema>;
export type DiscordInteraction = z.infer<typeof DiscordInteractionSchema>;
