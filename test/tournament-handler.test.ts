import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { handleTournamentCommand } from "../src/handlers/tournament";
import { DISCORD_INTERACTION_TYPES } from "../src/validation/discord";
import {
	DISCORD_RESPONSE_TYPES,
	type DiscordInteractionResponse,
} from "../src/utils/discord-responses";

// Mock environment
const mockEnv = {
	DB: {} as D1Database,
	DISCORD_PUBLIC_KEY: "test-key",
	TOURNAMENT_ADMIN_ROLES: "123456789,987654321",
};

// Mock all the services and repositories
const mockTournamentService = {
	openTournament: vi.fn(),
	closeTournament: vi.fn(),
	getTournamentStatus: vi.fn(),
	submitPlayerAdr: vi.fn(),
	submitAdminAdr: vi.fn(),
	lockPlayerAdr: vi.fn(),
	unlockPlayerAdr: vi.fn(),
	getPlayerAdrs: vi.fn(),
	generateTeams: vi.fn(),
	lockTeams: vi.fn(),
	unlockTeams: vi.fn(),
	getTeams: vi.fn(),
	recordMatch: vi.fn(),
	teamsExist: vi.fn(),
	areTeamsLocked: vi.fn(),
	requireOpenTournament: vi.fn(),
	isTournamentOpen: vi.fn(),
	allPlayersHaveAdr: vi.fn(),
	getPlayersWithoutAdr: vi.fn(),
};

const mockPermissionService = {
	checkAdminPermission: vi.fn(),
	requireAdminPermission: vi.fn(),
};

// Mock the service modules
vi.mock("../src/services/tournament", () => ({
	TournamentService: vi.fn().mockImplementation(() => mockTournamentService),
	TournamentError: class TournamentError extends Error {
		constructor(
			message: string,
			public code: string,
		) {
			super(message);
			this.name = "TournamentError";
		}
	},
}));

vi.mock("../src/services/permission", () => ({
	PermissionService: {
		fromEnvironment: vi.fn().mockImplementation(() => mockPermissionService),
	},
	PermissionError: class PermissionError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "PermissionError";
		}
	},
}));

// Mock database and repositories
vi.mock("../src/db", () => ({
	createDatabase: vi.fn().mockReturnValue({}),
	TournamentRepository: vi.fn(),
	PlayerRepository: vi.fn(),
	TeamRepository: vi.fn(),
	MatchRepository: vi.fn(),
}));

vi.mock("../src/services/team-generation", () => ({
	TeamGenerationService: vi.fn(),
	TeamGenerationError: class TeamGenerationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "TeamGenerationError";
		}
	},
}));

// Mock the discord middleware helper
vi.mock("../src/utils/discord-middleware", () => ({
	getDiscordBody: vi.fn(),
}));

import { getDiscordBody } from "../src/utils/discord-middleware";

describe("Tournament Command Handler", () => {
	let app: Hono<{ Bindings: typeof mockEnv }>;

	beforeEach(() => {
		vi.clearAllMocks();
		app = new Hono<{ Bindings: typeof mockEnv }>();
		app.post("/webhook", handleTournamentCommand);
	});

	describe("Discord PING interaction", () => {
		it("should handle Discord PING interaction", async () => {
			const pingInteraction = {
				type: DISCORD_INTERACTION_TYPES.PING,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
			};

			vi.mocked(getDiscordBody).mockReturnValue(pingInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(pingInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;
			expect(responseData.type).toBe(DISCORD_RESPONSE_TYPES.PONG);
		});
	});

	describe("Tournament Open Command", () => {
		it("should open tournament successfully", async () => {
			const mockTournament = {
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T10:00:00Z",
			};

			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.openTournament.mockResolvedValue(mockTournament);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "open",
							type: 1, // SUB_COMMAND
						},
					],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.type).toBe(
				DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
			);
			expect(responseData.data?.content).toContain(
				"Tournament 2025-08-31-1 is now open",
			);
			expect(responseData.data?.content).toContain("submit_adr");
			expect(mockTournamentService.openTournament).toHaveBeenCalledOnce();
		});

		it("should reject non-admin user for open command", async () => {
			const { PermissionError } = await import("../src/services/permission");
			mockPermissionService.requireAdminPermission.mockRejectedValue(
				new PermissionError("Insufficient permissions. Admin role required."),
			);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "open", type: 1 }],
				},
				member: {
					user: { id: "user-123", username: "user" },
					roles: ["regular-role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(403);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Access Denied");
			expect(mockTournamentService.openTournament).not.toHaveBeenCalled();
		});
	});

	describe("Tournament Close Command", () => {
		it("should close tournament successfully", async () => {
			const mockTournament = {
				id: "2025-08-31-1",
				status: "closed",
				createdAt: "2025-08-31T10:00:00Z",
			};

			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.closeTournament.mockResolvedValue(mockTournament);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "close", type: 1 }],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.content).toContain(
				"Tournament 2025-08-31-1 has been closed",
			);
			expect(mockTournamentService.closeTournament).toHaveBeenCalledOnce();
		});
	});

	describe("Submit ADR Command", () => {
		it("should submit player ADR successfully", async () => {
			mockTournamentService.submitPlayerAdr.mockResolvedValue(undefined);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "submit_adr",
							type: 1,
							options: [
								{
									name: "adr",
									type: 10, // NUMBER
									value: 85.5,
								},
							],
						},
					],
				},
				member: {
					user: {
						id: "player-123",
						username: "player",
						global_name: "Player One",
					},
					roles: ["regular-role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.content).toContain(
				"Your ADR has been submitted",
			);
			expect(mockTournamentService.submitPlayerAdr).toHaveBeenCalledWith(
				"player-123",
				"player",
				"Player One",
				85.5,
			);
		});

		it("should submit admin ADR for another player", async () => {
			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.submitAdminAdr.mockResolvedValue(undefined);
			mockTournamentService.submitPlayerAdr.mockResolvedValue(undefined);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "submit_adr",
							type: 1,
							options: [
								{
									name: "player",
									type: 6, // USER
									value: "target-player-456",
									user: {
										id: "target-player-456",
										username: "targetplayer",
										global_name: "Target Player",
									},
								},
								{
									name: "adr",
									type: 10,
									value: 92.1,
								},
								{
									name: "action",
									type: 3, // STRING
									value: "lock",
								},
							],
						},
					],
					resolved: {
						users: {
							"target-player-456": {
								id: "target-player-456",
								username: "targetplayer",
								global_name: "Target Player",
							},
						},
					},
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);

			// Check which method was called
			if (mockTournamentService.submitPlayerAdr.mock.calls.length > 0) {
				console.log(
					"submitPlayerAdr was called with:",
					mockTournamentService.submitPlayerAdr.mock.calls[0],
				);
			}
			if (mockTournamentService.submitAdminAdr.mock.calls.length > 0) {
				console.log(
					"submitAdminAdr was called with:",
					mockTournamentService.submitAdminAdr.mock.calls[0],
				);
			}

			expect(mockTournamentService.submitAdminAdr).toHaveBeenCalledWith(
				"admin-123",
				"target-player-456",
				"targetplayer",
				"Target Player",
				92.1,
				true,
			);
		});

		it("should validate ADR value range", async () => {
			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "submit_adr",
							type: 1,
							options: [
								{
									name: "adr",
									type: 10,
									value: -5.0, // Invalid negative ADR
								},
							],
						},
					],
				},
				member: {
					user: { id: "player-123", username: "player" },
					roles: ["regular-role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Validation Error");
			expect(mockTournamentService.submitPlayerAdr).not.toHaveBeenCalled();
		});
	});

	describe("Show ADR Command", () => {
		it("should display player ADRs", async () => {
			const mockPlayerAdrs = [
				{
					player_id: "player1",
					username: "user1",
					display_name: "User One",
					adr: 85.5,
					adr_locked: false,
					status: "submitted",
				},
				{
					player_id: "player2",
					username: "user2",
					display_name: undefined,
					adr: undefined,
					adr_locked: false,
					status: "pending",
				},
			];

			mockTournamentService.getPlayerAdrs.mockResolvedValue(mockPlayerAdrs);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "show_adr", type: 1 }],
				},
				user: { id: "user-123", username: "user" },
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.content).toContain("User One: `85.5`");
			expect(responseData.data?.content).toContain("user2: *(pending)*");
			expect(mockTournamentService.getPlayerAdrs).toHaveBeenCalledOnce();
		});
	});

	describe("Generate Teams Command", () => {
		it("should generate teams successfully", async () => {
			const mockTeams = [
				{
					id: "TEAM1",
					players: [
						{
							id: "player1",
							username: "user1",
							display_name: "User One",
							adr: 85.5,
						},
					],
					average_adr: 85.5,
					total_adr: 85.5,
				},
			];

			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.generateTeams.mockResolvedValue(mockTeams);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "generate_teams",
							type: 1,
							options: [
								{
									name: "runs",
									type: 4, // INTEGER
									value: 100,
								},
							],
						},
					],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.content).toContain("Teams Generated!");
			expect(mockTournamentService.generateTeams).toHaveBeenCalledWith(100);
		});

		it("should lock teams when action is lock", async () => {
			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.lockTeams.mockResolvedValue(undefined);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "generate_teams",
							type: 1,
							options: [
								{
									name: "action",
									type: 3,
									value: "lock",
								},
							],
						},
					],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			expect(mockTournamentService.lockTeams).toHaveBeenCalledOnce();
		});
	});

	describe("Show Teams Command", () => {
		it("should display teams", async () => {
			mockTournamentService.teamsExist.mockResolvedValue(true);
			const mockTeams = [
				{
					team_id: "TEAM1",
					players: [
						{
							player_id: "player1",
							username: "user1",
							display_name: "User One",
							adr: 85.5,
							adr_locked: false,
							status: "submitted",
						},
					],
					average_adr: 85.5,
					locked: false,
				},
			];

			mockTournamentService.getTeams.mockResolvedValue(mockTeams);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "show_teams", type: 1 }],
				},
				user: { id: "user-123", username: "user" },
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.content).toContain("TEAM1");
			expect(responseData.data?.content).toContain("User One");
			expect(mockTournamentService.getTeams).toHaveBeenCalledOnce();
		});
	});

	describe("Update Match Command", () => {
		it("should record match result successfully", async () => {
			const mockMatch = {
				match_id: 1,
				team1_id: "TEAM1",
				team2_id: "TEAM2",
				score1: 16,
				score2: 14,
				created_at: "2025-08-31T12:00:00Z",
			};

			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.recordMatch.mockResolvedValue(mockMatch);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "result",
							type: 1,
							options: [
								{
									name: "match_string",
									type: 3,
									value: "TEAM1-16-14-TEAM2",
								},
							],
						},
					],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.content).toContain("Match Result Recorded");
			expect(responseData.data?.content).toContain("TEAM1 16 - 14 TEAM2");
			expect(mockTournamentService.recordMatch).toHaveBeenCalledWith(
				"TEAM1-16-14-TEAM2",
			);
		});

		it("should validate match string format", async () => {
			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "result",
							type: 1,
							options: [
								{
									name: "match_string",
									type: 3,
									value: "invalid-format",
								},
							],
						},
					],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Validation Error");
			expect(mockTournamentService.recordMatch).not.toHaveBeenCalled();
		});
	});

	describe("Error Handling", () => {
		it("should handle TournamentError gracefully", async () => {
			const { TournamentError } = await import("../src/services/tournament");

			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.openTournament.mockRejectedValue(
				new TournamentError(
					"Tournament 2025-08-31-1 is already open",
					"TOURNAMENT_ALREADY_OPEN",
				),
			);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "open", type: 1 }],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Tournament Error");
			expect(responseData.data?.embeds?.[0]?.description).toContain(
				"already open",
			);
		});

		it("should handle PermissionError gracefully", async () => {
			const { PermissionError } = await import("../src/services/permission");

			mockPermissionService.requireAdminPermission.mockRejectedValue(
				new PermissionError("Insufficient permissions"),
			);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "open", type: 1 }],
				},
				member: {
					user: { id: "user-123", username: "user" },
					roles: ["regular-role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(403);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Access Denied");
		});

		it("should handle unknown subcommand", async () => {
			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "unknown_command", type: 1 }],
				},
				user: { id: "user-123", username: "user" },
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.description).toContain(
				"Unknown tournament subcommand",
			);
		});

		it("should handle missing user information", async () => {
			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "submit_adr",
							type: 1,
							options: [{ name: "adr", type: 10, value: 85.5 }],
						},
					],
				},
				// No user or member field
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.description).toContain(
				"User information not available",
			);
		});

		it("should handle internal server errors", async () => {
			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.openTournament.mockRejectedValue(
				new Error("Database connection failed"),
			);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "open", type: 1 }],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(500);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Database Error");
		});
	});

	describe("Input Validation", () => {
		it("should validate missing required parameters", async () => {
			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "submit_adr",
							type: 1,
							options: [], // Missing required ADR parameter
						},
					],
				},
				user: { id: "user-123", username: "user" },
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Validation Error");
		});

		it("should validate parameter types", async () => {
			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [
						{
							name: "generate_teams",
							type: 1,
							options: [
								{
									name: "runs",
									type: 4,
									value: -1, // Invalid value (negative)
								},
							],
						},
					],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(400);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.data?.embeds?.[0]?.title).toBe("Validation Error");
		});
	});

	describe("Discord Response Formatting", () => {
		it("should format success responses correctly", async () => {
			mockPermissionService.requireAdminPermission.mockResolvedValue(undefined);
			mockTournamentService.openTournament.mockResolvedValue({
				id: "2025-08-31-1",
				status: "open",
				createdAt: "2025-08-31T10:00:00Z",
			});

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "open", type: 1 }],
				},
				member: {
					user: { id: "admin-123", username: "admin" },
					roles: ["123456789"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(200);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.type).toBe(
				DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
			);
			expect(responseData.data?.content).toContain(
				"Tournament 2025-08-31-1 is now open",
			);
			expect(responseData.data?.content).toBeDefined();
		});

		it("should format error responses correctly", async () => {
			const { PermissionError } = await import("../src/services/permission");
			mockPermissionService.requireAdminPermission.mockRejectedValue(
				new PermissionError("Insufficient permissions. Admin role required."),
			);

			const commandInteraction = {
				type: DISCORD_INTERACTION_TYPES.APPLICATION_COMMAND,
				id: "test-id",
				application_id: "test-app-id",
				token: "test-token",
				version: 1,
				data: {
					id: "tournament-command-id",
					name: "tournament",
					options: [{ name: "open", type: 1 }],
				},
				member: {
					user: { id: "user-123", username: "user" },
					roles: ["regular-role"],
					joined_at: "2023-01-01T00:00:00Z",
				},
			};

			vi.mocked(getDiscordBody).mockReturnValue(commandInteraction);

			const response = await app.request(
				"/webhook",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(commandInteraction),
				},
				mockEnv,
			);

			expect(response.status).toBe(403);
			const responseData =
				(await response.json()) as DiscordInteractionResponse;

			expect(responseData.type).toBe(
				DISCORD_RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
			);
			expect(responseData.data?.embeds).toHaveLength(1);
			expect(responseData.data?.embeds?.[0]?.title).toBe("Access Denied");
			expect(responseData.data?.embeds?.[0]).toHaveProperty("color");
		});
	});
});
