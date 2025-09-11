import { z } from "zod";
import { DISCORD_OPTION_TYPES } from "./discord";

// Tournament command parameter validation schemas

// Tournament open command - no parameters required
export const TournamentOpenSchema = z.object({});

// Tournament close command - no parameters required
export const TournamentCloseSchema = z.object({});

// ADR submission validation
export const SetAdrSchema = z.object({
	adr: z
		.number()
		.min(0, "ADR must be non-negative")
		.max(999.99, "ADR cannot exceed 999.99")
		.refine(
			(val) => Number.isFinite(val) && Number(val.toFixed(2)) === val,
			"ADR must have at most 2 decimal places",
		),
	player: z.string().optional(), // Discord user ID when admin submits for another player
	action: z.enum(["lock", "unlock"]).optional(), // Lock/unlock actions for admin
});

// Show ADR command - no parameters required
export const ShowAdrSchema = z.object({});

// Team generation command
export const GenerateTeamsSchema = z.object({
	action: z.enum(["lock", "unlock"]).optional(), // Lock/unlock team actions
	runs: z
		.number()
		.int("Optimization runs must be an integer")
		.min(1, "Must run at least 1 optimization")
		.max(200, "Cannot exceed 200 optimization runs")
		.optional()
		.default(200),
});

// Show teams command - no parameters required
export const ShowTeamsSchema = z.object({});

// Help command - no parameters required
export const HelpSchema = z.object({});

// Join tournament command
export const JoinTournamentSchema = z.object({
	player: z.string().optional(), // Discord user ID when admin joins player
});

// Leave tournament command (also covers admin remove)
export const LeaveTournamentSchema = z.object({
	player: z.string().optional(), // Discord user ID when admin removes player
});

// Exchange players command (admin only)
export const ExchangePlayersSchema = z.object({
	player1: z.string(), // Discord user ID of first player
	player2: z.string(), // Discord user ID of second player
});

// Add player to team command (admin only)
export const AddPlayerToTeamSchema = z.object({
	player: z.string(), // Discord user ID of the player to add
	team_id: z
		.string()
		.regex(
			/^[A-Z0-9]+$/,
			"Team ID must contain only uppercase letters and numbers (e.g., TEAM1, TEAM2)",
		),
});

// Match result command
export const ResultMatchSchema = z.object({
	match_string: z
		.string()
		.regex(
			/^[A-Z0-9]+-\d+-\d+-[A-Z0-9]+$/,
			"Match string must be in format TEAM1-score1-score2-TEAM2 (e.g., TEAM1-16-14-TEAM2)",
		),
});

// Discord interaction validation schemas for tournament commands

// Base tournament interaction schema
export const TournamentInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.string(),
				type: z.number(),
				options: z
					.array(
						z.object({
							name: z.string(),
							type: z.number(),
							value: z.union([z.string(), z.number(), z.boolean()]).optional(),
							user: z
								.object({
									id: z.string(),
									username: z.string(),
									discriminator: z.string().optional(),
									global_name: z.string().nullable().optional(),
								})
								.optional(), // For user mentions
						}),
					)
					.optional(),
				value: z.union([z.string(), z.number(), z.boolean()]).optional(),
			}),
		),
	}),
});

// Specific subcommand interaction schemas
export const TournamentOpenInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("open"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
			}),
		),
	}),
});

export const TournamentCloseInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("close"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
			}),
		),
	}),
});

export const SetAdrInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("set_adr"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z
					.array(
						z.object({
							name: z.string(),
							type: z.number(),
							value: z.union([z.string(), z.number(), z.boolean()]).optional(),
							user: z
								.object({
									id: z.string(),
									username: z.string(),
									discriminator: z.string().optional(),
									global_name: z.string().nullable().optional(),
								})
								.optional(),
						}),
					)
					.optional(),
			}),
		),
	}),
});

export const ShowAdrInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("show_adr"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
			}),
		),
	}),
});

export const GenerateTeamsInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("generate_teams"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z
					.array(
						z.object({
							name: z.string(),
							type: z.number(),
							value: z.union([z.string(), z.number(), z.boolean()]).optional(),
						}),
					)
					.optional(),
			}),
		),
	}),
});

export const ShowTeamsInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("show_teams"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
			}),
		),
	}),
});

export const JoinTournamentInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("join"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z
					.array(
						z.object({
							name: z.string(),
							type: z.number(),
							value: z.union([z.string(), z.number(), z.boolean()]).optional(),
							user: z
								.object({
									id: z.string(),
									username: z.string(),
									discriminator: z.string().optional(),
									global_name: z.string().nullable().optional(),
								})
								.optional(),
						}),
					)
					.optional(),
			}),
		),
	}),
});

export const LeaveTournamentInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.enum(["leave", "remove"]),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z
					.array(
						z.object({
							name: z.string(),
							type: z.number(),
							value: z.union([z.string(), z.number(), z.boolean()]).optional(),
							user: z
								.object({
									id: z.string(),
									username: z.string(),
									discriminator: z.string().optional(),
									global_name: z.string().nullable().optional(),
								})
								.optional(),
						}),
					)
					.optional(),
			}),
		),
	}),
});

export const ExchangePlayersInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("exchange"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z.array(
					z.object({
						name: z.enum(["player1", "player2"]),
						type: z.number(),
						value: z.union([z.string(), z.number(), z.boolean()]).optional(),
						user: z
							.object({
								id: z.string(),
								username: z.string(),
								discriminator: z.string().optional(),
								global_name: z.string().nullable().optional(),
							})
							.optional(),
					}),
				),
			}),
		),
	}),
});

export const AddPlayerToTeamInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("add"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z.array(
					z.object({
						name: z.enum(["player", "team_id"]),
						type: z.number(),
						value: z.union([z.string(), z.number(), z.boolean()]).optional(),
						user: z
							.object({
								id: z.string(),
								username: z.string(),
								discriminator: z.string().optional(),
								global_name: z.string().nullable().optional(),
							})
							.optional(),
					}),
				),
			}),
		),
	}),
});

export const ResultMatchInteractionSchema = z.object({
	data: z.object({
		name: z.literal("t"),
		options: z.array(
			z.object({
				name: z.literal("result"),
				type: z.literal(DISCORD_OPTION_TYPES.SUB_COMMAND),
				options: z.array(
					z.object({
						name: z.literal("match_string"),
						type: z.literal(DISCORD_OPTION_TYPES.STRING),
						value: z.string(),
					}),
				),
			}),
		),
	}),
});

// Parameter extraction and validation utilities

// Extract tournament subcommand from Discord interaction
export function extractTournamentSubcommand(
	interaction: z.infer<typeof TournamentInteractionSchema>,
): string {
	const subcommand = interaction.data.options[0];
	return subcommand.name;
}

// Extract ADR submission parameters
export function extractSetAdrParams(
	interaction: z.infer<typeof SetAdrInteractionSchema>,
): {
	adr?: number;
	player?: string;
	action?: "lock" | "unlock";
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const params: { adr?: number; player?: string; action?: "lock" | "unlock" } =
		{};

	for (const option of options) {
		switch (option.name) {
			case "adr":
				if (typeof option.value === "number") {
					params.adr = option.value;
				}
				break;
			case "player":
				if (option.user?.id) {
					params.player = option.user.id;
				} else if (typeof option.value === "string") {
					// Fallback to value if user object is not available (for testing)
					params.player = option.value;
				}
				break;
			case "action":
				if (
					typeof option.value === "string" &&
					(option.value === "lock" || option.value === "unlock")
				) {
					params.action = option.value;
				}
				break;
		}
	}

	return params;
}

// Extract team generation parameters
export function extractGenerateTeamsParams(
	interaction: z.infer<typeof GenerateTeamsInteractionSchema>,
): {
	action?: "lock" | "unlock";
	runs?: number;
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const params: { action?: "lock" | "unlock"; runs?: number } = {};

	for (const option of options) {
		switch (option.name) {
			case "action":
				if (
					typeof option.value === "string" &&
					(option.value === "lock" || option.value === "unlock")
				) {
					params.action = option.value;
				}
				break;
			case "runs":
				if (typeof option.value === "number") {
					params.runs = option.value;
				}
				break;
		}
	}

	return params;
}

// Extract join tournament parameters
export function extractJoinTournamentParams(
	interaction: z.infer<typeof JoinTournamentInteractionSchema>,
): {
	player?: string;
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const params: { player?: string } = {};

	for (const option of options) {
		if (option.name === "player") {
			if (option.user?.id) {
				params.player = option.user.id;
			} else if (typeof option.value === "string") {
				// Fallback to value if user object is not available (for testing)
				params.player = option.value;
			}
			break;
		}
	}

	return params;
}

// Extract leave tournament parameters
export function extractLeaveTournamentParams(
	interaction: z.infer<typeof LeaveTournamentInteractionSchema>,
): {
	player?: string;
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const params: { player?: string } = {};

	for (const option of options) {
		if (option.name === "player") {
			if (option.user?.id) {
				params.player = option.user.id;
			} else if (typeof option.value === "string") {
				// Fallback to value if user object is not available (for testing)
				params.player = option.value;
			}
			break;
		}
	}

	return params;
}

// Extract exchange players parameters
export function extractExchangePlayersParams(
	interaction: z.infer<typeof ExchangePlayersInteractionSchema>,
): {
	player1?: string;
	player2?: string;
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const params: { player1?: string; player2?: string } = {};

	for (const option of options) {
		if (option.name === "player1" || option.name === "player2") {
			if (option.user?.id) {
				params[option.name] = option.user.id;
			} else if (typeof option.value === "string") {
				// Fallback to value if user object is not available (for testing)
				params[option.name] = option.value;
			}
		}
	}

	return params;
}

// Extract add player to team parameters
export function extractAddPlayerToTeamParams(
	interaction: z.infer<typeof AddPlayerToTeamInteractionSchema>,
): {
	player?: string;
	team_id?: string;
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const params: { player?: string; team_id?: string } = {};

	for (const option of options) {
		if (option.name === "player") {
			if (option.user?.id) {
				params.player = option.user.id;
			} else if (typeof option.value === "string") {
				// Fallback to value if user object is not available (for testing)
				params.player = option.value;
			}
		} else if (option.name === "team_id") {
			if (typeof option.value === "string") {
				params.team_id = option.value;
			}
		}
	}

	return params;
}

// Extract match result parameters
export function extractResultMatchParams(
	interaction: z.infer<typeof ResultMatchInteractionSchema>,
): {
	match_string: string;
} {
	const subcommand = interaction.data.options[0];
	const options = subcommand.options || [];

	const matchStringOption = options.find((opt) => opt.name === "match_string");
	if (!matchStringOption || typeof matchStringOption.value !== "string") {
		throw new Error("Match string parameter is required");
	}

	return { match_string: matchStringOption.value };
}

// Parse match string into components
export function parseMatchString(matchString: string): {
	team1Id: string;
	score1: number;
	score2: number;
	team2Id: string;
} {
	const match = matchString.match(/^([A-Z0-9]+)-(\d+)-(\d+)-([A-Z0-9]+)$/);
	if (!match) {
		throw new Error(
			"Invalid match string format. Expected format: TEAM1-score1-score2-TEAM2",
		);
	}

	const [, team1Id, score1Str, score2Str, team2Id] = match;
	const score1 = parseInt(score1Str, 10);
	const score2 = parseInt(score2Str, 10);

	if (
		Number.isNaN(score1) ||
		Number.isNaN(score2) ||
		score1 < 0 ||
		score2 < 0
	) {
		throw new Error("Scores must be non-negative integers");
	}

	return { team1Id, score1, score2, team2Id };
}

// Validate tournament command parameters based on subcommand
export function validateTournamentCommandParams(
	subcommand: string,
	params: Record<string, unknown>,
): unknown {
	switch (subcommand) {
		case "open":
			return TournamentOpenSchema.parse(params);
		case "close":
			return TournamentCloseSchema.parse(params);
		case "set_adr":
			return SetAdrSchema.parse(params);
		case "show_adr":
			return ShowAdrSchema.parse(params);
		case "generate_teams":
			return GenerateTeamsSchema.parse(params);
		case "show_teams":
			return ShowTeamsSchema.parse(params);
		case "help":
			return HelpSchema.parse(params);
		case "join":
			return JoinTournamentSchema.parse(params);
		case "leave":
		case "remove":
			return LeaveTournamentSchema.parse(params);
		case "exchange":
			return ExchangePlayersSchema.parse(params);
		case "add":
			return AddPlayerToTeamSchema.parse(params);
		case "result":
			return ResultMatchSchema.parse(params);
		default:
			throw new Error(`Unknown tournament subcommand: ${subcommand}`);
	}
}

// Type exports
export type TournamentOpen = z.infer<typeof TournamentOpenSchema>;
export type TournamentClose = z.infer<typeof TournamentCloseSchema>;
export type SetAdr = z.infer<typeof SetAdrSchema>;
export type ShowAdr = z.infer<typeof ShowAdrSchema>;
export type GenerateTeams = z.infer<typeof GenerateTeamsSchema>;
export type ShowTeams = z.infer<typeof ShowTeamsSchema>;
export type Help = z.infer<typeof HelpSchema>;
export type JoinTournament = z.infer<typeof JoinTournamentSchema>;
export type LeaveTournament = z.infer<typeof LeaveTournamentSchema>;
export type ExchangePlayers = z.infer<typeof ExchangePlayersSchema>;
export type AddPlayerToTeam = z.infer<typeof AddPlayerToTeamSchema>;
export type ResultMatch = z.infer<typeof ResultMatchSchema>;

export type TournamentInteraction = z.infer<typeof TournamentInteractionSchema>;
export type TournamentOpenInteraction = z.infer<
	typeof TournamentOpenInteractionSchema
>;
export type TournamentCloseInteraction = z.infer<
	typeof TournamentCloseInteractionSchema
>;
export type SetAdrInteraction = z.infer<typeof SetAdrInteractionSchema>;
export type ShowAdrInteraction = z.infer<typeof ShowAdrInteractionSchema>;
export type GenerateTeamsInteraction = z.infer<
	typeof GenerateTeamsInteractionSchema
>;
export type ShowTeamsInteraction = z.infer<typeof ShowTeamsInteractionSchema>;
export type JoinTournamentInteraction = z.infer<
	typeof JoinTournamentInteractionSchema
>;
export type LeaveTournamentInteraction = z.infer<
	typeof LeaveTournamentInteractionSchema
>;
export type ExchangePlayersInteraction = z.infer<
	typeof ExchangePlayersInteractionSchema
>;
export type AddPlayerToTeamInteraction = z.infer<
	typeof AddPlayerToTeamInteractionSchema
>;
export type ResultMatchInteraction = z.infer<
	typeof ResultMatchInteractionSchema
>;
