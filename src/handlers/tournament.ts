import type { Context } from "hono";
import { z } from "zod";
import { createDatabase } from "../db";
import { DatabaseError, type Env, ValidationError } from "../db/types";
import {
	MatchRepository,
	PlayerRepository,
	TeamRepository,
	TournamentRepository,
} from "../db/utils";
import { PermissionError, PermissionService } from "../services/permission";
import {
	TeamGenerationError,
	TeamGenerationService,
} from "../services/team-generation";
import { TournamentError, TournamentService } from "../services/tournament";
import { getDiscordBody } from "../utils/discord-middleware";
import {
	createDiscordHttpResponse,
	createErrorResponse,
	createInternalErrorResponse,
	createPongResponse,
	createSuccessResponse,
	createValidationErrorResponse,
	type DiscordInteractionResponse,
} from "../utils/discord-responses";
import {
	DISCORD_INTERACTION_TYPES,
	type DiscordInteraction,
	DiscordInteractionSchema,
} from "../validation/discord";
import {
	extractAddPlayerToTeamParams,
	extractExchangePlayersParams,
	extractGenerateTeamsParams,
	extractJoinTournamentParams,
	extractLeaveTournamentParams,
	extractResultMatchParams,
	extractSetAdrParams,
	extractTournamentSubcommand,
	type GenerateTeams,
	parseMatchString,
	type ResultMatch,
	type SetAdr,
	TournamentInteractionSchema,
	validateTournamentCommandParams,
} from "../validation/tournament";

/**
 * Handles the tournament command interaction
 */
export async function handleTournamentCommand(
	c: Context<{
		Bindings: Env;
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction body has complex nested structure
		Variables: { requestId: string; discordBody?: any };
	}>,
): Promise<Response> {
	try {
		// Get the validated Discord interaction from middleware
		const body = getDiscordBody(c);
		const interaction = DiscordInteractionSchema.parse(body);

		// Handle Discord ping (type 1)
		if (interaction.type === DISCORD_INTERACTION_TYPES.PING) {
			const pongResponse = createPongResponse();
			return new Response(JSON.stringify(pongResponse), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Handle application command (type 2)
		if (interaction.type === DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND) {
			// Validate this is a tournament command
			const tournamentInteraction =
				TournamentInteractionSchema.parse(interaction);

			// Extract subcommand
			const subcommand = extractTournamentSubcommand(tournamentInteraction);

			// Get user information (prefer member.user over user)
			const user = interaction.member?.user || interaction.user;
			if (!user) {
				return new Response(
					JSON.stringify(createErrorResponse("User information not available")),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}

			// Set up database connection and repositories
			const db = createDatabase(c.env.DB);
			const tournamentRepo = new TournamentRepository(db);
			const playerRepo = new PlayerRepository(db);
			const teamRepo = new TeamRepository(db);
			const matchRepo = new MatchRepository(db);

			// Set up services
			const teamGenService = new TeamGenerationService();
			const permissionService = PermissionService.fromEnvironment(c.env);
			const tournamentService = new TournamentService(
				tournamentRepo,
				playerRepo,
				teamRepo,
				matchRepo,
				teamGenService,
				permissionService,
				c.env.TOURNAMENT_TIMEZONE || "UTC",
			);

			// Route to appropriate subcommand handler
			let response: DiscordInteractionResponse;

			switch (subcommand) {
				case "open":
					response = await handleTournamentOpen(
						tournamentService,
						permissionService,
						interaction,
					);
					break;
				case "close":
					response = await handleTournamentClose(
						tournamentService,
						permissionService,
						interaction,
					);
					break;
				case "set_adr":
					response = await handleSubmitAdr(
						tournamentService,
						permissionService,
						interaction,
						user,
					);
					break;
				case "show_adr":
					response = await handleShowAdr(tournamentService, interaction);
					break;
				case "generate_teams":
					response = await handleGenerateTeams(
						tournamentService,
						permissionService,
						interaction,
					);
					break;
				case "show_teams":
					response = await handleShowTeams(tournamentService, interaction);
					break;
				case "help":
					response = await handleHelp();
					break;
				case "join":
					response = await handleJoinTournament(
						tournamentService,
						permissionService,
						interaction,
						user,
					);
					break;
				case "leave":
					response = await handleLeaveTournament(
						tournamentService,
						permissionService,
						interaction,
						user,
					);
					break;
				case "remove":
					response = await handleRemovePlayer(
						tournamentService,
						permissionService,
						interaction,
						user,
					);
					break;
				case "exchange":
					response = await handleExchangePlayers(
						tournamentService,
						permissionService,
						interaction,
						user,
					);
					break;
				case "add":
					response = await handleAddPlayerToTeam(
						tournamentService,
						permissionService,
						interaction,
						user,
					);
					break;
				case "result":
					response = await handleResultMatch(
						tournamentService,
						permissionService,
						interaction,
					);
					break;
				default:
					return new Response(
						JSON.stringify(
							createErrorResponse(
								`Unknown tournament subcommand: ${subcommand}`,
							),
						),
						{ status: 400, headers: { "Content-Type": "application/json" } },
					);
			}

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Unknown interaction type
		return new Response(
			JSON.stringify(createErrorResponse("Unknown interaction type")),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Error handling tournament command:", error);
		console.error(
			"Error stack:",
			error instanceof Error ? error.stack : "No stack trace",
		);

		// Handle validation errors
		if (error instanceof z.ZodError) {
			console.error(
				"Zod validation error:",
				JSON.stringify(error.issues, null, 2),
			);
			const firstError = error.issues[0];
			const errorResponse = createValidationErrorResponse(
				firstError.path.join(".") || "input",
				firstError.message,
			);
			return createDiscordHttpResponse(errorResponse);
		}

		// Handle custom validation errors
		if (error instanceof ValidationError) {
			const errorResponse = createValidationErrorResponse(
				error.field || "input",
				error.message,
			);
			return createDiscordHttpResponse(errorResponse);
		}

		// Handle tournament-specific errors
		if (error instanceof TournamentError) {
			const errorResponse = createErrorResponse(error.message, {
				title: "Tournament Error",
			});
			return createDiscordHttpResponse(errorResponse);
		}

		// Handle team generation errors
		if (error instanceof TeamGenerationError) {
			const errorResponse = createErrorResponse(error.message, {
				title: "Team Generation Error",
			});
			return createDiscordHttpResponse(errorResponse);
		}

		// Handle permission errors
		if (error instanceof PermissionError) {
			const errorResponse = createErrorResponse(error.message, {
				title: "Access Denied",
			});
			return createDiscordHttpResponse(errorResponse);
		}

		// Handle database errors
		if (
			error instanceof DatabaseError ||
			(error instanceof Error && error.message.includes("Database"))
		) {
			console.error("Database error:", error);
			const errorResponse = createErrorResponse(
				"Database operation failed. Please try again later.",
				{ title: "Database Error" },
			);
			return createDiscordHttpResponse(errorResponse);
		}

		// Handle unexpected errors
		const internalErrorResponse = createInternalErrorResponse();
		return createDiscordHttpResponse(internalErrorResponse);
	}
}

// Tournament Lifecycle Command Handlers

/**
 * Handle tournament open command
 */
async function handleTournamentOpen(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Open the tournament
	const tournament = await tournamentService.openTournament();

	return createSuccessResponse(
		`🏆 **Tournament ${tournament.id} is now open!**\n\n` +
			`Players can now join using \`/t join\` and submit their ADR using \`/t set_adr <adr>\`\n` +
			`Use \`/t show_adr\` to see current submissions.`,
		{ ephemeral: false },
	);
}

/**
 * Handle tournament close command
 */
async function handleTournamentClose(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Close the tournament
	const tournament = await tournamentService.closeTournament();

	return createSuccessResponse(
		`🏁 **Tournament ${tournament.id} has been closed.**\n\n` +
			`All tournament commands are now disabled except admin commands.`,
		{ ephemeral: false },
	);
}

// ADR Management Command Handlers

/**
 * Handle submit ADR command
 */
async function handleSubmitAdr(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
	user: { id: string; username: string; global_name?: string | null },
): Promise<DiscordInteractionResponse> {
	// Extract parameters from interaction
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractSetAdrParams(interaction as any);

	// Validate parameters based on whether this is admin or player submission
	const isAdminSubmission = params.player !== undefined;
	const isLockAction = params.action === "lock" || params.action === "unlock";

	// Admin-only actions require permission check
	if (isAdminSubmission || isLockAction) {
		await permissionService.requireAdminPermission(interaction);
	}

	// Handle different ADR submission scenarios
	if (params.action === "lock" && params.player && params.adr === undefined) {
		// Admin locking a player's ADR (without submitting new ADR)
		await tournamentService.lockPlayerAdr(user.id, params.player);

		return createSuccessResponse(
			`🔒 **ADR locked** for <@${params.player}>\n\n` +
				`They can no longer change their ADR unless unlocked by an admin.`,
			{ ephemeral: false },
		);
	}

	if (params.action === "unlock" && params.player && params.adr === undefined) {
		// Admin unlocking a player's ADR (without submitting new ADR)
		await tournamentService.unlockPlayerAdr(user.id, params.player);

		return createSuccessResponse(
			`🔓 **ADR unlocked** for <@${params.player}>\n\n` +
				`They can now update their ADR again.`,
			{ ephemeral: false },
		);
	}

	if (params.player && params.adr !== undefined) {
		// Admin submitting ADR for another player
		// Extract user info from the interaction options
		const subcommandOptions = interaction.data?.options?.[0]?.options || [];
		const playerOption = subcommandOptions.find((opt) => opt.name === "player");
		// biome-ignore lint/suspicious/noExplicitAny: Discord option structure requires casting for user access
		let targetUser = (playerOption as any)?.user;

		// If user is not in the option, check resolved users
		if (
			!targetUser &&
			params.player &&
			// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
			(interaction.data as any)?.resolved?.users
		) {
			// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
			targetUser = (interaction.data as any).resolved.users[params.player];
		}

		if (!targetUser) {
			throw new ValidationError("Player information not available", "player");
		}

		const shouldLock = params.action === "lock";

		await tournamentService.submitAdminAdr(
			user.id,
			params.player,
			targetUser.username,
			targetUser.global_name || undefined,
			params.adr,
			shouldLock,
		);

		const lockText = shouldLock ? " and **locked**" : "";
		return createSuccessResponse(
			`✅ **ADR submitted${lockText}** for <@${params.player}>: \`${params.adr}\`\n\n` +
				`Use \`/tournament show_adr\` to see all current submissions.`,
			{ ephemeral: false },
		);
	}

	if (params.adr !== undefined) {
		// Player submitting their own ADR
		const validatedParams = validateTournamentCommandParams(
			"set_adr",
			params,
		) as SetAdr;

		await tournamentService.submitPlayerAdr(
			user.id,
			user.username,
			user.global_name || undefined,
			validatedParams.adr,
		);

		return createSuccessResponse(
			`✅ **Your ADR has been submitted:** \`${params.adr}\`\n\n` +
				`Use \`/tournament show_adr\` to see all current submissions.`,
			{ ephemeral: true },
		);
	}

	// Invalid parameter combination
	throw new ValidationError(
		"Invalid parameter combination for ADR submission",
		"parameters",
	);
}

/**
 * Handle show ADR command
 */
async function handleShowAdr(
	tournamentService: TournamentService,
	_interaction: DiscordInteraction,
): Promise<DiscordInteractionResponse> {
	// Get all player ADRs
	const playerAdrs = await tournamentService.getPlayerAdrs();

	if (playerAdrs.length === 0) {
		return createSuccessResponse(
			`📊 **No players have joined the tournament yet.**\n\n` +
				`Players can submit their ADR using \`/tournament set_adr <adr>\``,
			{ ephemeral: false },
		);
	}

	// Sort players by status (submitted first) then by username
	const sortedPlayers = playerAdrs.sort((a, b) => {
		if (a.status !== b.status) {
			return a.status === "submitted" ? -1 : 1;
		}
		return a.username.localeCompare(b.username);
	});

	// Build the response message
	let message = `📊 **Tournament ADR Status** (${playerAdrs.length} players)\n\n`;

	const submittedPlayers = sortedPlayers.filter(
		(p) => p.status === "submitted",
	);
	const pendingPlayers = sortedPlayers.filter((p) => p.status === "pending");

	if (submittedPlayers.length > 0) {
		message += `**✅ Submitted (${submittedPlayers.length}):**\n`;
		for (const player of submittedPlayers) {
			const displayName = player.display_name || player.username;
			const lockIcon = player.adr_locked ? "🔒" : "";
			message += `• ${displayName}: \`${player.adr}\` ${lockIcon}\n`;
		}
		message += "\n";
	}

	if (pendingPlayers.length > 0) {
		message += `**⏳ Pending (${pendingPlayers.length}):**\n`;
		for (const player of pendingPlayers) {
			const displayName = player.display_name || player.username;
			message += `• ${displayName}: *(pending)*\n`;
		}
	}

	return createSuccessResponse(message, { ephemeral: false });
}

// Team Management Command Handlers

/**
 * Handle generate teams command
 */
async function handleGenerateTeams(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Extract parameters
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractGenerateTeamsParams(interaction as any);

	// Handle lock/unlock actions
	if (params.action === "lock") {
		await tournamentService.lockTeams();

		return createSuccessResponse(
			`🔒 **Teams have been locked.**\n\n` +
				`Teams cannot be regenerated until unlocked. Use \`/tournament generate_teams unlock\` to unlock.`,
			{ ephemeral: false },
		);
	}

	if (params.action === "unlock") {
		await tournamentService.unlockTeams();

		return createSuccessResponse(
			`🔓 **Teams have been unlocked.**\n\n` +
				`Teams can now be regenerated using \`/tournament generate_teams\`.`,
			{ ephemeral: false },
		);
	}

	// Generate teams
	const validatedParams = validateTournamentCommandParams(
		"generate_teams",
		params,
	);
	const runs = (validatedParams as GenerateTeams).runs || 500;

	const teams = await tournamentService.generateTeams(runs);

	// Build response message
	let message = `🎯 **Teams Generated!** (${runs} optimization runs)\n\n`;

	for (const team of teams) {
		message += `**${team.id}** (Avg ADR: \`${team.average_adr.toFixed(2)}\`):\n`;
		for (const player of team.players) {
			const displayName = player.display_name || player.username;
			message += `• ${displayName} (\`${player.adr}\`)\n`;
		}
		message += "\n";
	}

	message += `Use \`/tournament generate_teams lock\` to lock teams and prevent regeneration.`;

	return createSuccessResponse(message, { ephemeral: false });
}

/**
 * Handle show teams command
 */
async function handleShowTeams(
	tournamentService: TournamentService,
	_interaction: DiscordInteraction,
): Promise<DiscordInteractionResponse> {
	// Check if teams exist
	const teamsExist = await tournamentService.teamsExist();

	if (!teamsExist) {
		return createSuccessResponse(
			`🎯 **No teams have been generated yet.**\n\n` +
				`Admins can generate teams using \`/tournament generate_teams\` once all players have submitted their ADRs.`,
			{ ephemeral: false },
		);
	}

	// Get teams
	const teams = await tournamentService.getTeams();
	const teamsLocked = await tournamentService.areTeamsLocked();

	// Build response message
	let message = `🎯 **Current Teams** ${teamsLocked ? "🔒" : "🔓"}\n\n`;

	for (const team of teams) {
		message += `**${team.team_id}** (Avg ADR: \`${team.average_adr.toFixed(2)}\`):\n`;
		for (const player of team.players) {
			const displayName = player.display_name || player.username;
			message += `• ${displayName} (\`${player.adr || "N/A"}\`)\n`;
		}
		message += "\n";
	}

	if (teamsLocked) {
		message += `🔒 Teams are **locked** and cannot be regenerated.`;
	} else {
		message += `🔓 Teams can be regenerated using \`/tournament generate_teams\`.`;
	}

	return createSuccessResponse(message, { ephemeral: false });
}

// Match Management Command Handlers

/**
 * Handle result match command
 */
async function handleResultMatch(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Extract and validate match string
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractResultMatchParams(interaction as any);
	const validatedParams = validateTournamentCommandParams("result", params);
	const matchString = (validatedParams as ResultMatch).match_string;

	// Parse match string to validate format
	const matchData = parseMatchString(matchString);

	// Record the match
	const matchResult = await tournamentService.recordMatch(matchString);

	// Determine winner
	let resultText: string;
	if (matchResult.score1 > matchResult.score2) {
		resultText = `🏆 **${matchData.team1Id}** defeats **${matchData.team2Id}**`;
	} else if (matchResult.score2 > matchResult.score1) {
		resultText = `🏆 **${matchData.team2Id}** defeats **${matchData.team1Id}**`;
	} else {
		resultText = `🤝 **${matchData.team1Id}** ties with **${matchData.team2Id}**`;
	}

	return createSuccessResponse(
		`⚽ **Match Result Recorded**\n\n` +
			`${resultText}\n` +
			`**Score:** ${matchData.team1Id} ${matchResult.score1} - ${matchResult.score2} ${matchData.team2Id}\n\n` +
			`Match ID: \`${matchResult.match_id}\``,
		{ ephemeral: false },
	);
}

// Join/Leave Tournament Command Handlers

/**
 * Handle join tournament command
 */
async function handleJoinTournament(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
	user: { id: string; username: string; global_name?: string | null },
): Promise<DiscordInteractionResponse> {
	// Extract parameters from interaction
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractJoinTournamentParams(interaction as any);

	// Debug logging for admin join actions
	if (params.player) {
		console.log("Admin join debug - interaction data:", {
			hasData: !!interaction.data,
			hasOptions: !!interaction.data?.options,
			subcommand: interaction.data?.options?.[0]?.name,
			hasSubcommandOptions: !!interaction.data?.options?.[0]?.options,
			subcommandOptions: JSON.stringify(
				interaction.data?.options?.[0]?.options || [],
				null,
				2,
			),
			// biome-ignore lint/suspicious/noExplicitAny: Discord resolved data structure
			hasResolved: !!(interaction.data as any)?.resolved,
			resolvedUsers: Object.keys(
				// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
				(interaction.data as any)?.resolved?.users || {},
			),
			playerParam: params.player,
		});
	}

	// Check if this is an admin action (joining another player)
	const isAdminAction = !!params.player;
	let targetPlayerId: string;
	let targetUsername: string;
	let targetDisplayName: string | undefined;

	if (isAdminAction) {
		// Admin joining another player - check permissions
		await permissionService.requireAdminPermission(interaction);

		// Extract target user info from the interaction options
		const subcommandOptions = interaction.data?.options?.[0]?.options || [];
		const playerOption = subcommandOptions.find((opt) => opt.name === "player");
		// biome-ignore lint/suspicious/noExplicitAny: Discord option structure requires casting for user access
		let targetUser = (playerOption as any)?.user;

		// If user is not in the option, check resolved users
		if (
			!targetUser &&
			params.player &&
			// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
			(interaction.data as any)?.resolved?.users
		) {
			// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
			targetUser = (interaction.data as any).resolved.users[params.player];
		}

		if (!targetUser) {
			return createErrorResponse("Player information not found in request", {
				title: "Invalid Request",
			});
		}

		targetPlayerId = targetUser.id;
		targetUsername = targetUser.username;
		targetDisplayName = targetUser.global_name || undefined;
	} else {
		// Player joining themselves
		targetPlayerId = user.id;
		targetUsername = user.username;
		targetDisplayName = user.global_name || undefined;
	}

	try {
		// Check if player is already in tournament before joining
		const wasAlreadyInTournament =
			await tournamentService.isPlayerInTournament(targetPlayerId);

		// Join tournament (idempotent operation)
		await tournamentService.joinTournament(
			user.id, // requesting user
			targetUsername,
			targetDisplayName,
			isAdminAction,
			targetPlayerId,
		);

		// Create appropriate response message
		let message: string;
		if (isAdminAction) {
			if (wasAlreadyInTournament) {
				message = `👥 <@${targetPlayerId}> was already in the tournament.`;
			} else {
				message =
					`✅ **<@${targetPlayerId}> has joined the tournament!**\n\n` +
					`They can now submit their ADR using \`/t set_adr <adr>\``;
			}
		} else {
			if (wasAlreadyInTournament) {
				message =
					`👥 **You're already in the tournament!**\n\n` +
					`Submit your ADR using \`/t set_adr <adr>\` or view current submissions with \`/t show_adr\``;
			} else {
				message =
					`🎉 **Welcome to the tournament!**\n\n` +
					`Submit your ADR using \`/t set_adr <adr>\`\n` +
					`View all submissions with \`/t show_adr\``;
			}
		}

		return createSuccessResponse(message, { ephemeral: !isAdminAction });
	} catch (error) {
		if (error instanceof TournamentError) {
			return createErrorResponse(error.message, { title: "Tournament Error" });
		}
		if (error instanceof PermissionError) {
			return createErrorResponse(error.message, { title: "Permission Denied" });
		}
		throw error;
	}
}

/**
 * Handle leave tournament command
 */
async function handleLeaveTournament(
	tournamentService: TournamentService,
	_permissionService: PermissionService,
	_interaction: DiscordInteraction,
	user: { id: string; username: string; global_name?: string | null },
): Promise<DiscordInteractionResponse> {
	try {
		// Player leaving themselves
		const wasRemoved = await tournamentService.leaveTournament(user.id);

		if (wasRemoved) {
			return createSuccessResponse(
				`👋 **You have left the tournament.**\n\n` +
					`You can rejoin anytime using \`/t join\``,
				{ ephemeral: true },
			);
		} else {
			return createSuccessResponse(
				`ℹ️ **You weren't in the tournament.**\n\n` +
					`Use \`/t join\` to join the current tournament.`,
				{ ephemeral: true },
			);
		}
	} catch (error) {
		if (error instanceof TournamentError) {
			return createErrorResponse(error.message, { title: "Tournament Error" });
		}
		throw error;
	}
}

/**
 * Handle admin remove player command
 */
async function handleRemovePlayer(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
	user: { id: string; username: string; global_name?: string | null },
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Extract parameters from interaction
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractLeaveTournamentParams(interaction as any);

	if (!params.player) {
		return createErrorResponse(
			"Player parameter is required for remove command",
			{ title: "Invalid Request" },
		);
	}

	// Extract target user info from the interaction options
	const subcommandOptions = interaction.data?.options?.[0]?.options || [];
	const playerOption = subcommandOptions.find((opt) => opt.name === "player");
	// biome-ignore lint/suspicious/noExplicitAny: Discord option structure requires casting for user access
	let targetUser = (playerOption as any)?.user;

	// If user is not in the option, check resolved users
	if (
		!targetUser &&
		params.player &&
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
		(interaction.data as any)?.resolved?.users
	) {
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
		targetUser = (interaction.data as any).resolved.users[params.player];
	}

	if (!targetUser) {
		return createErrorResponse("Player information not found in request", {
			title: "Invalid Request",
		});
	}

	const targetPlayerId = targetUser.id;

	try {
		// Remove player from tournament
		const wasRemoved = await tournamentService.leaveTournament(
			user.id,
			true,
			targetPlayerId,
		);

		if (wasRemoved) {
			return createSuccessResponse(
				`🗑️ **<@${targetPlayerId}> has been removed from the tournament.**`,
				{ ephemeral: false },
			);
		} else {
			return createSuccessResponse(
				`ℹ️ **<@${targetPlayerId}> wasn't in the tournament.**`,
				{ ephemeral: false },
			);
		}
	} catch (error) {
		if (error instanceof TournamentError) {
			return createErrorResponse(error.message, { title: "Tournament Error" });
		}
		if (error instanceof PermissionError) {
			return createErrorResponse(error.message, { title: "Permission Denied" });
		}
		throw error;
	}
}

/**
 * Handle exchange players command (admin only)
 */
async function handleExchangePlayers(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
	user: { id: string; username: string; global_name?: string | null },
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Extract parameters from interaction
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractExchangePlayersParams(interaction as any);

	if (!params.player1 || !params.player2) {
		return createErrorResponse(
			"Both player1 and player2 parameters are required",
			{ title: "Invalid Request" },
		);
	}

	// Extract player info from the interaction
	const subcommandOptions = interaction.data?.options?.[0]?.options || [];
	const player1Option = subcommandOptions.find((opt) => opt.name === "player1");
	const player2Option = subcommandOptions.find((opt) => opt.name === "player2");

	// biome-ignore lint/suspicious/noExplicitAny: Discord option structure requires casting for user access
	let player1User = (player1Option as any)?.user;
	// biome-ignore lint/suspicious/noExplicitAny: Discord option structure requires casting for user access
	let player2User = (player2Option as any)?.user;

	// If users are not in options, check resolved users
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
	const resolvedUsers = (interaction.data as any)?.resolved?.users;
	if (!player1User && params.player1 && resolvedUsers) {
		player1User = resolvedUsers[params.player1];
	}
	if (!player2User && params.player2 && resolvedUsers) {
		player2User = resolvedUsers[params.player2];
	}

	if (!player1User || !player2User) {
		return createErrorResponse("Player information not found in request", {
			title: "Invalid Request",
		});
	}

	const player1Id = player1User.id;
	const player2Id = player2User.id;

	try {
		// Exchange players between teams
		const result = await tournamentService.exchangePlayers(
			user.id,
			player1Id,
			player2Id,
		);

		return createSuccessResponse(
			`🔄 **Players exchanged successfully!**\n\n` +
				`<@${player1Id}> moved from **${result.player1Team}** to **${result.player2Team}**\n` +
				`<@${player2Id}> moved from **${result.player2Team}** to **${result.player1Team}**`,
			{ ephemeral: false },
		);
	} catch (error) {
		if (error instanceof TournamentError) {
			return createErrorResponse(error.message, { title: "Exchange Failed" });
		}
		if (error instanceof PermissionError) {
			return createErrorResponse(error.message, { title: "Permission Denied" });
		}
		throw error;
	}
}

/**
 * Handle add player to team command (admin only)
 */
async function handleAddPlayerToTeam(
	tournamentService: TournamentService,
	permissionService: PermissionService,
	interaction: DiscordInteraction,
	user: { id: string; username: string; global_name?: string | null },
): Promise<DiscordInteractionResponse> {
	// Check admin permissions
	await permissionService.requireAdminPermission(interaction);

	// Extract parameters from interaction
	// biome-ignore lint/suspicious/noExplicitAny: Discord interaction type is complex, cast needed for parameter extraction
	const params = extractAddPlayerToTeamParams(interaction as any);

	if (!params.player || !params.team_id) {
		return createErrorResponse(
			"Both player and team_id parameters are required",
			{ title: "Invalid Request" },
		);
	}

	// Extract target user info from the interaction options
	const subcommandOptions = interaction.data?.options?.[0]?.options || [];
	const playerOption = subcommandOptions.find((opt) => opt.name === "player");
	// biome-ignore lint/suspicious/noExplicitAny: Discord option structure requires casting for user access
	let targetUser = (playerOption as any)?.user;

	// If user is not in the option, check resolved users
	if (
		!targetUser &&
		params.player &&
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
		(interaction.data as any)?.resolved?.users
	) {
		// biome-ignore lint/suspicious/noExplicitAny: Discord interaction data structure requires casting for resolved users
		targetUser = (interaction.data as any).resolved.users[params.player];
	}

	if (!targetUser) {
		return createErrorResponse("Player information not found in request", {
			title: "Invalid Request",
		});
	}

	const targetPlayerId = targetUser.id;

	try {
		// Add player to team
		await tournamentService.addPlayerToTeam(
			user.id,
			targetPlayerId,
			params.team_id,
		);

		return createSuccessResponse(
			`➕ **Player added to team successfully!**\n\n` +
				`<@${targetPlayerId}> has been added to **${params.team_id}**`,
			{ ephemeral: false },
		);
	} catch (error) {
		if (error instanceof TournamentError) {
			return createErrorResponse(error.message, { title: "Add Player Failed" });
		}
		if (error instanceof PermissionError) {
			return createErrorResponse(error.message, { title: "Permission Denied" });
		}
		throw error;
	}
}

/**
 * Handle help command - show available tournament commands
 */
async function handleHelp(): Promise<DiscordInteractionResponse> {
	const helpText = `
## 🏆 **CS2 Tournament Commands**

### **Tournament Management**
• \`/t open\` - Open a new tournament *(Admin)*
• \`/t close\` - Close current tournament *(Admin)*
• \`/t help\` - Show this help message

### **Player Management**
• \`/t join\` - Join the current tournament
• \`/t leave\` - Leave the current tournament
• \`/t remove @player\` - Remove a player *(Admin)*

### **ADR & Team Setup**
• \`/t set_adr 85.5\` - Submit your ADR
• \`/t show_adr\` - View all player ADRs
• \`/t generate_teams\` - Create balanced teams *(Admin)*
• \`/t show_teams\` - View current teams

### **Team Management** *(Admin)*
• \`/t add @player TEAM1\` - Add player to specific team
• \`/t exchange @player1 @player2\` - Swap players between teams

### **Match Recording** *(Admin)*
• \`/t result TEAM1-16-14-TEAM2\` - Record match result

### **Finding your ADR**
One way to find your ADR is to log into popflash.site, click on your username in the top right corner and select My Profile. You can view your lifetime ADR or select a recent period. This only works if you have played matches on Popflash.

**Need help?** Ask an admin or check the tournament status!
  `.trim();

	return createSuccessResponse(helpText, { ephemeral: true });
}
